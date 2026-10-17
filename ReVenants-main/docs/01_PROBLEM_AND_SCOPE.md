# 01. Problem and Scope

College group projects are notorious for friction, uneven contributions, and silent blockers. Students don't use enterprise project management tools like Jira, Linear, or Asana—they coordinate exclusively in group chats (Telegram, WhatsApp, Discord, iMessage). 

When someone hits a blocker or falls behind, they often don't speak up until the night before the deadline.

---

## 🎯 The Problem

1. **The "Silent Blocker" Dilemma**:
   A teammate finishes 80% of a task (e.g. writing an integration) but gets stuck on an external dependency (missing API keys, waiting on another teammate). Because they feel guilty or assume they'll fix it tomorrow, they say nothing. The rest of the team assumes work is progressing smoothly until demo day arrives.
2. **Project Management Tool Overhead**:
   Assigning tickets in Linear/Jira works for software engineering teams, but student groups abandon them within 48 hours. Group chats are where conversations actually happen.
3. **Awkward Peer Nudging**:
   Nobody wants to be the "nagging project manager" who repeatedly bugs their friends for status updates. Peer dynamics make accountability awkward.

---

## 👥 Target Users

- **Primary**: University engineering, computer science, and design students working on semester capstone or hackathon projects (teams of 3 to 6).
- **Secondary**: Student club leads and volunteer teams organizing events with loosely-coupled task assignments.

---

## 🔍 Project Scope

### ✅ In Scope (What We Are Building for Hackathon)
- **Real Messaging Platform Integration**: Two-way Telegram bot interaction using the official Telegram Bot API.
- **Relational Task State Store**: Supabase/PostgreSQL holding tasks, assignees, deadlines, and dependency relationships.
- **Nuanced Natural Language Classification**: LLM-powered parser extracting intents (`completed`, `in_progress`, `blocked`, `delayed`, `question`, `unrelated`), blocker text, and confidence scores from casual student messages.
- **The "Connected But Waiting" Blocker Rule**: Explicit logic that treats partial completion with external impediments as **Blocked** rather than Complete or In Progress.
- **Audit Logging**: Immutable history recording the exact raw message that triggered every single status change.
- **Live Visual Dashboard**: Clean web interface showing tasks, ownership badges, real-time statuses, and blocker highlights.
- **Autonomous Follow-up Loop**: Scheduled proactive check-ins that trigger nudges before deadlines.

### ❌ Out of Scope (Explicitly Excluded for MVP)
- Multi-platform support beyond Telegram (e.g., Slack, Discord, WhatsApp are deferred).
- Automated code checking or GitHub PR verification (we focus on human coordination).
- Direct bot execution of tasks (the bot coordinates humans; it does not write code).
- Complex voice memo transcription or OCR on screenshot replies.
- Autonomous task reassignment without human confirmation.
