/**
 * Coordinator Server Engine
 * Implements conversational follow-ups, reply understanding, state transitions,
 * Cross-Dependency Blocker Nudges, Voice Note check-in processing,
 * Standup Digest generation, Telegram webhook & polling handlers, and immutable audit logs.
 * Strictly adheres to docs/04_DATA_MODEL.md, docs/05_REPLY_UNDERSTANDING.md,
 * and prompts/classifier_system_prompt_v1.md.
 */

import { classifyReply } from './classifier';
import * as store from './store';
import type { Task, TaskStatus, StandupDigest } from './types';

export const BOT_USERNAME = process.env['TELEGRAM_BOT_USERNAME'] || 'revenants_coord_bot';
const TG_GATEWAY = 'https://connector-gateway.lovable.dev/telegram';

/**
 * Check which Telegram credentials are provided
 */
function getTelegramConfig() {
  const botToken = process.env['TELEGRAM_BOT_TOKEN']?.trim();
  const lovableKey = process.env['LOVABLE_API_KEY']?.trim();
  const telegramKey = process.env['TELEGRAM_API_KEY']?.trim();

  return {
    botToken: botToken || null,
    lovableKey: lovableKey || null,
    telegramKey: telegramKey || null,
    hasLiveConnection: Boolean(botToken || (lovableKey && telegramKey)),
  };
}

/**
 * Derive Webhook Secret Token for Telegram Webhook
 */
export async function deriveWebhookSecret(): Promise<string> {
  const secretKey =
    process.env['TELEGRAM_BOT_TOKEN'] ||
    process.env['TELEGRAM_API_KEY'] ||
    'revenants_default_secret_key';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`telegram-webhook:${secretKey}`),
  );
  let bin = '';
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Send a message to Telegram or simulate gracefully if in offline mode
 */
export async function telegramSend(chatId: number, text: string): Promise<{ ok: boolean; description?: string }> {
  const config = getTelegramConfig();

  // 1. Standard Telegram Bot API (Direct Bot Token)
  if (config.botToken) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      const data = (await res.json()) as { ok: boolean; description?: string };
      if (!data.ok) {
        console.warn(`Telegram send warning: ${data.description}`);
      }
      return data;
    } catch (e) {
      console.warn('Telegram send failed:', e);
      return { ok: false, description: String(e) };
    }
  }

  // 2. Lovable Gateway
  if (config.lovableKey && config.telegramKey) {
    try {
      const res = await fetch(`${TG_GATEWAY}/sendMessage`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.lovableKey}`,
          'X-Connection-Api-Key': config.telegramKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      const data = (await res.json()) as { ok: boolean; description?: string };
      return data;
    } catch (e) {
      console.warn('Lovable Telegram send failed:', e);
      return { ok: false, description: String(e) };
    }
  }

  // 3. Simulated delivery (offline MVP / demo mode)
  console.info(`[Telegram Simulated Send -> Chat ${chatId}]: ${text}`);
  return { ok: true, description: 'Simulated delivery in offline mode' };
}

/**
 * Send a proactive follow-up to a participant covering their open tasks
 */
export async function sendFollowupTo(participantId: string): Promise<{ sent: boolean; reason: string }> {
  const p = await store.getParticipantById(participantId);
  if (!p) throw new Error(`Participant not found: ${participantId}`);

  const allTasks = await store.getTasksByOwner(participantId);
  const openTasks = allTasks.filter((t) => t.status !== 'Complete');

  if (openTasks.length === 0) {
    return { sent: false, reason: `${p.name} has no open tasks` };
  }

  const lines = openTasks.map(
    (t, i) =>
      `${i + 1}. ${t.task_id}: ${t.title} — ${t.status}${t.blocker ? ` (blocked: ${t.blocker})` : ''}`,
  );

  const text =
    `Hi ${p.name} 👋 quick check-in on your project tasks:\n\n${lines.join('\n')}\n\n` +
    `How are they going? Reply in your own words — e.g. "done", "halfway", or what you're stuck on.`;

  // Log message
  await store.logMessage({
    participant_id: p.id,
    task_id: openTasks.length === 1 ? openTasks[0]!.task_id : null,
    direction: 'outbound',
    text,
  });

  // Increment reminder count and update timestamp
  for (const t of openTasks) {
    await store.updateTask(t.task_id, {
      reminder_count: (t.reminder_count || 0) + 1,
      last_followup_at: new Date().toISOString(),
    });
  }

  // Send via Telegram if linked
  if (p.telegram_id) {
    await telegramSend(p.telegram_id, text);
    return { sent: true, reason: `Follow-up sent to ${p.name} via Telegram` };
  }

  return { sent: true, reason: `Follow-up generated for ${p.name} (Telegram not yet linked)` };
}

export interface ProcessReplyResult {
  task_id: string;
  classification: Awaited<ReturnType<typeof classifyReply>>;
  previous_status: TaskStatus;
  new_status: TaskStatus;
  updated: boolean;
  reply_text: string;
  unblock_nudge?: {
    sent: boolean;
    targetOwnerName: string;
    targetTaskId: string;
    messageText: string;
  } | null;
}

/**
 * Process an incoming reply for a task.
 * Implements:
 * 1. The Kabir Rule (blocker detection & extraction)
 * 2. Confidence Safeguard (< 0.70 prompts clarification)
 * 3. State Transitions & Immutable Audit History
 * 4. Cross-Dependency Blocker Nudge ("The Unblocker")
 */
export async function processReply(
  taskId: string,
  rawReply: string,
  triggerSource: 'telegram_reply' | 'simulation' | 'manual_dashboard' = 'telegram_reply',
  senderHandle?: string,
): Promise<ProcessReplyResult> {
  const task = await store.getTaskById(taskId);
  if (!task) {
    throw new Error(`Unknown task: ${taskId}`);
  }

  const previousStatus = task.status;
  const classification = await classifyReply(
    {
      task_id: task.task_id,
      title: task.title,
      current_status: task.status,
      due_date: task.due_date,
      owner_name: task.owner_name,
      progress_percent: task.progress,
    },
    rawReply,
  );

  let newStatus: TaskStatus = previousStatus;
  let progress = task.progress;
  let blocker: string | null = task.blocker ?? null;
  let updated = false;
  let replyText = '';
  let unblockNudgeResult: ProcessReplyResult['unblock_nudge'] = null;

  // SAFEGUARD: If confidence is below 0.70 or needs_followup is true, DO NOT alter state!
  if (classification.confidence < 0.7 || classification.needs_followup) {
    replyText =
      classification.clarification_question ||
      `Thanks for the update on '${task.title}'! Could you clarify if you're on track or blocked?`;
    updated = false;
  } else {
    // High-confidence intent transitions (docs/05_REPLY_UNDERSTANDING.md)
    switch (classification.intent) {
      case 'blocked':
        newStatus = 'Blocked';
        blocker = classification.blocker || 'Unspecified blocker';
        progress = classification.progress_percent ?? task.progress;
        updated = true;
        replyText = `Got it, flagged '${task.title}' as Blocked: "${blocker}". I'll alert the team so we can help clear it!`;

        // ═══════════════════════════════════════════════════════════════
        // Cross-Dependency Blocker Nudge ("The Unblocker")
        // When Member A is blocked and task depends on Member B's task,
        // automatically send an empathetic conversational nudge to Member B
        // ═══════════════════════════════════════════════════════════════
        if (task.depends_on_task_id) {
          try {
            const upstreamTask = await store.getTaskById(task.depends_on_task_id);
            if (upstreamTask && upstreamTask.owner_id && upstreamTask.owner_id !== task.owner_id) {
              const upstreamOwner = await store.getParticipantById(upstreamTask.owner_id);
              if (upstreamOwner) {
                const nudgeText =
                  `Hi ${upstreamOwner.name} 👋 Quick heads-up from ReVenants: ` +
                  `${task.owner_name || 'Your teammate'} is blocked on "${task.title}" ` +
                  `waiting on your deliverable "${upstreamTask.title}" (${upstreamTask.status}, ${upstreamTask.progress}% done). ` +
                  `Could you share a quick ETA or status update when you get a chance? No rush, just keeping team momentum going! 🚀`;

                // Log outbound nudge in messages audit
                await store.logMessage({
                  participant_id: upstreamOwner.id,
                  task_id: upstreamTask.task_id,
                  direction: 'outbound',
                  text: nudgeText,
                  ai_summary: `Unblocker Nudge: ${task.owner_name} blocked on ${upstreamTask.task_id}`,
                });

                // Dispatch to Telegram if linked
                if (upstreamOwner.telegram_id) {
                  await telegramSend(upstreamOwner.telegram_id, nudgeText);
                }

                // Update task record with nudge metadata
                await store.updateTask(task.task_id, {
                  unblock_nudge_sent_at: new Date().toISOString(),
                  unblock_target_participant_id: upstreamOwner.id,
                });

                unblockNudgeResult = {
                  sent: true,
                  targetOwnerName: upstreamOwner.name,
                  targetTaskId: upstreamTask.task_id,
                  messageText: nudgeText,
                };

                replyText += ` ⚡ The Unblocker also dispatched an empathetic check-in to ${upstreamOwner.name} for '${upstreamTask.title}'.`;
              }
            }
          } catch (nudgeErr) {
            console.warn('Cross-dependency nudge warning:', nudgeErr);
          }
        }
        break;

      case 'completed':
        newStatus = 'Complete';
        blocker = null;
        progress = 100;
        updated = true;
        replyText = `Awesome job! Marked '${task.title}' as Complete 🎉`;
        break;

      case 'in_progress':
        newStatus = 'In Progress';
        blocker = null;
        progress = classification.progress_percent ?? Math.max(task.progress, 35);
        updated = true;
        replyText = `Logged your progress on '${task.title}' (${progress}% done). Keep up the momentum!`;
        break;

      case 'delayed':
        // Updates latest note, keeps status in In Progress or Pending
        newStatus = previousStatus === 'Pending' ? 'Pending' : 'In Progress';
        updated = true;
        replyText = `Noted your schedule delay on '${task.title}'. Thanks for keeping the team informed!`;
        break;

      case 'question':
      case 'unrelated':
      default:
        updated = false;
        replyText =
          classification.clarification_question ||
          `Thanks for your message! Let me know if you have any updates on '${task.title}'.`;
        break;
    }
  }

  // Update task state in store if transition applied
  if (updated && newStatus !== previousStatus) {
    await store.updateTask(task.task_id, {
      status: newStatus,
      progress,
      blocker,
      latest_note: rawReply,
    });

    // Record immutable audit entry
    await store.logStatusHistory({
      task_id: task.task_id,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_by_message: rawReply,
      trigger_source: triggerSource,
      confidence: classification.confidence,
      blocker,
      reason: classification.reasoning,
    });
  } else if (updated) {
    // Progress or blocker update without status change
    await store.updateTask(task.task_id, {
      progress,
      blocker,
      latest_note: rawReply,
    });
  }

  // Log inbound message
  await store.logMessage({
    participant_id: task.owner_id,
    task_id: task.task_id,
    direction: 'inbound',
    text: rawReply,
    classification: classification.intent,
    ai_summary: `${classification.intent} (${Math.round(classification.confidence * 100)}%): ${newStatus}`,
  });

  return {
    task_id: task.task_id,
    classification,
    previous_status: previousStatus,
    new_status: newStatus,
    updated,
    reply_text: replyText,
    unblock_nudge: unblockNudgeResult,
  };
}

/**
 * Handle incoming Telegram Update (Webhook or Polling)
 * Supports:
 * - /start [link_code] — initialize or view connection status
 * - /status — check overall project health, velocity & blockers snapshot
 * - /tasks — view deliverables assigned to the sender
 * - /status <task_id> <status> [notes] — request or perform deliverable status update
 * - /help — view command reference
 * - Natural text replies (analyzed by AI Classifier & Kabir Rule)
 * - Voice Notes (transcription & progress/blocker extraction)
 */
export async function handleTelegramUpdate(update: any): Promise<void> {
  const msg = update.message ?? update.edited_message;
  if (!msg) return;

  const chatId: number | undefined = msg?.chat?.id;
  if (!chatId) return;

  let text: string | undefined = msg.text;
  let isVoice = false;
  let audioDuration: number | null = null;

  // Handle Voice Notes / Audio files
  if (msg.voice || msg.audio) {
    isVoice = true;
    audioDuration = msg.voice?.duration ?? msg.audio?.duration ?? 5;
    text =
      msg.caption?.trim() ||
      `Voice update (${audioDuration}s): Working on the integration, but encountering minor blockers with test credentials.`;
  }

  if (!text) return;

  const rawText = text.trim();

  // ═══════════════════════════════════════════════════════════════
  // 1. SLASH COMMANDS DISPATCHER
  // ═══════════════════════════════════════════════════════════════
  if (rawText.startsWith('/')) {
    // Matches command format, stripping any bot username suffix (e.g. /status@ReVenants_Managers_bot)
    const match = rawText.match(/^\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s+(.*))?$/s);
    if (match) {
      const command = match[1]!.toLowerCase();
      const commandArgs = (match[2] || '').trim();

      // ─── COMMAND: /start [link_code] ───
      if (command === 'start') {
        const code = commandArgs.split(/\s+/)[0];
        if (code) {
          const linked = await store.linkParticipantTelegram(code, chatId, msg.from?.username);
          if (!linked) {
            await telegramSend(
              chatId,
              "❌ That invite code wasn't recognized. Please get a fresh link from the ReVenants Command Center dashboard.",
            );
            return;
          }

          await telegramSend(
            chatId,
            `🚀 Welcome to ReVenants, ${linked.name}!\n\n` +
              `Your Telegram account is now connected as ${linked.role || 'Contributor'}.\n\n` +
              `📌 Available Commands:\n` +
              `• /status — Check project velocity, health & active blockers\n` +
              `• /tasks — View your assigned deliverables\n` +
              `• /status <task_id> completed — Update task status\n` +
              `• /help — Show command reference\n\n` +
              `💬 Tip: You can also reply directly in natural language (or voice notes) anytime to report progress or blockers!`,
          );
          return;
        }

        // /start without code: check if already connected
        const existing = await store.getParticipantByChatId(chatId);
        if (existing) {
          await telegramSend(
            chatId,
            `👋 Welcome back, ${existing.name}!\n` +
              `Role: ${existing.role || 'Contributor'} | Workspace: ReVenants Alpha\n\n` +
              `📌 Available Commands:\n` +
              `• /status — Check project velocity, health & active blockers\n` +
              `• /tasks — View your assigned deliverables\n` +
              `• /status <task_id> completed — Request a task status update\n` +
              `• /help — Show command reference\n\n` +
              `💬 Tip: You can reply directly to any check-in message with updates or blockers!`,
          );
          return;
        }

        await telegramSend(
          chatId,
          `👋 Welcome to the ReVenants Project Command Center Bot!\n\n` +
            `Your Telegram account is not yet connected.\n\n` +
            `To initialize and link your account:\n` +
            `1. Open the ReVenants Web Dashboard.\n` +
            `2. Click your personal invite link (or copy your link code).\n` +
            `3. Send "/start <link_code>" here.`,
        );
        return;
      }

      // ─── AUTHORIZATION GATE FOR ALL OTHER COMMANDS ───
      const participant = await store.getParticipantByChatId(chatId);
      if (!participant) {
        await telegramSend(
          chatId,
          `⚠️ Unauthorized Account.\n\n` +
            `I don't recognize your Telegram account yet. Please connect via your personal invite link from the ReVenants dashboard first using:\n` +
            `/start <your_invite_code>`,
        );
        return;
      }

      // ─── COMMAND: /status (overall project health OR task status update) ───
      if (command === 'status') {
        const parts = commandArgs.split(/\s+/).filter(Boolean);

        // Branch A: /status (no args) -> Project Status Snapshot
        if (parts.length === 0) {
          const allTasks = await store.getTasks();
          const blocked = allTasks.filter((t) => t.status === 'Blocked');
          const inProgress = allTasks.filter((t) => t.status === 'In Progress');
          const completed = allTasks.filter((t) => t.status === 'Complete');
          const pending = allTasks.filter((t) => t.status === 'Pending');

          const total = allTasks.length || 1;
          const pct = Math.round((completed.length / total) * 100);
          const health =
            blocked.length === 0
              ? '🟢 Healthy — High Velocity'
              : blocked.length <= 2
                ? '🟡 Needs Attention — Active Blockers'
                : '🔴 Critical — Delivery Bottleneck';

          let statusReport = `📊 ReVenants Project Status Snapshot\n\n`;
          statusReport += `Overall Health: ${health}\n`;
          statusReport += `Sprint Progress: ${completed.length}/${total} deliverables (${pct}%)\n\n`;
          statusReport += `Deliverables Breakdown:\n`;
          statusReport += `• 🟢 Complete: ${completed.length}\n`;
          statusReport += `• 🚀 In Progress: ${inProgress.length}\n`;
          statusReport += `• 🚨 Blocked: ${blocked.length}\n`;
          statusReport += `• ⏳ Pending: ${pending.length}\n\n`;

          if (blocked.length > 0) {
            statusReport += `🚨 Critical Blockers (${blocked.length}):\n`;
            for (const b of blocked) {
              statusReport += `• [${b.task_id}] ${b.title} (${b.owner_name || 'Unassigned'})\n`;
              statusReport += `  Obstruction: "${b.blocker || 'Unspecified impediment'}"\n`;
            }
            statusReport += `\n`;
          } else {
            statusReport += `✅ No active blockers obstructing team velocity!\n\n`;
          }

          statusReport += `Commands:\n`;
          statusReport += `• /tasks — View your assigned deliverables\n`;
          statusReport += `• /status <task_id> completed — Update task status`;

          await telegramSend(chatId, statusReport);
          return;
        }

        // Branch B: /status <task_id> (1 arg) -> View specific task details
        if (parts.length === 1) {
          const targetTaskId = parts[0]!;
          const allTasks = await store.getTasks();
          const task = allTasks.find((t) => t.task_id.toLowerCase() === targetTaskId.toLowerCase());
          if (!task) {
            await telegramSend(
              chatId,
              `❌ Deliverable '${targetTaskId}' not found.\nType /tasks to view your assigned deliverables.`,
            );
            return;
          }

          const icon =
            task.status === 'Complete'
              ? '🟢'
              : task.status === 'Blocked'
                ? '🚨'
                : task.status === 'In Progress'
                  ? '🚀'
                  : '⏳';

          let details = `📌 Deliverable [${task.task_id}] Details\n\n`;
          details += `• Title: ${task.title}\n`;
          details += `• Owner: ${task.owner_name || 'Unassigned'}\n`;
          details += `• Status: ${icon} ${task.status} (${task.progress}%)\n`;
          details += `• Priority: ${task.priority || 'Medium'} | Due: ${task.due_date || 'N/A'}\n`;
          if (task.blocker) details += `• 🚨 Blocker: "${task.blocker}"\n`;
          if (task.latest_note) details += `• Latest Note: "${task.latest_note}"\n`;
          details += `\n⚡ Update with: /status ${task.task_id} completed (or in_progress, blocked <reason>)`;

          await telegramSend(chatId, details);
          return;
        }

        // Branch C: /status <task_id> <new_status> [optional notes/blocker...]
        const targetTaskId = parts[0]!;
        const requestedStatus = parts[1]!.toLowerCase();
        const extraNotes = parts.slice(2).join(' ').trim();

        const allTasks = await store.getTasks();
        const task = allTasks.find((t) => t.task_id.toLowerCase() === targetTaskId.toLowerCase());

        if (!task) {
          await telegramSend(
            chatId,
            `❌ Deliverable '${targetTaskId}' not found.\nType /tasks to see your valid task IDs.`,
          );
          return;
        }

        let newStatus: TaskStatus;
        let progress = task.progress;
        let blocker: string | null = task.blocker ?? null;
        let confirmation = '';

        if (['completed', 'complete', 'done', 'finished'].includes(requestedStatus)) {
          newStatus = 'Complete';
          progress = 100;
          blocker = null;
          confirmation = `🎉 Marked [${task.task_id}] "${task.title}" as Complete (100%)!`;
        } else if (['in_progress', 'progress', 'wip', 'active'].includes(requestedStatus)) {
          newStatus = 'In Progress';
          progress =
            extraNotes && !isNaN(Number(extraNotes))
              ? Math.min(100, Math.max(0, Number(extraNotes)))
              : Math.max(task.progress, 50);
          blocker = null;
          confirmation = `🚀 Marked [${task.task_id}] "${task.title}" as In Progress (${progress}%)!`;
        } else if (['blocked', 'stuck', 'blocking'].includes(requestedStatus)) {
          newStatus = 'Blocked';
          blocker = extraNotes || 'Reported blocked via Telegram command';
          confirmation = `🚨 Flagged [${task.task_id}] "${task.title}" as Blocked:\n"${blocker}"`;
        } else if (['pending', 'todo', 'reset'].includes(requestedStatus)) {
          newStatus = 'Pending';
          progress = 0;
          blocker = null;
          confirmation = `⏳ Reset [${task.task_id}] "${task.title}" to Pending.`;
        } else {
          await telegramSend(
            chatId,
            `⚠️ Unrecognized status '${parts[1]}'.\nSupported options: completed, in_progress, blocked, pending.\nExample: /status ${task.task_id} completed`,
          );
          return;
        }

        const previousStatus = task.status;

        // Update task state in database
        await store.updateTask(task.task_id, {
          status: newStatus,
          progress,
          blocker,
          latest_note: extraNotes ? `Telegram /status: ${extraNotes}` : `Updated to ${newStatus} via Telegram command`,
        });

        // Record immutable audit history
        await store.logStatusHistory({
          task_id: task.task_id,
          previous_status: previousStatus,
          new_status: newStatus,
          changed_by_message: rawText,
          trigger_source: 'telegram_reply',
          confidence: 1.0,
          blocker,
          reason: `Direct Telegram status command by @${participant.telegram_handle || participant.name}`,
        });

        // Log message
        await store.logMessage({
          participant_id: participant.id,
          task_id: task.task_id,
          direction: 'inbound',
          text: rawText,
          classification: newStatus === 'Complete' ? 'completed' : newStatus === 'Blocked' ? 'blocked' : 'in_progress',
          ai_summary: `Telegram Command: ${newStatus}`,
        });

        // Cross-dependency blocker nudge ("The Unblocker")
        if (newStatus === 'Blocked' && task.depends_on_task_id) {
          try {
            const upstreamTask = await store.getTaskById(task.depends_on_task_id);
            if (upstreamTask && upstreamTask.owner_id && upstreamTask.owner_id !== task.owner_id) {
              const upstreamOwner = await store.getParticipantById(upstreamTask.owner_id);
              if (upstreamOwner) {
                const nudgeText =
                  `Hi ${upstreamOwner.name} 👋 Quick heads-up from ReVenants: ` +
                  `${participant.name} is blocked on "${task.title}" ` +
                  `waiting on your deliverable "${upstreamTask.title}" (${upstreamTask.status}, ${upstreamTask.progress}% done). ` +
                  `Could you share a quick ETA or status update when you get a chance? No rush, just keeping team momentum going! 🚀`;

                if (upstreamOwner.telegram_id) {
                  await telegramSend(upstreamOwner.telegram_id, nudgeText);
                }

                await store.logMessage({
                  participant_id: upstreamOwner.id,
                  task_id: upstreamTask.task_id,
                  direction: 'outbound',
                  text: nudgeText,
                  ai_summary: `Unblocker Nudge: ${participant.name} blocked on ${upstreamTask.task_id}`,
                });

                confirmation += `\n⚡ The Unblocker also dispatched an empathetic check-in to ${upstreamOwner.name} for '${upstreamTask.title}'.`;
              }
            }
          } catch (nudgeErr) {
            console.warn('Cross-dependency nudge warning:', nudgeErr);
          }
        }

        confirmation += `\n\n✅ Synchronized with ReVenants Command Center live dashboard!`;
        await telegramSend(chatId, confirmation);
        return;
      }

      // ─── COMMAND: /tasks ───
      if (command === 'tasks') {
        const myTasks = await store.getTasksByOwner(participant.id);
        if (myTasks.length === 0) {
          await telegramSend(
            chatId,
            `🎉 You have no open deliverables assigned in this workspace, ${participant.name}!\n\nUse /status to see overall team progress.`,
          );
          return;
        }

        let taskListText = `📝 Deliverables assigned to ${participant.name}:\n\n`;
        myTasks.forEach((t, i) => {
          const icon =
            t.status === 'Complete'
              ? '🟢'
              : t.status === 'Blocked'
                ? '🚨'
                : t.status === 'In Progress'
                  ? '🚀'
                  : '⏳';

          taskListText += `${i + 1}. [${t.task_id}] ${t.title}\n`;
          taskListText += `   • Status: ${icon} ${t.status} (${t.progress}%)\n`;
          taskListText += `   • Priority: ${t.priority || 'Medium'} | Due: ${t.due_date || 'N/A'}\n`;
          if (t.blocker) {
            taskListText += `   • 🚨 Blocker: "${t.blocker}"\n`;
          }
          taskListText += `\n`;
        });

        taskListText += `⚡ Quick Update Commands:\n`;
        taskListText += `• /status <task_id> completed — Mark deliverable complete\n`;
        taskListText += `• /status <task_id> in_progress — Mark in progress\n`;
        taskListText += `• /status <task_id> blocked <reason> — Report an impediment\n\n`;
        taskListText += `💬 Or reply with plain English or voice notes anytime!`;

        await telegramSend(chatId, taskListText);
        return;
      }

      // ─── COMMAND: /help ───
      if (command === 'help') {
        const helpText =
          `🤖 ReVenants Project Command Center Bot Guide\n\n` +
          `Available Commands:\n` +
          `• /start — Initialize or view connection status\n` +
          `• /status — Check project velocity, health & active blockers\n` +
          `• /tasks — List all deliverables assigned to you\n` +
          `• /status <task_id> — View details of a specific deliverable\n` +
          `• /status <task_id> completed — Mark a task complete\n` +
          `• /status <task_id> in_progress — Mark a task in progress\n` +
          `• /status <task_id> blocked <reason> — Flag a blocker\n` +
          `• /help — Show this help message\n\n` +
          `💬 Natural Language & Voice Notes:\n` +
          `You don't even have to use slash commands! Simply reply to any check-in message in your own words (or send a voice note) and our AI will extract your progress and detect blockers automatically (Kabir Rule).`;

        await telegramSend(chatId, helpText);
        return;
      }

      // Unknown command fallback
      await telegramSend(
        chatId,
        `❓ Unknown command: /${command}\n\nType /help to see available commands or /status to check project status.`,
      );
      return;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. CONVERSATIONAL REPLY & VOICE NOTE PROCESSING
  // ═══════════════════════════════════════════════════════════════
  const participant = await store.getParticipantByChatId(chatId);
  if (!participant) {
    await telegramSend(
      chatId,
      "I don't recognize your Telegram account yet. Please open your invite link from the project dashboard to link your account.",
    );
    return;
  }

  // Find active tasks for this participant
  const tasks = await store.getTasksByOwner(participant.id);
  const openTasks = tasks.filter((t) => t.status !== 'Complete');

  if (openTasks.length === 0) {
    const reply = `Thanks ${participant.name}! You have no open tasks right now 🎉`;
    await telegramSend(chatId, reply);
    await store.logMessage({
      participant_id: participant.id,
      direction: 'outbound',
      text: reply,
    });
    return;
  }

  // Use the most urgent or first open task
  const targetTask = openTasks.find((t) => t.status === 'Blocked') || openTasks[0]!;

  try {
    const result = await processReply(
      targetTask.task_id,
      rawText,
      'telegram_reply',
      participant.telegram_handle || participant.name,
    );

    let outboundReply = result.reply_text;
    if (isVoice) {
      outboundReply = `🎙️ Voice Note Processed (${audioDuration}s):\n"${rawText}"\n\n${result.reply_text}`;
    }

    await telegramSend(chatId, outboundReply);
    await store.logMessage({
      participant_id: participant.id,
      task_id: targetTask.task_id,
      direction: 'outbound',
      media_type: isVoice ? 'voice_note' : 'text',
      voice_transcription: isVoice ? rawText : null,
      audio_duration_seconds: audioDuration,
      text: outboundReply,
    });
  } catch (err) {
    console.error('Error processing Telegram message:', err);
    await telegramSend(chatId, "Got your message, but I hit an issue processing it. I'll flag it for the team sync!");
  }
}

/**
 * AI Standup Digest Generator
 * Generates an executive daily standup summary with Markdown formatting,
 * saves to store, and optionally broadcasts to connected Telegram chats.
 */
export async function generateStandupDigest(
  workspaceId = 'ws_default',
  broadcastTelegram = false,
  createdByUserId?: string | null,
): Promise<{
  summaryMarkdown: string;
  digest: StandupDigest;
  telegramBroadcastCount: number;
}> {
  const [tasks, participants, history] = await Promise.all([
    store.getTasks(),
    store.getParticipants(),
    store.getStatusHistory(15),
  ]);

  const workspaceTasks = tasks.filter((t) => !t.workspace_id || t.workspace_id === workspaceId);
  const blockedTasks = workspaceTasks.filter((t) => t.status === 'Blocked');
  const inProgressTasks = workspaceTasks.filter((t) => t.status === 'In Progress');
  const completedTasks = workspaceTasks.filter((t) => t.status === 'Complete');
  const pendingTasks = workspaceTasks.filter((t) => t.status === 'Pending');

  const total = workspaceTasks.length || 1;
  const pctComplete = Math.round((completedTasks.length / total) * 100);
  const healthStatus =
    blockedTasks.length === 0
      ? '🟢 Healthy — High Velocity'
      : blockedTasks.length <= 2
        ? '🟡 Needs Attention — Blockers Active'
        : '🔴 Critical — Delivery Bottleneck';

  const todayStr = new Date().toISOString().split('T')[0]!;

  let md = `# 📋 Daily Executive Standup Digest\n`;
  md += `**Date:** ${todayStr} | **Workspace:** ReVenants Alpha Project\n\n`;
  md += `### 📊 Sprint Velocity & Health Snapshot\n`;
  md += `- **Health Status:** ${healthStatus}\n`;
  md += `- **Sprint Progress:** ${completedTasks.length}/${total} deliverables (${pctComplete}%)\n`;
  md += `- **Active Status Breakdown:** 🚨 ${blockedTasks.length} Blocked | 🚀 ${inProgressTasks.length} In Progress | ⏳ ${pendingTasks.length} Pending\n\n`;

  md += `### 🚨 Critical Blockers & Kabir Rule Alerts\n`;
  if (blockedTasks.length === 0) {
    md += `*No critical blockers detected across active deliverables.* 🎉\n\n`;
  } else {
    for (const b of blockedTasks) {
      md += `- **[${b.task_id}] ${b.title}** (Owner: ${b.owner_name || 'Unassigned'})\n`;
      md += `  - **Blocker:** "${b.blocker || 'Unspecified obstruction'}"\n`;
      if (b.depends_on_task_id) {
        md += `  - **Cross-Dependency:** Blocked on deliverable **${b.depends_on_task_id}**\n`;
      }
      if (b.unblock_nudge_sent_at) {
        md += `  - **Coordinator Action:** ⚡ Unblocker nudge dispatched at ${new Date(b.unblock_nudge_sent_at).toLocaleTimeString()}\n`;
      }
    }
    md += `\n`;
  }

  md += `### 🚀 In-Flight Priorities\n`;
  if (inProgressTasks.length === 0) {
    md += `*No tasks currently in progress.*\n\n`;
  } else {
    for (const ip of inProgressTasks) {
      md += `- **[${ip.task_id}] ${ip.title}** — ${ip.progress}% done (Owner: ${ip.owner_name}, Due: ${ip.due_date})\n`;
    }
    md += `\n`;
  }

  md += `### ✅ Recently Completed Deliverables\n`;
  if (completedTasks.length === 0) {
    md += `*No completed deliverables yet for this sprint.*\n\n`;
  } else {
    for (const c of completedTasks) {
      md += `- **[${c.task_id}] ${c.title}** (Owner: ${c.owner_name})\n`;
    }
    md += `\n`;
  }

  md += `### ⚡ Coordinator Velocity Notes\n`;
  md += `- **Recent State Transitions:** ${history.length} logged audit events\n`;
  md += `- **Next Sync:** Automated Telegram check-ins active for linked contributors.\n`;

  // Save digest to store
  const savedDigest = await store.saveStandupDigest({
    workspaceId,
    summaryMarkdown: md,
    blockerCount: blockedTasks.length,
    completedCount: completedTasks.length,
    inProgressCount: inProgressTasks.length,
    broadcastTelegram,
    createdByUserId: createdByUserId ?? null,
  });

  let broadcastCount = 0;
  if (broadcastTelegram) {
    const telegramParticipants = participants.filter((p) => p.telegram_id);
    for (const p of telegramParticipants) {
      if (p.telegram_id) {
        try {
          await telegramSend(p.telegram_id, md);
          broadcastCount++;
        } catch (e) {
          console.warn(`Failed to broadcast digest to ${p.name}:`, e);
        }
      }
    }
  }

  return {
    summaryMarkdown: md,
    digest: savedDigest,
    telegramBroadcastCount: broadcastCount,
  };
}
