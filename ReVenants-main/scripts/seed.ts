/**
 * Seed tasks and participants from data/sample_tasks.csv
 * Run with: npx tsx scripts/seed.ts
 */

import { initializeSeedData, getTasks, getParticipants } from '../src/lib/store';

async function main() {
  console.log('🌱 Seeding database from data/sample_tasks.csv...');
  initializeSeedData();

  const [participants, tasks] = await Promise.all([getParticipants(), getTasks()]);

  console.log(`\n✅ Seed Complete!`);
  console.log(`- Team Members (${participants.length}):`);
  for (const p of participants) {
    console.log(`  • ${p.name} (${p.telegram_handle || 'no handle'}) — Role: ${p.role}`);
  }

  console.log(`\n- Tasks Loaded (${tasks.length}):`);
  for (const t of tasks) {
    console.log(`  • [${t.task_id}] ${t.title} -> ${t.status} (${t.owner_name}) [Priority: ${t.priority}]`);
  }
}

main().catch(console.error);
