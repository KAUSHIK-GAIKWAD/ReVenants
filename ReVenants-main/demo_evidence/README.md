# Demo Evidence Checklist

This directory holds visual and verifiable evidence of the live system in operation. Judges evaluate live messaging integrations on whether the AI actually executed end-to-end against real chat platforms rather than simulated mocks.

> **Status**: [ ] Pending live run / screenshot capture (Scheduled before final judging).

---

## 📸 Required Screenshot Checklist

| # | Artifact / Screenshot | Purpose / What It Proves | Target Filename | Status |
|---|-----------------------|--------------------------|-----------------|--------|
| 1 | **Initial Dashboard Task List** | Shows initial project state (e.g., Kabir's task `TASK-103` in `Pending` state) | `01_initial_dashboard.png` | `TODO` |
| 2 | **Automated Bot Follow-up Message** | Proves the Telegram bot initiated a check-in to Kabir via Telegram API | `02_telegram_bot_outreach.png` | `TODO` |
| 3 | **Real User Reply with Edge Case** | Shows Kabir replying: *"connected, but waiting for test credentials"* in Telegram | `03_telegram_user_reply.png` | `TODO` |
| 4 | **LLM Classifier Terminal / API Log** | Shows Claude receiving prompt + reply and returning JSON with `intent: "blocked"`, `blocker: "waiting for test credentials"` | `04_llm_json_log.png` | `TODO` |
| 5 | **Updated Dashboard with Blocker** | Shows `TASK-103` immediately updated to **Blocked** with red badge and the blocker note visible | `05_updated_dashboard_blocked.png` | `TODO` |
| 6 | **Audit Log / Status History Record** | Shows the database entry in `status_history` recording old status, new status, timestamp, and the verbatim user message | `06_audit_log_record.png` | `TODO` |
| 7 | **Clarifying Follow-up from Bot** | Shows bot asking a clarifying question when a user gives a vague reply like *"almost done"* | `07_telegram_clarification.png` | `TODO` |

---

## 🛠️ Instructions for Capturing Evidence

1. **Telegram Screen Captures**:
   - Capture the full message bubble with timestamp and bot username visible.
   - Do not obscure timestamps or user handles.
2. **Dashboard Captures**:
   - Ensure the browser URL (`http://localhost:8000` or deployment URL) is visible.
   - Refresh to verify state persistence across reloads.
3. **Database / Audit Log Captures**:
   - Use SQLite viewer (`sqlite3` CLI or DB Browser) to show the exact query:
     ```sql
     SELECT task_id, previous_status, new_status, changed_by_message, changed_at
     FROM status_history
     WHERE task_id = 'TASK-103';
     ```
4. **Naming Convention**:
   - Save high-resolution PNGs directly into `demo_evidence/` using the exact filenames listed above.
