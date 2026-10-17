/**
 * Core Domain Types for AI Group Project Coordinator (ReVenants)
 * Aligned with docs/04_DATA_MODEL.md and docs/05_REPLY_UNDERSTANDING.md
 */

export const TASK_STATUSES = [
  'Pending',
  'In Progress',
  'Blocked',
  'Complete',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

// Standard normalized statuses
export type NormalizedTaskStatus = 'pending' | 'in_progress' | 'blocked' | 'complete';

export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const INTENTS = [
  'completed',
  'in_progress',
  'blocked',
  'delayed',
  'question',
  'unrelated',
] as const;
export type ReplyIntent = (typeof INTENTS)[number];

export const RBAC_ROLES = ['Lead', 'Contributor', 'Observer', 'AI Coordinator'] as const;
export type RbacRole = (typeof RBAC_ROLES)[number];

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string | null | undefined;
  created_at: string;
  created_by?: string | null | undefined;
}

/**
 * Standard Participant Model (docs/04_DATA_MODEL.md)
 */
export interface Participant {
  id: string; // e.g., "USER-01" or uuid or handle
  name: string; // e.g., "Kabir Patel"
  role?: string | null | undefined; // e.g., "Backend Engineer"
  workspace_id?: string | undefined;
  user_id?: string | null | undefined;
  rbac_role?: RbacRole | undefined;
  telegram_id?: number | null | undefined; // Numeric Telegram User ID / Chat ID
  telegram_handle?: string | null | undefined; // e.g., "@kabir_p"
  telegram_username?: string | null | undefined;
  link_code: string; // Code for /start <link_code>
  created_at: string;
}

/**
 * Standard Task Model (docs/04_DATA_MODEL.md)
 */
export interface Task {
  id: string; // Internal id or task_id (e.g. "TASK-103")
  task_id: string; // Explicit display/spec id (e.g. "TASK-103")
  title: string;
  description?: string | null | undefined;
  workspace_id?: string | undefined;
  owner_id: string; // FK -> Participant.id
  owner_name?: string | null | undefined;
  telegram_handle?: string | null | undefined;
  status: TaskStatus;
  progress: number; // 0 - 100
  blocker?: string | null | undefined; // Non-null when status is 'Blocked'
  due_date: string; // YYYY-MM-DD
  priority: TaskPriority;
  depends_on_task_id?: string | null | undefined;
  unblock_nudge_sent_at?: string | null | undefined;
  unblock_target_participant_id?: string | null | undefined;
  reminder_count: number;
  last_followup_at?: string | null | undefined;
  latest_note?: string | null | undefined;
  created_at: string;
  updated_at: string;
}

/**
 * Standard Message Model (docs/04_DATA_MODEL.md)
 */
export interface Message {
  id: string;
  workspace_id?: string | undefined;
  telegram_message_id?: number | null | undefined;
  telegram_update_id?: number | null | undefined;
  sender_id?: string | null | undefined;
  participant_id?: string | null | undefined;
  task_id?: string | null | undefined;
  direction: 'inbound' | 'outbound';
  media_type?: 'text' | 'voice_note' | 'audio' | 'document' | undefined;
  voice_transcription?: string | null | undefined;
  audio_duration_seconds?: number | null | undefined;
  text: string;
  content?: string | undefined;
  classification?: ReplyIntent | string | null | undefined;
  ai_summary?: string | null | undefined;
  created_at: string;
}

export interface StandupDigest {
  id: string;
  workspace_id: string;
  summary_markdown: string;
  blocker_count: number;
  completed_count: number;
  in_progress_count: number;
  broadcast_telegram: boolean;
  created_at: string;
  created_by_user_id?: string | null | undefined;
}

/**
 * Immutable Audit Record (docs/04_DATA_MODEL.md: status_history / status_events)
 */
export interface StatusHistoryEntry {
  id: string;
  task_id: string;
  previous_status: TaskStatus;
  new_status: TaskStatus;
  changed_by_message: string; // Verbatim student message text
  trigger_source: 'telegram_reply' | 'manual_dashboard' | 'simulation' | 'init' | 'agent';
  confidence?: number | null; // LLM confidence (0.0 - 1.0)
  blocker?: string | null;
  reason?: string | null;
  changed_at: string;
  created_at?: string;
}

/**
 * Classification Output Format (prompts/classifier_system_prompt_v1.md)
 */
export interface ClassifierResult {
  task_id: string;
  intent: ReplyIntent;
  progress_percent: number | null;
  blocker: string | null;
  needs_followup: boolean;
  clarification_question: string | null;
  confidence: number;
  reasoning: string;
}

/**
 * Helper to normalize any status string to display/spec TaskStatus
 */
export function normalizeStatus(val: string | null | undefined): TaskStatus {
  if (!val) return 'Pending';
  const clean = val.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (clean === 'complete' || clean === 'completed') return 'Complete';
  if (clean === 'inprogress' || clean === 'progress') return 'In Progress';
  if (clean === 'blocked' || clean === 'block') return 'Blocked';
  return 'Pending';
}

/**
 * Helper to get lowercase key
 */
export function statusToKey(status: TaskStatus): NormalizedTaskStatus {
  switch (status) {
    case 'Complete':
      return 'complete';
    case 'In Progress':
      return 'in_progress';
    case 'Blocked':
      return 'blocked';
    case 'Pending':
    default:
      return 'pending';
  }
}
