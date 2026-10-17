# Existing System Gap Analysis

## 1. Introduction

ReVenants is planned as an **AI Group Project Coordinator** for university teams, hackathons, and small volunteer groups. The project focuses on a problem that is common in student work: the team communicates in a chat application, but project progress is expected to be maintained in a separate project-management tool.

The project files describe an important gap. Tools such as Jira, Trello, and Asana already provide task lists, assignments, deadlines, boards, dependencies, reminders, and workflow automation. However, ReVenants is designed around the place where the target users already communicate: Telegram. Its main idea is to turn informal messages into useful project updates and identify blockers before they become deadline problems.

This report separates the current design and specification from features that are still proposed or not implemented in the available repository.

## 2. Gaps in Existing Project-Management Systems

The existing-system review in `Existing System.docx` shows that current products cover the basic management functions well. The gap is less about missing task cards and more about how small teams use those tools in practice.

### Main user problems

1. **Communication and task tracking are separated.** Students often discuss work in Telegram or another group chat, while the official task status lives in Jira, Trello, or Asana. Important updates are easily left out of the formal system.

2. **Silent blockers are difficult to see.** A student may complete most of a task but still be waiting for credentials, another teammate, or a missing decision. A normal status such as “in progress” can hide the fact that the work cannot continue.

3. **Manual updates create extra work.** Students may abandon a tool when every conversation requires a separate ticket update, comment, or status change. The project documentation identifies this overhead as a reason student teams return to chat-only coordination.

4. **Peer follow-up is uncomfortable.** A student does not always want to repeatedly ask a friend for progress. As a result, delayed work may remain invisible until close to the deadline.

5. **Short and vague replies are hard to act on.** Messages such as “almost done” or “working on it” provide activity signals but not enough information to update a project accurately.

6. **The reason for a status change may be unclear.** Teams need to know which message caused a task to become blocked or complete. Without an audit trail, an incorrect update is difficult to understand or reverse.

These points are the project’s stated problem areas. They are not claims that Jira, Trello, or Asana lack every related feature; the existing-system review itself notes that features can depend on plans, settings, and integrations.

## 3. How ReVenants Addresses the Gap

ReVenants is designed as a conversation-first coordination layer rather than another board that students must remember to update.

### Proposed coordination flow

1. Tasks, owners, deadlines, and dependencies are stored in Supabase/PostgreSQL.
2. A scheduled coordinator sends a short Telegram check-in.
3. The student replies naturally in the chat.
4. Claude classifies the reply into an intent such as `completed`, `in_progress`, `blocked`, `delayed`, `question`, or `unrelated`.
5. The system applies the status rule and records the message, confidence, and status transition in `status_history`.
6. The dashboard shows the updated task state and blocker information.

The most important rule is the **Kabir Rule**: a blocker takes priority over positive progress language. For example, “connected, but waiting for test credentials” should become `Blocked`, not `Complete`. This is the central example used throughout the architecture, prompt, evaluation, and demo documents.

ReVenants also specifies a confidence safeguard. If a reply is vague and confidence is below 0.70, the task should remain in its previous state and the bot should ask a focused follow-up question instead of guessing.

## 4. Comparison With Existing Platforms

The comparison below is intentionally limited to the capabilities described in the project files and the specific workflow ReVenants is targeting.

| Area | Jira | Trello | Asana | ReVenants approach |
|---|---|---|---|---|
| Main interaction model | Issue and development workflow | Cards and Kanban boards | Tasks, projects, workflows, and dependencies | Telegram conversation connected to a task state store |
| Progress entry | Usually requires a user to update an issue or workflow | Usually requires moving or editing a card | Usually requires updating a task or project item | Converts a natural-language reply into a proposed status update |
| Blocker understanding | Can represent blockers through fields, comments, or workflow configuration | Can use labels, checklists, and comments | Can use dependencies, fields, and project workflows | Specifically extracts blocker language and gives it priority over partial completion |
| Handling vague replies | Depends on the user or configured workflow | Depends on the user or automation | Depends on the user or configured workflow | Uses confidence scoring and requests clarification below the threshold |
| Follow-up | Workflow automation and reminders can be configured | Butler automation and reminders can be configured | Reminders and workflow automation can be configured | Sends context-aware Telegram check-ins intended for student teams |
| Audit explanation | Depends on issue history and configuration | Depends on card activity history | Depends on task activity and configuration | Stores the raw triggering message, confidence, and transition in `status_history` |
| Intended advantage of ReVenants | — | — | — | Lower friction for chat-first student teams and better visibility into conversational blockers |

The difference is therefore not that ReVenants has more general project-management features. Its proposed improvement is the connection between informal chat and structured task health. It aims to reduce the manual gap between “what someone said” and “what the project dashboard says.”

## 5. What Makes ReVenants Different

- **Chat-first workflow:** the target user can reply in Telegram instead of opening a separate task-management application.
- **Blocker-first interpretation:** the design explicitly prevents positive words such as “connected” or “finished the code” from hiding a dependency or missing credential.
- **Human-friendly accountability:** the bot performs routine check-ins so one teammate does not have to act as the project manager.
- **Safe ambiguity handling:** low-confidence replies trigger clarification rather than an automatic, possibly incorrect status change.
- **Auditable decisions:** the planned `status_history` table keeps the original message and classifier confidence behind each transition.
- **Small-team focus:** the scope is intentionally aimed at student teams of approximately three to six people, rather than large enterprise delivery processes.

## 6. Current Status: Implemented Versus Proposed

The repository currently contains project specifications, prompt definitions, test cases, sample data, and planning documents. The `src/` and `tests/` directories contain only `.gitkeep` placeholders in this checkout. The evaluation document also marks runtime results as `TODO`.

### Present in the repository

- Problem definition, target users, and MVP scope.
- Relational data model for participants, tasks, messages, and `status_history`.
- Classifier and follow-up prompt specifications.
- The Kabir Rule and confidence threshold design.
- Sixteen planned evaluation scenarios.
- Sample task data and a demo runbook.
- Supabase connection factory in `src/db/database.py`.
- PostgreSQL schema in `supabase_schema.sql`.

### Still proposed or incomplete

- Telegram polling or webhook implementation.
- Claude API client and runtime JSON validation.
- Full task CRUD and status-transition service.
- Scheduler and automated follow-up execution.
- FastAPI dashboard.
- CSV seed loader, end-to-end integration, and live benchmark results.
- Authentication, production Row Level Security policies, and deployment configuration.

This distinction is important: ReVenants has a clear and testable design, but the available files do not prove that the complete end-to-end system is already running.

## 7. Database Review and Supabase Replacement

The original design used SQLite as a local, single-file database. That was simple for a prototype, but it would make a shared Telegram worker and dashboard dependent on local disk persistence. Supabase is a better fit for the next version because it provides hosted PostgreSQL storage that can be accessed by the application components from one shared environment.

The database changes made for ReVenants are:

- `.env.example` now uses `SUPABASE_URL` and `SUPABASE_KEY` instead of `DB_PATH`.
- `src/db/database.py` lazily creates a shared Supabase client and fails with a clear configuration message when credentials are missing.
- `supabase_schema.sql` defines PostgreSQL versions of `participants`, `tasks`, `messages`, and `status_history`, including foreign keys, status checks, indexes, timestamps, and Row Level Security being enabled.
- The architecture, data model, methodology, roadmap, deployment notes, README, and team ownership documentation now refer to Supabase/PostgreSQL.

Before running the complete application, the schema must be executed in the Supabase SQL Editor and the Supabase Python package must be installed. Since the runtime modules that would call the database are not present in this checkout, full application integration and live connection testing remain follow-up work.

## 8. Future Features

The project roadmap already proposes several useful extensions:

- Weekly project-health summaries for mentors, teaching assistants, or project leads.
- Dependency and critical-path risk detection.
- Graduated escalation when a task remains blocked or reminders are ignored.
- Natural-language availability parsing and meeting-slot suggestions.
- Voice-note transcription.
- Screenshot and error-log understanding.
- Connectors for Discord and WhatsApp Business API.

Additional practical improvements would be role-based access, authenticated dashboard accounts, configurable quiet hours, a human approval step for sensitive escalations, and stronger Supabase Row Level Security policies. These should be added after the core Telegram-to-dashboard flow is working and measured against the sixteen planned test cases.

## 9. Conclusion

Jira, Trello, and Asana already solve task organization effectively. ReVenants is trying to solve a different adoption and coordination problem: students share progress in chat, but the project state remains elsewhere and blockers are often expressed indirectly.

Its strongest proposed contribution is a small-team workflow that listens to task-related Telegram replies, detects hidden blockers, asks for clarification when uncertain, and leaves an auditable explanation for each state change. The Supabase migration gives this design a shared PostgreSQL foundation. The next major step is to implement and test the missing runtime modules so these documented advantages can be demonstrated rather than only specified.
