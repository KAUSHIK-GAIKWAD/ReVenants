/**
 * Central State & Database Store
 * Delegates to Supabase when USING_SUPABASE is true, otherwise falls back to
 * an in-memory store seeded from data/sample_tasks.csv.
 *
 * All consumers (coordinator.server.ts, coordinator.functions.ts, routes)
 * import from this module — the Supabase switch is transparent to them.
 */

import type {
  Participant,
  Task,
  Message,
  StatusHistoryEntry,
  TaskStatus,
  TaskPriority,
  Workspace,
  StandupDigest,
  RbacRole,
} from './types';
import { normalizeStatus } from './types';

// ─────────────────────── Supabase toggle ───────────────────────
export function isUsingSupabase(): boolean {
  return !!(
    (process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL']) &&
    process.env['SUPABASE_SERVICE_ROLE_KEY']
  );
}

/**
 * Lazy-load supabaseStore only when we actually need it (avoids importing
 * the server-only client module in the client bundle).
 */
async function sb() {
  return await import('./supabaseStore');
}

// ═══════════════════════════════════════════════════════════════
//  In-memory fallback (kept for offline / dev-without-DB mode)
// ═══════════════════════════════════════════════════════════════

interface LocalState {
  workspaces: Map<string, Workspace>;
  participants: Map<string, Participant>;
  tasks: Map<string, Task>;
  messages: Message[];
  statusHistory: StatusHistoryEntry[];
  standupDigests: StandupDigest[];
  initialized: boolean;
}

const localState: LocalState = {
  workspaces: new Map(),
  participants: new Map(),
  tasks: new Map(),
  messages: [],
  statusHistory: [],
  standupDigests: [],
  initialized: false,
};

// ─────────── CSV parser for seed data ───────────
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function initializeSeedData(): void {
  if (localState.initialized && localState.tasks.size > 0) return;

  // Dynamic import so this module can also load in the browser (where fs isn't available)
  let fs: typeof import('node:fs') | undefined;
  let pathMod: typeof import('node:path') | undefined;
  try {
    fs = require('node:fs');
    pathMod = require('node:path');
  } catch {
    localState.initialized = true;
    return;
  }

  const csvPath = pathMod!.resolve(process.cwd(), 'data', 'sample_tasks.csv');
  if (fs!.existsSync(csvPath)) {
    try {
      const content = fs!.readFileSync(csvPath, 'utf-8');
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 1) {
        const header = parseCsvLine(lines[0]!);
        const taskIdx = header.indexOf('task_id');
        const titleIdx = header.indexOf('title');
        const descIdx = header.indexOf('description');
        const ownerNameIdx = header.indexOf('owner_name');
        const handleIdx = header.indexOf('telegram_handle');
        const statusIdx = header.indexOf('status');
        const dueIdx = header.indexOf('due_date');
        const priorityIdx = header.indexOf('priority');
        const depIdx = header.indexOf('depends_on_task_id');
        const blockerIdx = header.indexOf('blocker');

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]!);
          if (cols.length < 5) continue;

          const taskId = cols[taskIdx] ?? `TASK-${100 + i}`;
          const ownerName = cols[ownerNameIdx] ?? 'Unassigned';
          const handle = cols[handleIdx] ?? '';
          const ownerId = handle.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '_') || `user_${i}`;

          if (!localState.participants.has(ownerId)) {
            const role =
              ownerName.includes('Kabir')
                ? 'Backend & API'
                : ownerName.includes('Maya')
                  ? 'Fullstack & Auth'
                  : ownerName.includes('Sara')
                    ? 'Frontend UI/UX'
                    : 'System Architect & QA';

            localState.participants.set(ownerId, {
              id: ownerId,
              name: ownerName,
              role,
              telegram_handle: handle,
              telegram_username: handle.replace(/^@/, ''),
              telegram_id: null,
              link_code: `link_${ownerId.slice(0, 6)}`,
              created_at: new Date().toISOString(),
            });
          }

          const rawStatus = cols[statusIdx] ?? 'Pending';
          const status = normalizeStatus(rawStatus);
          const progress = status === 'Complete' ? 100 : status === 'In Progress' ? 50 : 0;
          const blocker = (cols[blockerIdx] ?? '').trim() || null;
          const dueDate = cols[dueIdx] ?? '2025-11-15';
          const priority = (cols[priorityIdx] as TaskPriority) ?? 'Medium';
          const dependsOn = (cols[depIdx] ?? '').trim() || null;
          const description = (cols[descIdx] ?? '').trim() || null;

          localState.tasks.set(taskId, {
            id: taskId,
            task_id: taskId,
            title: cols[titleIdx] ?? 'Untitled Task',
            description,
            owner_id: ownerId,
            owner_name: ownerName,
            telegram_handle: handle,
            status,
            progress,
            blocker,
            due_date: dueDate,
            priority,
            depends_on_task_id: dependsOn,
            reminder_count: 0,
            latest_note: status === 'Complete' ? 'Initialized as complete' : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse sample_tasks.csv:', e);
    }
  }

  // Fallback defaults if CSV missing
  if (localState.tasks.size === 0) {
    const defaults: Participant[] = [
      { id: 'kabir_p', name: 'Kabir Patel', role: 'Backend Engineer', telegram_handle: '@kabir_p', link_code: 'kabir123', created_at: new Date().toISOString() },
      { id: 'maya_c', name: 'Maya Chen', role: 'Fullstack Engineer', telegram_handle: '@maya_c', link_code: 'maya123', created_at: new Date().toISOString() },
      { id: 'sara_m', name: 'Sara Al-Mansoor', role: 'UI/UX Designer', telegram_handle: '@sara_m', link_code: 'sara123', created_at: new Date().toISOString() },
      { id: 'alex_m', name: 'Alex Morgan', role: 'Database & DevOps', telegram_handle: '@alex_m', link_code: 'alex123', created_at: new Date().toISOString() },
    ];
    for (const p of defaults) localState.participants.set(p.id, p);

    const tasks: Task[] = [
      { id: 'TASK-101', task_id: 'TASK-101', title: 'Setup database schema', owner_id: 'alex_m', owner_name: 'Alex Morgan', status: 'Complete', progress: 100, due_date: '2025-11-10', priority: 'High', reminder_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'TASK-102', task_id: 'TASK-102', title: 'Build User Authentication API', owner_id: 'maya_c', owner_name: 'Maya Chen', status: 'In Progress', progress: 60, due_date: '2025-11-12', priority: 'High', depends_on_task_id: 'TASK-101', reminder_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'TASK-103', task_id: 'TASK-103', title: 'Connect the payment API', owner_id: 'kabir_p', owner_name: 'Kabir Patel', status: 'Pending', progress: 0, due_date: '2025-11-13', priority: 'Urgent', depends_on_task_id: 'TASK-102', reminder_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'TASK-104', task_id: 'TASK-104', title: 'Design Checkout UI', owner_id: 'sara_m', owner_name: 'Sara Al-Mansoor', status: 'In Progress', progress: 50, due_date: '2025-11-13', priority: 'Medium', reminder_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    for (const t of tasks) localState.tasks.set(t.id, t);
  }

  if (localState.statusHistory.length === 0) {
    localState.statusHistory.push({
      id: 'init-1',
      task_id: 'TASK-101',
      previous_status: 'In Progress',
      new_status: 'Complete',
      changed_by_message: 'Initial project setup verification',
      trigger_source: 'init',
      confidence: 1.0,
      reason: 'Verified SQLite and database tables initialized',
      changed_at: new Date(Date.now() - 3600000).toISOString(),
    });
  }

  localState.initialized = true;
}

// ═══════════════════════════════════════════════════════════════
//  Public Store API — delegates to Supabase or local fallback
// ═══════════════════════════════════════════════════════════════

export async function getParticipants(): Promise<Participant[]> {
  if (isUsingSupabase()) return (await sb()).getParticipants();
  initializeSeedData();
  return Array.from(localState.participants.values());
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  if (isUsingSupabase()) return (await sb()).getParticipantById(id);
  initializeSeedData();
  return localState.participants.get(id) ?? null;
}

export async function getParticipantByChatId(chatId: number): Promise<Participant | null> {
  if (isUsingSupabase()) return (await sb()).getParticipantByTelegram(chatId);
  initializeSeedData();
  for (const p of localState.participants.values()) {
    if (p.telegram_id === chatId) return p;
  }
  return null;
}

export async function linkParticipantTelegram(
  linkCode: string,
  chatId: number,
  username?: string | null,
): Promise<Participant | null> {
  if (isUsingSupabase()) return (await sb()).linkParticipantTelegram(linkCode, chatId, username);
  initializeSeedData();
  const cleanCode = linkCode.trim().toLowerCase();
  for (const p of localState.participants.values()) {
    if (p.telegram_id === chatId) p.telegram_id = null;
  }
  for (const p of localState.participants.values()) {
    if ((p.link_code || '').toLowerCase() === cleanCode) {
      p.telegram_id = chatId;
      p.telegram_username = username ?? null;
      p.telegram_handle = username ? `@${username}` : (p.telegram_handle ?? null);
      return p;
    }
  }
  return null;
}

export async function addParticipant(
  name: string,
  role?: string,
  workspaceId = 'ws_default',
  rbacRole: RbacRole = 'Contributor',
): Promise<Participant> {
  if (isUsingSupabase()) return (await sb()).addParticipant(name, role, workspaceId, rbacRole);
  initializeSeedData();
  const id = `user_${Date.now().toString(36)}`;
  const participant: Participant = {
    id,
    name,
    role: role ?? 'Contributor',
    workspace_id: workspaceId,
    rbac_role: rbacRole,
    link_code: `link_${Math.random().toString(36).substring(2, 8)}`,
    created_at: new Date().toISOString(),
  };
  localState.participants.set(id, participant);
  return participant;
}

export async function getTasks(): Promise<Task[]> {
  if (isUsingSupabase()) return (await sb()).getTasks();
  initializeSeedData();
  return Array.from(localState.tasks.values()).sort((a, b) => a.task_id.localeCompare(b.task_id));
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  if (isUsingSupabase()) return (await sb()).getTaskById(taskId);
  initializeSeedData();
  const direct = localState.tasks.get(taskId);
  if (direct) return direct;
  for (const t of localState.tasks.values()) {
    if (t.task_id.toLowerCase() === taskId.toLowerCase()) return t;
  }
  return null;
}

export async function getTasksByOwner(ownerId: string): Promise<Task[]> {
  if (isUsingSupabase()) return (await sb()).getTasksByOwner(ownerId);
  initializeSeedData();
  return Array.from(localState.tasks.values()).filter((t) => t.owner_id === ownerId);
}

export async function addTask(data: {
  title: string;
  ownerId: string;
  dueDate?: string | undefined;
  priority?: TaskPriority | undefined;
  description?: string | null | undefined;
  dependsOnTaskId?: string | null | undefined;
  workspaceId?: string | undefined;
}): Promise<Task> {
  if (isUsingSupabase()) return (await sb()).addTask(data);
  initializeSeedData();
  const nextNum = 101 + localState.tasks.size;
  const taskId = `TASK-${nextNum}`;
  const owner = localState.participants.get(data.ownerId);
  const newTask: Task = {
    id: taskId,
    task_id: taskId,
    title: data.title,
    description: data.description ?? null,
    workspace_id: data.workspaceId ?? 'ws_default',
    owner_id: data.ownerId,
    owner_name: owner?.name ?? 'Unassigned',
    telegram_handle: owner?.telegram_handle ?? null,
    status: 'Pending',
    progress: 0,
    due_date: data.dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]!,
    priority: data.priority || 'Medium',
    depends_on_task_id: data.dependsOnTaskId ?? null,
    reminder_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  localState.tasks.set(taskId, newTask);
  return newTask;
}

export async function updateTask(
  taskId: string,
  updates: Partial<Omit<Task, 'id' | 'task_id'>>,
): Promise<Task | null> {
  if (isUsingSupabase()) return (await sb()).updateTask(taskId, updates);
  initializeSeedData();
  const task = await getTaskById(taskId);
  if (!task) return null;

  if (updates.status !== undefined) task.status = updates.status;
  if (updates.progress !== undefined) task.progress = updates.progress;
  if (updates.blocker !== undefined) task.blocker = updates.blocker;
  if (updates.latest_note !== undefined) task.latest_note = updates.latest_note;
  if (updates.reminder_count !== undefined) task.reminder_count = updates.reminder_count;
  if (updates.last_followup_at !== undefined) task.last_followup_at = updates.last_followup_at;
  if (updates.unblock_nudge_sent_at !== undefined) task.unblock_nudge_sent_at = updates.unblock_nudge_sent_at;
  if (updates.unblock_target_participant_id !== undefined) task.unblock_target_participant_id = updates.unblock_target_participant_id;
  if (updates.depends_on_task_id !== undefined) task.depends_on_task_id = updates.depends_on_task_id;
  if (updates.owner_name !== undefined) task.owner_name = updates.owner_name;
  if (updates.telegram_handle !== undefined) task.telegram_handle = updates.telegram_handle;
  if (updates.due_date !== undefined) task.due_date = updates.due_date;
  task.updated_at = new Date().toISOString();
  return task;
}

export async function logMessage(msg: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
  if (isUsingSupabase()) return (await sb()).logMessage(msg);
  initializeSeedData();
  const record: Message = {
    ...msg,
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
  };
  localState.messages.unshift(record);
  return record;
}

export async function getMessages(limit = 60): Promise<Message[]> {
  if (isUsingSupabase()) return (await sb()).getMessages(limit);
  initializeSeedData();
  return localState.messages.slice(0, limit);
}

export async function logStatusHistory(entry: Omit<StatusHistoryEntry, 'id' | 'changed_at'>): Promise<StatusHistoryEntry> {
  if (isUsingSupabase()) return (await sb()).appendStatusHistory(entry);
  initializeSeedData();
  const record: StatusHistoryEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    changed_at: new Date().toISOString(),
  };
  localState.statusHistory.unshift(record);
  return record;
}

export async function getStatusHistory(limit = 40): Promise<StatusHistoryEntry[]> {
  if (isUsingSupabase()) return (await sb()).getStatusHistory(limit);
  initializeSeedData();
  return localState.statusHistory.slice(0, limit);
}

// ─────────────────────────── Workspaces ───────────────────────────

export async function getWorkspaces(): Promise<Workspace[]> {
  if (isUsingSupabase()) return (await sb()).getWorkspaces();
  initializeSeedData();
  if (!localState.workspaces.has('ws_default')) {
    localState.workspaces.set('ws_default', {
      id: 'ws_default',
      name: 'ReVenants Alpha Project',
      slug: 'revenants-alpha',
      description: 'Primary engineering workspace for AI group coordination',
      created_at: new Date().toISOString(),
    });
  }
  return Array.from(localState.workspaces.values());
}

export async function claimParticipantProfile(
  participantId: string,
  userId: string,
  rbacRole?: RbacRole,
): Promise<Participant | null> {
  if (isUsingSupabase()) return (await sb()).claimParticipantProfile(participantId, userId, rbacRole);
  initializeSeedData();
  const p = localState.participants.get(participantId);
  if (!p) return null;
  p.user_id = userId;
  if (rbacRole) p.rbac_role = rbacRole;
  return p;
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
  if (isUsingSupabase()) return (await sb()).saveStandupDigest(digest);
  initializeSeedData();
  const record: StandupDigest = {
    id: `digest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    workspace_id: digest.workspaceId ?? 'ws_default',
    summary_markdown: digest.summaryMarkdown,
    blocker_count: digest.blockerCount,
    completed_count: digest.completedCount,
    in_progress_count: digest.inProgressCount,
    broadcast_telegram: digest.broadcastTelegram ?? false,
    created_at: new Date().toISOString(),
    created_by_user_id: digest.createdByUserId ?? null,
  };
  localState.standupDigests.unshift(record);
  return record;
}

export async function getStandupDigests(workspaceId = 'ws_default', limit = 10): Promise<StandupDigest[]> {
  if (isUsingSupabase()) return (await sb()).getStandupDigests(workspaceId, limit);
  initializeSeedData();
  return localState.standupDigests.slice(0, limit);
}

export { initializeSeedData };

