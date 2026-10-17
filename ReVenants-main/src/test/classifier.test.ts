import { describe, expect, it } from 'vitest';
import { classifyReplyOffline } from '../lib/classifier';
import type { TaskContext } from '../lib/classifier';

describe('Classifier Engine (prompts/classifier_system_prompt_v1.md)', () => {
  const kabirTask: TaskContext = {
    task_id: 'TASK-103',
    title: 'Connect the payment API',
    current_status: 'Pending',
    due_date: '2025-11-13',
    owner_name: 'Kabir Patel',
    progress_percent: 0,
  };

  it('implements the Kabir Rule: blocker overrides partial progress', () => {
    const reply = 'connected, but waiting for test credentials';
    const result = classifyReplyOffline(kabirTask, reply);

    expect(result.task_id).toBe('TASK-103');
    expect(result.intent).toBe('blocked');
    expect(result.blocker?.toLowerCase()).toContain('waiting for test credentials');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.needs_followup).toBe(false);
  });

  it('detects explicit completion', () => {
    const task: TaskContext = {
      task_id: 'TASK-101',
      title: 'Setup database schema',
      current_status: 'In Progress',
      owner_name: 'Alex Morgan',
    };
    const reply = 'Just pushed the schema migrations to main and tested locally, all good!';
    const result = classifyReplyOffline(task, reply);

    expect(result.intent).toBe('completed');
    expect(result.progress_percent).toBe(100);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.needs_followup).toBe(false);
  });

  it('handles ambiguous replies with low confidence safeguard (< 0.70)', () => {
    const task: TaskContext = {
      task_id: 'TASK-102',
      title: 'Build User Authentication API',
      current_status: 'In Progress',
      owner_name: 'Maya Chen',
    };
    const reply = 'almost done';
    const result = classifyReplyOffline(task, reply);

    expect(result.intent).toBe('in_progress');
    expect(result.confidence).toBeLessThan(0.7);
    expect(result.needs_followup).toBe(true);
    expect(result.clarification_question).toBeTruthy();
  });

  it('identifies questions without altering state', () => {
    const reply = 'Are we supposed to use Stripe checkout or custom card forms?';
    const result = classifyReplyOffline(kabirTask, reply);

    expect(result.intent).toBe('question');
    expect(result.needs_followup).toBe(true);
  });

  it('identifies schedule delays without technical blockers', () => {
    const reply = "Can't get to this tonight due to midterms, starting Friday";
    const result = classifyReplyOffline(kabirTask, reply);

    expect(result.intent).toBe('delayed');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });
});
