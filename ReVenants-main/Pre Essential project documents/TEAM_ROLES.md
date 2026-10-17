# Team Roles and Ownership

We are a student team collaborating on the **AI Group Project Coordinator** for this hackathon. Each team member has primary ownership over a slice of the stack, with cross-functional pairing on prompts and testing.

---

## 👥 Core Team Members & Ownership

| Name | Role | Primary Responsibilities | Secondary / Support |
|------|------|--------------------------|---------------------|
| **Student Lead 1** | **LLM Engineer & Prompt Lead** | Claude prompt engineering, structured JSON schema, `classifier.py`, edge case handling ("connected but waiting"), eval suite | Integration testing, documentation |
| **Student Lead 2** | **Backend & Telegram Integrator** | Telegram Bot API connection (`python-telegram-bot`), message routing, scheduler setup (`APScheduler`), webhook/polling | Environment configs, error handling |
| **Student Lead 3** | **Data Architect & Audit Logging** | Supabase/PostgreSQL schema, migrations, CRUD queries, audit log integrity (`status_history`), CSV loader | Data validation, security checklist |
| **Student Lead 4** | **Frontend & Demo Coordinator** | Web status dashboard (FastAPI/Flask + lightweight HTML/CSS), 5-minute demo runner, evidence capture (`demo_evidence/`) | Slides, presentation delivery |

---

## 📋 Responsibilities by Component

### 1. Messaging & Scheduler (`src/bot.py`, `src/scheduler.py`)
- **Owner**: Student Lead 2
- Maintain reliable connection with Telegram Bot API.
- Ensure message queues do not duplicate follow-ups.
- Handle rate limits and graceful reconnection on network dropouts.

### 2. Prompting & Classification (`prompts/`, `src/classifier.py`)
- **Owner**: Student Lead 1
- Maintain prompt iterations in `prompts/PROMPT_ITERATION_LOG.md`.
- Ensure zero hallucination on task IDs and strict JSON compliance from Claude.
- Own the test cases in `prompts/TEST_CASES.md` and execute evaluations.

### 3. Database & Audit History (`src/db/database.py`, `supabase_schema.sql`, `data/`)
- **Owner**: Student Lead 3
- Enforce schema constraints: prevent invalid task states.
- Ensure every status transition records the exact raw message in `status_history`.
- Maintain test datasets like `data/sample_tasks.csv`.

### 4. Dashboard & Live Demo (`src/dashboard.py`, `demo_evidence/`)
- **Owner**: Student Lead 4
- Build clean, real-time dashboard reflecting task status badges and blocker details.
- Orchestrate the live demo flow (timed 5-minute rehearsal, fallback backup plan).
- Capture and commit screenshot evidence before judge presentation.

---

## 🤝 Collaboration Norms
1. **No Silent Changes to Prompts**: Any prompt adjustment must be recorded in `prompts/PROMPT_ITERATION_LOG.md` with rationale and eval output.
2. **Honesty First**: Never fabricate test scores or mock screenshots. If an edge case fails, log it in `docs/06_EVALUATION.md`.
3. **Branching & PRs**: Short-lived feature branches (`feat/telegram-bot`, `feat/claude-eval`) merged into `main` after local peer check.
