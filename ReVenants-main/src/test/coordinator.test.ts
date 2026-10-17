import { describe, expect, it } from 'vitest';
import { processReply, handleTelegramUpdate } from '../lib/coordinator.server';
import * as store from '../lib/store';

describe('Coordinator State Transitions & Audit Log (docs/04_DATA_MODEL.md & docs/05_REPLY_UNDERSTANDING.md)', () => {
  it('executes the Kabir scenario: transitions Pending -> Blocked and writes immutable audit record', async () => {
    store.initializeSeedData();

    // Kabir replies with the canonical prompt
    const result = await processReply(
      'TASK-103',
      'connected, but waiting for test credentials',
      'simulation',
      'kabir_p',
    );

    expect(result.task_id).toBe('TASK-103');
    expect(result.previous_status).toBe('Pending');
    expect(result.new_status).toBe('Blocked');
    expect(result.updated).toBe(true);
    expect(result.classification.intent).toBe('blocked');
    expect(result.classification.blocker?.toLowerCase()).toContain('waiting for test credentials');

    // Verify task state in store
    const task = await store.getTaskById('TASK-103');
    expect(task?.status).toBe('Blocked');
    expect(task?.blocker?.toLowerCase()).toContain('waiting for test credentials');

    // Verify audit log has the verbatim message and confidence score
    const history = await store.getStatusHistory();
    const latest = history[0];
    expect(latest?.task_id).toBe('TASK-103');
    expect(latest?.previous_status).toBe('Pending');
    expect(latest?.new_status).toBe('Blocked');
    expect(latest?.changed_by_message).toBe('connected, but waiting for test credentials');
    expect(latest?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('safeguards ambiguous replies: keeps status unchanged when confidence < 0.70', async () => {
    store.initializeSeedData();

    const taskBefore = await store.getTaskById('TASK-102');
    const statusBefore = taskBefore?.status;

    const result = await processReply('TASK-102', 'almost done', 'simulation', 'maya_c');

    expect(result.classification.confidence).toBeLessThan(0.7);
    expect(result.updated).toBe(false);

    // Status remains unchanged
    const taskAfter = await store.getTaskById('TASK-102');
    expect(taskAfter?.status).toBe(statusBefore);
    // Clarification question is provided in response
    expect(result.reply_text).toBeTruthy();
  });

  it('triggers the Cross-Dependency Blocker Nudge when Member A is blocked by Member B', async () => {
    store.initializeSeedData();

    // TASK-103 depends on TASK-102 (owned by Maya Chen)
    const result = await processReply(
      'TASK-103',
      'totally blocked waiting on auth credentials from maya',
      'simulation',
      'kabir_p',
    );

    expect(result.new_status).toBe('Blocked');
    expect(result.unblock_nudge).toBeTruthy();
    expect(result.unblock_nudge?.sent).toBe(true);
    expect(result.unblock_nudge?.targetOwnerName).toBe('Maya Chen');
    expect(result.unblock_nudge?.targetTaskId).toBe('TASK-102');

    // Verify task record received nudge metadata
    const task = await store.getTaskById('TASK-103');
    expect(task?.unblock_nudge_sent_at).toBeTruthy();
  });

  describe('Telegram Bot Commands Synchronizer', () => {
    it('handles /start with invite code to link account and subsequent /start greeting', async () => {
      store.initializeSeedData();

      // Find participant with link code
      const participants = await store.getParticipants();
      const testParticipant = participants[0]!;
      const testChatId = 998877665;

      // Link account via /start <link_code>
      await handleTelegramUpdate({
        message: {
          chat: { id: testChatId },
          text: `/start ${testParticipant.link_code}`,
          from: { username: 'testuser' },
        },
      });

      const linked = await store.getParticipantByChatId(testChatId);
      expect(linked).toBeTruthy();
      expect(linked?.id).toBe(testParticipant.id);

      // Subsequent /start without code greets recognized user
      await handleTelegramUpdate({
        message: {
          chat: { id: testChatId },
          text: '/start',
          from: { username: 'testuser' },
        },
      });
    });

    it('rejects unauthorized users trying to run /status or /tasks', async () => {
      store.initializeSeedData();
      const unauthorizedChatId = 123459999;

      // Should not throw, sends unauthorized notice
      await handleTelegramUpdate({
        message: {
          chat: { id: unauthorizedChatId },
          text: '/status',
        },
      });

      await handleTelegramUpdate({
        message: {
          chat: { id: unauthorizedChatId },
          text: '/tasks',
        },
      });
    });

    it('executes /status task_id completed and synchronizes with task store', async () => {
      store.initializeSeedData();

      const participants = await store.getParticipants();
      const participant = participants[0]!;
      const chatId = 88776655;

      // Link participant
      await store.linkParticipantTelegram(participant.link_code, chatId, 'active_dev');

      const tasks = await store.getTasksByOwner(participant.id);
      expect(tasks.length).toBeGreaterThan(0);
      const targetTask = tasks[0]!;

      // Execute /status task_id completed
      await handleTelegramUpdate({
        message: {
          chat: { id: chatId },
          text: `/status ${targetTask.task_id} completed`,
        },
      });

      // Verify task in store is now Complete with 100% progress
      const updated = await store.getTaskById(targetTask.task_id);
      expect(updated?.status).toBe('Complete');
      expect(updated?.progress).toBe(100);
      expect(updated?.blocker).toBeNull();

      // Verify audit history record was logged
      const history = await store.getStatusHistory();
      const latest = history[0];
      expect(latest?.task_id).toBe(targetTask.task_id);
      expect(latest?.new_status).toBe('Complete');
      expect(latest?.trigger_source).toBe('telegram_reply');
    });

    it('executes /status snapshot and /tasks for connected user', async () => {
      store.initializeSeedData();
      const participants = await store.getParticipants();
      const participant = participants[0]!;
      const chatId = 77665544;

      await store.linkParticipantTelegram(participant.link_code, chatId, 'user_dash');

      // Project status snapshot
      await handleTelegramUpdate({
        message: {
          chat: { id: chatId },
          text: '/status',
        },
      });

      // User tasks list
      await handleTelegramUpdate({
        message: {
          chat: { id: chatId },
          text: '/tasks',
        },
      });
    });
  });
});


