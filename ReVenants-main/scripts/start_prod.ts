/**
 * Production startup script — runs on Render (or any Node.js host)
 * Launches:
 *   1. Nitro Node.js server  (.output/server/index.mjs) — serves React dashboard + SSR + API
 *   2. Telegram Bot Poller   (scripts/telegram_poller.ts) — polls getUpdates & processes messages
 *
 * On Render, the Telegram webhook route is also available at:
 *   POST /api/public/telegram/webhook
 * Set it with:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<APP>.onrender.com/api/public/telegram/webhook
 */
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

try { process.loadEnvFile?.('.env'); } catch {}

const isWindows = process.platform === "win32";
const node = isWindows ? "node" : "node";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const outputServer = path.resolve(process.cwd(), ".output/server/index.mjs");

if (!fs.existsSync(outputServer)) {
  console.error(
    `\n❌ Production build not found at ${outputServer}.\n` +
      `   Run "npm run build:prod" first (or check your Render build command).\n`
  );
  process.exit(1);
}

console.log("🚀 Starting ReVenants Production Server...\n");

// ── 1. Nitro HTTP server (serves everything: React SPA + SSR + API routes) ──
const serverProcess = spawn(node, [".output/server/index.mjs"], {
  stdio: "inherit",
  env: { ...process.env },
});

// ── 2. Telegram polling worker ────────────────────────────────────────────────
const pollerProcess = spawn(npmCmd, ["run", "bot:poll:prod"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env },
});

serverProcess.on("error", (err) => console.error("Server error:", err));
pollerProcess.on("error", (err) => console.error("Poller error:", err));

function cleanup() {
  console.log("\n🛑 Shutting down ReVenants production processes...");
  try { serverProcess.kill(); } catch {}
  try { pollerProcess.kill(); } catch {}
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
