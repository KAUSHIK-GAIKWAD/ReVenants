/**
 * Submit a simulated member reply to the running ReVenants server.
 * Run with: npx tsx scripts/simulate_reply.ts [--task TASK-103] [--reply "connected, but waiting for test credentials"]
 */

const port = process.env.PORT || '3000';
const baseUrl = process.env.SERVER_URL || `http://127.0.0.1:${port}`;

// Parse CLI args
const args = process.argv.slice(2);
let taskId = 'TASK-103';
let reply = 'connected, but waiting for test credentials';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--task' && args[i + 1]) {
    taskId = args[i + 1]!;
    i++;
  } else if (args[i] === '--reply' && args[i + 1]) {
    reply = args[i + 1]!;
    i++;
  }
}

async function run() {
  console.log(`📡 Simulating reply for ${taskId} -> "${reply}"`);
  console.log(`Connecting to ${baseUrl}/api/simulate-reply...`);

  try {
    const res = await fetch(`${baseUrl}/api/simulate-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, reply }),
    });

    if (!res.ok) {
      console.error(`HTTP error ${res.status}: ${await res.text()}`);
      process.exit(1);
    }

    const body = await res.json();
    console.log('\n✅ Response received:');
    console.log(JSON.stringify(body, null, 2));
    console.log(`\nConfirmed: ${body.previous_status} → ${body.new_status}`);
    console.log(`Intent: ${body.classification?.intent?.toUpperCase()} | Confidence: ${Math.round(body.classification?.confidence * 100)}%`);
    if (body.classification?.blocker) {
      console.log(`🚨 Blocker: "${body.classification.blocker}"`);
    }
  } catch (err) {
    console.error('Simulation connection failed:', err);
    console.log('\nMake sure the app dev server is running (npm run dev)');
  }
}

run();
