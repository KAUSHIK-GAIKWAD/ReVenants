import fs from 'node:fs';
import path from 'node:path';

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import { processReply } from '../src/lib/coordinator.server';
import * as store from '../src/lib/store';

async function testUnblocker() {
  console.log('🔍 Testing "The Unblocker" Cross-Dependency Engine...\n');

  // Verify task_01 depends on task_02
  const task01 = await store.getTaskById('task_01');
  const task02 = await store.getTaskById('task_02');
  console.log(`Task 01: [${task01?.task_id}] "${task01?.title}" (Owner: ${task01?.owner_id})`);
  console.log(`  Depends on: ${task01?.depends_on_task_id}`);
  console.log(`Task 02: [${task02?.task_id}] "${task02?.title}" (Owner: ${task02?.owner_id})\n`);

  // Kabir reports he is blocked waiting on Ananya's deliverable
  console.log('⚡ Incoming message from Kabir: "waiting for checkout screens from ananya"');
  const result = await processReply('task_01', 'waiting for checkout screens from ananya', 'simulation', 'kabir_dev');

  console.log('\n--- 🎯 RESULT OF PROCESSREPLY ---');
  console.log('Status updated:', result.updated);
  console.log('New status:', result.new_status);
  console.log('Reply to Kabir:', result.reply_text);
  console.log('\n--- 🚀 UNBLOCKER NUDGE DISPATCHED ---');
  console.log('Nudge Result:', JSON.stringify(result.unblock_nudge, null, 2));

  // Check messages audit log for the outbound nudge
  const messages = await store.getMessages(10);
  const latestMessage = messages[0];
  console.log('\n--- 📜 LATEST AUDIT LOGGED MESSAGE ---');
  console.log('Direction:', latestMessage?.direction);
  console.log('To Participant:', latestMessage?.participant_id);
  console.log('Text:', latestMessage?.text);
}

testUnblocker().catch(console.error);
