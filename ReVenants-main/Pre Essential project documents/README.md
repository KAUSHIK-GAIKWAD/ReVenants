# ReVenants: AI Group Project Coordinator 🤖💬

> **An autonomous AI coordinator that converts team conversations into tasks, tracks deadlines, detects blockers, and automates follow-ups over Telegram to improve collaboration and productivity.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/LICENSE)
[![Python: 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Platform: Telegram](https://img.shields.io/badge/Platform-Telegram_Bot_API-0088cc.svg)](https://core.telegram.org/bots)
[![LLM: Claude Sonnet](https://img.shields.io/badge/LLM-Claude_3.5_Sonnet-orange.svg)](https://www.anthropic.com/)

---

## 💡 The Pitch & Problem

College group projects collapse not because the work is hard, but because communication is silent. Teammates abandon Jira and Linear within two days and chat exclusively on Telegram. When someone is stuck on an API key or another member's code, they often stay quiet until the night before the final presentation.

**AI Group Project Coordinator** lives where students actually hang out. It:
1. Maintains the team's task list, owners, and dependency chains.
2. Reaches out autonomously over Telegram with context-aware, friendly check-ins.
3. Interprets informal student replies using Claude with strict structured JSON output.
4. **Enforces the "Kabir Rule"**: When Kabir replies *"connected, but waiting for test credentials"*, the coordinator catches that the task is **`Blocked`** (not Complete!), extracts the blocker note, and immediately updates the live dashboard and audit trail.

---

## 🔁 How It Works (The Coordination Loop)

```
[ Task List & Deadlines (Supabase/Postgres) ]
                │
                ▼
  1. APScheduler triggers check-in
                │
                ▼
  2. Telegram Bot sends short nudge to student
                │
                ▼
  3. Student replies in chat: "connected, but waiting for test credentials"
                │
                ▼
  4. Claude 3.5 Sonnet extracts structured JSON:
     { intent: "blocked", blocker: "waiting for test credentials", confidence: 0.96 }
                │
                ▼
  5. Supabase/Postgres records the status update and immutable audit log in status_history
                │
                ▼
  6. Live Web Dashboard updates instantly (Red Blocked badge + blocker callout)
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Language** | Python 3.12 | Modern type annotations, native async concurrency, and LLM orchestration |
| **Messaging** | [Telegram Bot API](https://core.telegram.org/bots) (`aiogram` / `python-telegram-bot`) | Direct connection to Telegram Bot API with polling and webhook support |
| **Reasoning Engine** | [Anthropic Claude](https://www.anthropic.com/) (`claude-haiku-5-5` & `claude-sonnet-5-5`) | Structured JSON extraction, blocker detection, and dynamic follow-ups |
| **Scheduling** | [APScheduler](https://github.com/agronholm/apscheduler) (`AsyncIOScheduler`) | In-process cron and interval check-in engine |
| **Persistence & Audit** | [Supabase](https://supabase.com/) / PostgreSQL | Hosted relational storage with raw-message audit logging in `status_history` |
| **Dashboard UI** | [FastAPI](https://fastapi.tiangolo.com/) + Jinja2 + HTMX + Tailwind | Real-time project overview, blocker flags, and audit history with dynamic auto-refresh |

👉 *For our deliberate architectural rationale, alternatives considered, Telegram vs. WhatsApp comparison, and container deployment plan, see [11_TECH_STACK_AND_DEPLOYMENT.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/11_TECH_STACK_AND_DEPLOYMENT.md).*

---

## ⚡ Quickstart & Setup

### 1. Prerequisites
- Python 3.10 or higher installed.
- A Telegram account and Bot Token from [@BotFather](https://t.me/BotFather).
- An Anthropic Claude API key.

### 2. Clone & Environment Configuration
```bash
# Clone the repository
git clone https://github.com/your-org/ai-group-project-coordinator.git
cd ai-group-project-coordinator

# Create virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Edit your `.env` file with your credentials (see [.env.example](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/.env.example)):
```env
TELEGRAM_BOT_TOKEN="your_token_from_botfather"
ANTHROPIC_API_KEY="your_anthropic_api_key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your_server_side_supabase_key"
```

Run `supabase_schema.sql` once in the Supabase SQL Editor, then install the Python client with `pip install supabase` before starting the application.

### 3. Initialize Database & Seed Tasks
```bash
# Loads sample tasks from data/sample_tasks.csv into Supabase
python scripts/seed_database.py
```

### 4. Run Application
```bash
# Start bot listener and dashboard simultaneously
python -m src.main
```
Visit the live dashboard in your browser at `http://localhost:8000`.

---

## 🎬 Live 5-Minute Demo

We prepared a rehearsed, timed demo for hackathon judges:
- 📖 **Full Demo Script**: See [07_DEMO_SCRIPT.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/07_DEMO_SCRIPT.md).
- 📸 **Evidence Checklist**: See [demo_evidence/README.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/demo_evidence/README.md).
- 🛟 **Fallback Plan**: Includes local offline replay simulation (`simulate_reply.py`) if venue Wi-Fi drops.

---

## 📚 Complete Project Documentation

Judges can explore our design decisions, prompt engineering, data models, and evaluations via the links below:

### 📑 Specifications & Architecture (`docs/`)
| Document | Description |
|----------|-------------|
| [01_PROBLEM_AND_SCOPE.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/01_PROBLEM_AND_SCOPE.md) | Target users, student pain points, in-scope features, and explicit non-goals |
| [02_METHODOLOGY.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/02_METHODOLOGY.md) | 6-stage build order (messaging loop first), testing strategy, and prompt iteration |
| [03_ARCHITECTURE.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/03_ARCHITECTURE.md) | System components, Mermaid sequence diagram, and technical trade-offs |
| [04_DATA_MODEL.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/04_DATA_MODEL.md) | Relational SQL schema (`tasks`, `participants`, `messages`, `status_history`) |
| [05_REPLY_UNDERSTANDING.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/05_REPLY_UNDERSTANDING.md) | Intent taxonomy, JSON schema, the "Kabir Rule", and low-confidence clarification |
| [06_EVALUATION.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/06_EVALUATION.md) | 16-case test benchmark matrix, expected vs actual statuses, and failure modes |
| [07_DEMO_SCRIPT.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/07_DEMO_SCRIPT.md) | 5-minute timed judging presentation script with step-by-step cue notes |
| [08_RISKS_AND_LIMITATIONS.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/08_RISKS_AND_LIMITATIONS.md) | Privacy safeguards, notification fatigue limits, outage handling, and boundaries |
| [09_AI_USAGE_LOG.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/09_AI_USAGE_LOG.md) | Honest disclosure of AI-assisted scaffolding and human verification procedures |
| [10_ROADMAP.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/10_ROADMAP.md) | Future growth: risk reporting, meeting-slot scheduling, and voice note parsing |
| [11_TECH_STACK_AND_DEPLOYMENT.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/docs/11_TECH_STACK_AND_DEPLOYMENT.md) | Tech stack justification, Docker packaging, Railway/Fly.io deployment, and component status |

### 🤖 Prompts & Evaluation Suites (`prompts/`)
| Document | Description |
|----------|-------------|
| [prompts/README.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/prompts/README.md) | Prompt architecture philosophy and overview of prompt files |
| [classifier_system_prompt_v1.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/prompts/classifier_system_prompt_v1.md) | Production Claude prompt for structured JSON classification and blocker detection |
| [followup_message_prompt_v1.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/prompts/followup_message_prompt_v1.md) | Dynamic outreach prompt with tone escalation based on reminder count |
| [PROMPT_ITERATION_LOG.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/prompts/PROMPT_ITERATION_LOG.md) | Revision tracking table documenting observed edge cases and accuracy gains |
| [TEST_CASES.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/prompts/TEST_CASES.md) | 16 realistic student reply test cases (completion, blockers, ambiguity, chatter) |

### 📂 Additional Project Files
| File | Description |
|------|-------------|
| [sample_tasks.csv](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/data/sample_tasks.csv) | Seed dataset containing 8 student tasks and Kabir's payment API dependency |
| [TEAM_ROLES.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/TEAM_ROLES.md) | Team ownership matrix, component assignments, and collaboration norms |
| [CHANGELOG.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/CHANGELOG.md) | Version history tracking releases and development milestones |
| [LICENSE](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/LICENSE) | Open source MIT License |

---

## 👥 Hackathon Team & Ownership

See [TEAM_ROLES.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/TEAM_ROLES.md) for detailed role allocations.

- **Prompt Engineering & Evaluation**: Student Lead 1
- **Telegram Bot & Messaging Loop**: Student Lead 2
- **Database Architecture & Audit Logging**: Student Lead 3
- **Web Dashboard & Demo Operations**: Student Lead 4

