# Groupwork Coordinator — AI Group Project Coordinator (Worcflow challenge)

An AI agent that runs a college group project over **real Telegram messages** (bot `@revenants_coord_bot`).

## Loop
1. **Task list** — tasks with owners, status (Pending / In progress / Blocked / Complete), progress and blocker.
2. **Follow-up** — "Follow up" sends each owner a real Telegram message listing their open tasks.
3. **Reply** — the participant answers in plain language; Telegram delivers it to `/api/public/telegram/webhook`.
4. **Interpretation** — an LLM (Lovable AI Gateway, `openai/gpt-6-astra`, strict JSON schema) maps the reply to tasks and classifies progress / complete / blocked, extracting the blocker. Partial + waiting = Blocked, never Complete.
5. **Update** — task row updated, status change logged in history, confirmation sent back on Telegram. Dashboard refreshes every 3 s.

Example: Kabir replies "connected, but waiting for test credentials" → *Connect the payment API* becomes **Blocked** with blocker "Waiting for test credentials".

## Demo setup
- Each teammate taps their invite link (`t.me/revenants_coord_bot?start=<code>`) on the dashboard → linked.
- Click **Follow up on all open tasks**, reply from Telegram, watch the board update.

## Code
- `src/lib/coordinator.server.ts` — Telegram send, AI classification, update logic, webhook handling (idempotent on `update_id`).
- `src/routes/api/public/telegram/webhook.ts` — webhook, verified with Telegram secret token.
- `src/lib/coordinator.functions.ts` — dashboard data, follow-ups, manual edits.
- `src/routes/index.tsx` — dashboard.

# ReVenants

AI-powered project coordinator that converts team conversations into tasks, tracks deadlines, detects blockers, and automates follow-ups to improve collaboration and productivity.

---

## 📁 Pre-Essential Project Documentation

All specifications, architectural designs, data models, prompt suites, and evaluation benchmarks are organized in the [`Pre Essential project documents/`](./Pre%20Essential%20project%20documents/) directory:

- 📖 [Project Overview & Architecture](./Pre%20Essential%20project%20documents/README.md)
- 📑 [Full Specifications & Architecture Docs (`docs/`)](./Pre%20Essential%20project%20documents/docs/)
- 🤖 [LLM System Prompts & Test Benchmarks (`prompts/`)](./Pre%20Essential%20project%20documents/prompts/)
- 👥 [Team Roles & Ownership Matrix](./Pre%20Essential%20project%20documents/TEAM_ROLES.md)
