# 02. Methodology & Build Order

Building an AI agent that operates in live messaging environments requires an disciplined engineering sequence. If the messaging loop is brittle or the data layer loses history, sophisticated prompt engineering won't matter.

We followed an **outside-in, loop-first methodology**: prove real-world communication first, then layer on intelligence, persistence, and scheduling.

---

## 🏗️ 6-Stage Build Order

```
[Phase 1] Messaging Loop (Telegram Bot)
    ↓
[Phase 2] Classification Engine (Claude Structured JSON)
    ↓
[Phase 3] Storage & Audit Trail (Supabase + status_history)
    ↓
[Phase 4] Web Dashboard (Live visual state)
    ↓
[Phase 5] Scheduler (APScheduler background jobs)
    ↓
[Phase 6] Reporting & Summaries (Daily digest & blocker escalation)
```

| Phase | Milestone Component | Why We Built It in This Order |
|-------|---------------------|-------------------------------|
| **1. Messaging Loop** | `src/bot.py` | Real chat networks have asynchronous webhooks, network latency, and platform quirks. Verifying the bot can send and receive real Telegram messages avoids late integration surprises. |
| **2. Classification** | `src/classifier.py` + `prompts/` | Prompt engineering is our primary intelligence layer. We isolated Claude API calls with strict JSON schemas and verified test cases before touching database code. |
| **3. Persistent Storage** | `src/database.py` | Once classification works in memory, persist tasks, participants, and an immutable `status_history` audit log so status changes are provable. |
| **4. Visual Dashboard** | `src/dashboard.py` | Judges and users need instant visual confirmation that an incoming Telegram message actually modified project state. |
| **5. Background Scheduler** | `src/scheduler.py` | Connect `APScheduler` to trigger automated check-ins based on task due dates and unanswered reminder counts. |
| **6. Reports & Escalation** | `src/reporting.py` | Aggregate project blockers into summary messages for team syncs. |

---

## 🧪 Testing Approach

We separate testing into three distinct layers to maintain high velocity during the hackathon:

### 1. Isolated Prompt Evaluation (`tests/test_classifier.py`)
- Run all 16 test cases from `prompts/TEST_CASES.md` against the Claude classification engine.
- Verify intent matching, blocker string extraction, and confidence scores.
- Flag any case where a blocker was missed or an ambiguous reply didn't set `needs_followup: true`.

### 2. Database Audit Integrity Tests (`tests/test_database.py`)
- Verify state machine transitions (e.g. `Pending` -> `In Progress` -> `Blocked`).
- Guarantee that every transition creates an immutable row in `status_history` containing the verbatim user message.

### 3. Live End-to-End Smoke Test (Pre-Demo Run)
- Execute the exact 5-minute demo script over real Telegram mobile and desktop clients.
- Verify that a real user typing *"connected, but waiting for test credentials"* transitions the dashboard to `Blocked` within 2 seconds.

---

## 🔄 Prompt Iteration Cycle

We treat prompt updates like code changes, following a 4-step loop:

1. **Observe Failure Mode**: Identify an edge case in chat (e.g., Claude classifies *"wrapped up the code, just waiting on AWS login"* as `completed`).
2. **Log in `PROMPT_ITERATION_LOG.md`**: Record the prompt version, input phrase, erroneous output, and proposed fix.
3. **Refine Prompt & Few-Shots**: Adjust system prompt instructions (e.g. reinforcing the "Kabir Rule") and add a counter-example.
4. **Run Regression Eval**: Rerun all test cases in `prompts/TEST_CASES.md` to ensure existing classifications did not regress.
