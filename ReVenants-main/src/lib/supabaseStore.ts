/**
 * Supabase-backed persistent store.
 * Uses the service role key (admin client) for all server-side operations,
 * bypassing RLS.
 *
 * Column mapping notes:
 *   App type field      →  Supabase column
 *   task.progress       →  tasks.progress_percent
 *   task.id             →  tasks.task_id  (task_id is the PK in Supabase)
 *   message.text        →  messages.text (+ messages.content)
 *   message.participant_id → messages.participant_id (+ messages.sender_id)
 */

import { supabaseAdmin } from '@/integrations/supabase/client.server';
import type {
  Participant,
  Task,
  Message,
  StatusHistoryEntry,
  TaskPriority,
  TaskStatus,
  Workspace,
  StandupDigest,
  RbacRole,
} from '@/lib/types';

// ─────────────────────────── helpers ───────────────────────────

/** Map a Supabase workspaces row → app Workspace type */
function rowToWorkspace(w: any): Workspace {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    description: w.description ?? null,
    created_at: w.created_at,
    created_by: w.created_by ?? null,
  };
}

/** Map a Supabase tasks row → app Task type */
function rowToTask(t: any): Task {
  return {
    id: t.task_id,
    task_id: t.task_id,
    title: t.title,
    description: t.description ?? null,
    workspace_id: t.workspace_id ?? 'ws_default',
    owner_id: t.owner_id,
    owner_name: t.owner_name ?? null,
    telegram_handle: t.telegram_handle ?? null,
    status: t.status as TaskStatus,
    progress: t.progress_percent ?? 0,
    blocker: t.blocker ?? null,
    due_date: t.due_date,
    priority: (t.priority ?? 'Medium') as TaskPriority,
    depends_on_task_id: t.depends_on_task_id ?? null,
    unblock_nudge_sent_at: t.unblock_nudge_sent_at ?? null,
    unblock_target_participant_id: t.unblock_target_participant_id ?? null,
    reminder_count: t.reminder_count ?? 0,
    last_followup_at: t.last_followup_at ?? null,
    latest_note: t.latest_note ?? null,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

/** Map a Supabase messages row → app Message type */
function rowToMessage(m: any): Message {
  return {
    id: String(m.id),
    workspace_id: m.workspace_id ?? 'ws_default',
    telegram_message_id: m.telegram_message_id ?? null,
    sender_id: m.sender_id ?? null,
    participant_id: m.participant_id ?? m.sender_id ?? null,
    task_id: m.task_id ?? null,
    direction: m.direction as 'inbound' | 'outbound',
    media_type: m.media_type ?? 'text',
    voice_transcription: m.voice_transcription ?? null,
    audio_duration_seconds: m.audio_duration_seconds ?? null,
    text: m.text ?? m.content ?? '',
    content: m.content ?? m.text ?? '',
    classification: m.classification ?? null,
    ai_summary: m.ai_summary ?? null,
    created_at: m.created_at ?? new Date().toISOString(),
  };
}

/** Map a Supabase status_history row → app StatusHistoryEntry */
function rowToStatusHistory(s: any): StatusHistoryEntry {
  return {
    id: String(s.id),
    task_id: s.task_id,
    previous_status: s.previous_status,
    new_status: s.new_status,
    changed_by_message: s.changed_by_message,
    trigger_source: s.trigger_source,
    confidence: s.confidence ?? null,
    blocker: s.blocker ?? null,
    reason: s.reason ?? null,
    changed_at: s.changed_at,
    created_at: s.created_at ?? s.changed_at,
  };
}

/** Map a Supabase participants row → app Participant type */
function rowToParticipant(p: any): Participant & { linked: boolean } {
  return {
    id: p.id,
    name: p.name,
    role: p.role ?? 'Contributor',
    workspace_id: p.workspace_id ?? 'ws_default',
    user_id: p.user_id ?? null,
    rbac_role: (p.rbac_role ?? 'Contributor') as RbacRole,
    telegram_id: p.telegram_id ?? null,
    telegram_handle: p.telegram_handle ?? null,
    telegram_username: p.telegram_username ?? (p.telegram_handle ? p.telegram_handle.replace(/^@/, '') : null),
    link_code: p.link_code ?? `link_${p.id}`,
    created_at: p.created_at,
    linked: !!p.telegram_id,
  };
}

/** Map a Supabase standup_digests row → app StandupDigest type */
function rowToStandupDigest(d: any): StandupDigest {
  return {
    id: d.id,
    workspace_id: d.workspace_id,
    summary_markdown: d.summary_markdown,
    blocker_count: d.blocker_count ?? 0,
    completed_count: d.completed_count ?? 0,
    in_progress_count: d.in_progress_count ?? 0,
    broadcast_telegram: !!d.broadcast_telegram,
    created_at: d.created_at,
    created_by_user_id: d.created_by_user_id ?? null,
  };
}

// ─────────────────────────── Workspaces ───────────────────────────

export async function getWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToWorkspace);
}

export async function getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToWorkspace(data) : null;
}

// ─────────────────────────── Tasks ───────────────────────────

export async function getTasks(workspaceId = 'ws_default'): Promise<Task[]> {
  let query = supabaseAdmin
    .from('tasks')
    .select('*')
    .order('task_id', { ascending: true });
  
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToTask);
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('task_id', taskId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToTask(data) : null;
}

export async function getTasksByOwner(ownerId: string): Promise<Task[]> {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('owner_id', ownerId);
  if (error) throw error;
  return (data ?? []).map(rowToTask);
}

export async function addTask(input: {
  title: string;
  ownerId: string;
  dueDate?: string | undefined;
  priority?: TaskPriority | undefined;
  description?: string | null | undefined;
  workspaceId?: string | undefined;
  dependsOnTaskId?: string | null | undefined;
}): Promise<Task> {
  // generate next task ID
  const { count, error: cErr } = await supabaseAdmin
    .from('tasks')
    .select('*', { count: 'exact', head: true });
  if (cErr) throw cErr;
  const nextNum = 101 + (count ?? 0);
  const taskId = `TASK-${nextNum}`;

  // resolve owner name
  let ownerName = 'Unassigned';
  let handle: string | null = null;
  const { data: ownerRow } = await supabaseAdmin
    .from('participants')
    .select('name,telegram_handle')
    .eq('id', input.ownerId)
    .maybeSingle();
  if (ownerRow) {
    ownerName = ownerRow.name;
    handle = ownerRow.telegram_handle ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert({
      task_id: taskId,
      title: input.title,
      description: input.description ?? null,
      workspace_id: input.workspaceId ?? 'ws_default',
      owner_id: input.ownerId,
      owner_name: ownerName,
      telegram_handle: handle,
      status: 'Pending',
      progress_percent: 0,
      due_date: input.dueDate ?? new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]!,
      priority: input.priority ?? 'Medium',
      depends_on_task_id: input.dependsOnTaskId ?? null,
      reminder_count: 0,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToTask(data);
}

export async function updateTask(
  taskId: string,
  updates: Partial<Omit<Task, 'id' | 'task_id'>>,
): Promise<Task | null> {
  // Map app fields → Supabase column names
  const mapped: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.status !== undefined) mapped['status'] = updates.status;
  if (updates.progress !== undefined) mapped['progress_percent'] = updates.progress;
  if (updates.blocker !== undefined) mapped['blocker'] = updates.blocker;
  if (updates.latest_note !== undefined) mapped['latest_note'] = updates.latest_note;
  if (updates.reminder_count !== undefined) mapped['reminder_count'] = updates.reminder_count;
  if (updates.last_followup_at !== undefined) mapped['last_followup_at'] = updates.last_followup_at;
  if (updates.owner_name !== undefined) mapped['owner_name'] = updates.owner_name;
  if (updates.telegram_handle !== undefined) mapped['telegram_handle'] = updates.telegram_handle;
  if (updates.priority !== undefined) mapped['priority'] = updates.priority;
  if (updates.due_date !== undefined) mapped['due_date'] = updates.due_date;
  if (updates.description !== undefined) mapped['description'] = updates.description;
  if (updates.depends_on_task_id !== undefined) mapped['depends_on_task_id'] = updates.depends_on_task_id;
  if (updates.unblock_nudge_sent_at !== undefined) mapped['unblock_nudge_sent_at'] = updates.unblock_nudge_sent_at;
  if (updates.unblock_target_participant_id !== undefined) mapped['unblock_target_participant_id'] = updates.unblock_target_participant_id;

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(mapped as any)
    .eq('task_id', taskId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? rowToTask(data) : null;
}

// ─────────────────────────── Participants ───────────────────────────

export async function getParticipants(workspaceId = 'ws_default'): Promise<Participant[]> {
  let query = supabaseAdmin.from('participants').select('*');
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToParticipant);
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  const { data, error } = await supabaseAdmin
    .from('participants')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToParticipant(data) : null;
}

export async function getParticipantByTelegram(telegramId: number): Promise<Participant | null> {
  const { data, error } = await supabaseAdmin
    .from('participants')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToParticipant(data) : null;
}

export async function addParticipant(
  name: string,
  role?: string,
  workspaceId = 'ws_default',
  rbacRole: RbacRole = 'Contributor',
): Promise<Participant> {
  const id = `user_${Date.now().toString(36)}`;
  const { data, error } = await supabaseAdmin
    .from('participants')
    .insert({
      id,
      name,
      role: role ?? 'Contributor',
      workspace_id: workspaceId,
      rbac_role: rbacRole,
      link_code: `link_${Math.random().toString(36).substring(2, 8)}`,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToParticipant(data);
}

export async function claimParticipantProfile(
  participantId: string,
  userId: string,
  rbacRole?: RbacRole,
): Promise<Participant | null> {
  const updates: Record<string, any> = { user_id: userId };
  if (rbacRole) updates['rbac_role'] = rbacRole;

  const { data, error } = await supabaseAdmin
    .from('participants')
    .update(updates as any)
    .eq('id', participantId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ? rowToParticipant(data) : null;
}

export async function linkParticipantTelegram(
  linkCode: string,
  chatId: number,
  username?: string | null,
): Promise<Participant | null> {
  const cleanCode = linkCode.trim();

  // Find participant by link_code (case-insensitive so link_Ananya matches link_ananya)
  const { data: found, error: findErr } = await supabaseAdmin
    .from('participants')
    .select('*')
    .ilike('link_code', cleanCode)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!found) return null;

  // If this Telegram chatId was previously linked to another teammate (e.g. switching test roles), clear old link
  await supabaseAdmin
    .from('participants')
    .update({ telegram_id: null, telegram_username: null } as any)
    .eq('telegram_id', chatId)
    .neq('id', found.id);

  const { data, error } = await supabaseAdmin
    .from('participants')
    .update({
      telegram_id: chatId,
      telegram_username: username ?? null,
      telegram_handle: username ? `@${username}` : found.telegram_handle,
    })
    .eq('id', found.id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToParticipant(data);
}


// ─────────────────────────── Messages ───────────────────────────

export async function logMessage(msg: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      workspace_id: msg.workspace_id ?? 'ws_default',
      telegram_message_id: msg.telegram_message_id ?? null,
      sender_id: msg.sender_id ?? msg.participant_id ?? null,
      participant_id: msg.participant_id ?? msg.sender_id ?? null,
      task_id: msg.task_id ?? null,
      direction: msg.direction,
      media_type: msg.media_type ?? 'text',
      voice_transcription: msg.voice_transcription ?? null,
      audio_duration_seconds: msg.audio_duration_seconds ?? null,
      content: msg.text ?? msg.content ?? '',
      text: msg.text ?? msg.content ?? '',
      classification: msg.classification ?? null,
      ai_summary: msg.ai_summary ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToMessage(data);
}

export async function getMessages(limit = 60, workspaceId = 'ws_default'): Promise<Message[]> {
  let query = supabaseAdmin
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToMessage);
}

// ─────────────────────────── Status History ───────────────────────────

export async function appendStatusHistory(
  entry: Omit<StatusHistoryEntry, 'id' | 'changed_at'>,
): Promise<StatusHistoryEntry> {
  const { data, error } = await supabaseAdmin
    .from('status_history')
    .insert({
      task_id: entry.task_id,
      previous_status: entry.previous_status,
      new_status: entry.new_status,
      changed_by_message: entry.changed_by_message,
      trigger_source: entry.trigger_source,
      confidence: entry.confidence ?? null,
      blocker: entry.blocker ?? null,
      reason: entry.reason ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToStatusHistory(data);
}

export async function getStatusHistory(limit = 40): Promise<StatusHistoryEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('status_history')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToStatusHistory);
}

// ─────────────────────────── Standup Digests ───────────────────────────

export async function saveStandupDigest(digest: {
  workspaceId?: string;
  summaryMarkdown: string;
  blockerCount: number;
  completedCount: number;
  inProgressCount: number;
  broadcastTelegram?: boolean;
  createdByUserId?: string | null;
}): Promise<StandupDigest> {
  const id = `digest_${Math.random().toString(36).substring(2, 10)}`;
  const { data, error } = await supabaseAdmin
    .from('standup_digests')
    .insert({
      id,
      workspace_id: digest.workspaceId ?? 'ws_default',
      summary_markdown: digest.summaryMarkdown,
      blocker_count: digest.blockerCount,
      completed_count: digest.completedCount,
      in_progress_count: digest.inProgressCount,
      broadcast_telegram: digest.broadcastTelegram ?? false,
      created_by_user_id: digest.createdByUserId ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToStandupDigest(data);
}

export async function getStandupDigests(workspaceId = 'ws_default', limit = 10): Promise<StandupDigest[]> {
  const { data, error } = await supabaseAdmin
    .from('standup_digests')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToStandupDigest);
}
