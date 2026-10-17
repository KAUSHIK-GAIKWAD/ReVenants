import { describe, expect, it } from 'vitest';
import * as store from '../lib/store';

describe('Data Model & Seed Alignment (docs/04_DATA_MODEL.md & data/sample_tasks.csv)', () => {
  it('loads all 8 sample tasks with owners and priorities', async () => {
    store.initializeSeedData();

    const tasks = await store.getTasks();
    expect(tasks.length).toBe(8);

    const task101 = await store.getTaskById('TASK-101');
    expect(task101?.title).toBe('Setup database schema');
    expect(task101?.status).toBe('Complete');
    expect(task101?.priority).toBe('High');

    const task103 = await store.getTaskById('TASK-103');
    expect(task103?.title).toBe('Connect the payment API');
    expect(task103?.owner_name).toBe('Kabir Patel');
    expect(task103?.priority).toBe('Urgent');
    expect(task103?.depends_on_task_id).toBe('TASK-102');
  });

  it('contains the four standard team members', async () => {
    store.initializeSeedData();

    const participants = await store.getParticipants();
    expect(participants.length).toBeGreaterThanOrEqual(4);

    const names = participants.map((p) => p.name);
    expect(names).toContain('Kabir Patel');
    expect(names).toContain('Maya Chen');
    expect(names).toContain('Alex Morgan');
    expect(names).toContain('Sara Al-Mansoor');
  });
});
