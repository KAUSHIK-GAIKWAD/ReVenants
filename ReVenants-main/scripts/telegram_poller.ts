/**
 * Standalone Telegram Polling Worker
 * Fetches updates from Telegram Bot API and feeds them to handleTelegramUpdate.
 * Run with: npx tsx scripts/telegram_poller.ts or npm run bot:poll
 */

import fs from 'node:fs';
import path from 'node:path';

// 1. Bulletproof environment loading
try {
  process.loadEnvFile?.('.env');
} catch {}

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
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { handleTelegramUpdate } from '../src/lib/coordinator.server';

const botToken = process.env['TELEGRAM_BOT_TOKEN']?.trim();
const botUsername = process.env['TELEGRAM_BOT_USERNAME']?.trim() || 'ReVenants_Managers_bot';

if (!botToken) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN is not configured in environment or .env');
  console.log('To run Telegram polling:');
  console.log('1. Set TELEGRAM_BOT_TOKEN="your_token_from_botfather" in .env');
  console.log('2. Run: npm run bot:poll');
  process.exit(1);
}

console.log(`🤖 Starting Telegram Bot Polling Worker (@${botUsername})...`);
console.log('⚡ Listening for live updates from Telegram Bot API...');


let offset = 0;

async function poll() {
  while (true) {
    try {
      const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=30`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`getUpdates failed [${res.status}]: ${await res.text()}`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      const data = (await res.json()) as {
        ok: boolean;
        result: Array<{ update_id: number; message?: any }>;
      };

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          console.log(`📩 Received update ${update.update_id}:`, update.message?.text || '(non-text)');
          try {
            await handleTelegramUpdate(update);
          } catch (e) {
            console.error('Error handling Telegram update:', e);
          }
        }
      }
    } catch (e) {
      console.error('Polling network error:', e);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

poll();
