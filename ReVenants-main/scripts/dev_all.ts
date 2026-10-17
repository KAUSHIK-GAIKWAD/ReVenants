/**
 * Run Web Dashboard & Telegram Bot Polling concurrently
 * Usage: npm run dev:all or npx tsx scripts/dev_all.ts
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

console.log('🚀 Launching ReVenants Command Center & Live Telegram Bot Poller...\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const port = process.env['PORT'] || '8080';

// 1. Start Vite Web App (bound to 0.0.0.0 for Render/cloud support)
const devProcess = spawn(npmCmd, ['run', 'dev', '--', '--host', '0.0.0.0', '--port', port], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
});

// 2. Start Telegram Bot Poller
const botProcess = spawn(npmCmd, ['run', 'bot:poll'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
});

function cleanup() {
  console.log('\n🛑 Shutting down ReVenants processes...');
  try {
    devProcess.kill();
  } catch {}
  try {
    botProcess.kill();
  } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
