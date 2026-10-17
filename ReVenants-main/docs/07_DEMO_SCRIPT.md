# 07. 5-Minute Live Demo Script & Runbook

This timed presentation guide is designed for our live hackathon judging slot. It demonstrates the complete loop: scheduled outreach → real Telegram reply → Claude classification → dashboard status transition → audit trail verification.

---

## ⏱️ Minute-by-Minute Runbook (Total: 5 Minutes)

### 0:00 – 0:45 | The Hook: The Student "Silent Blocker" Dilemma
- **Speaker 1**:
  > *"Every student here has lived through a group project where someone disappears for five days. You ask them the night before demo day, and they say: 'Oh, I finished the code days ago, but I didn't have the API keys.' That silent blocker kills grades. Students won't use Jira or Linear—they live in Telegram. We built an autonomous AI coordinator that meets students where they chat, extracts ground truth from messy replies, and immediately flags blockers to the team."*

### 0:45 – 1:30 | The Live Dashboard & Initial State
- **Speaker 2**:
  - Open web dashboard at `http://localhost:8000`.
  - Point to task **`TASK-103`**: *"Connect the payment API"*, assigned to **Kabir Patel**.
  - Current status: **`Pending`** (Gray badge).
  - Note downstream dependency: Sara's task **`TASK-105`** is waiting on Kabir's endpoint.
  > *"Right now, the dashboard shows Kabir's task is Pending. Let's trigger a check-in."*

### 1:30 – 2:45 | The Live Messaging Loop & The Kabir Rule
- **Action**: Bot sends Telegram message to Kabir:
  > *"Hey Kabir! 👋 Quick check-in on 'Connect the payment API' before tomorrow's sync. Have you had a chance to start, or need any help getting set up?"*
- **Action (Live on Kabir's phone)**:
  - Kabir opens Telegram and types:
    > *"connected, but waiting for test credentials"*
  - Hit **Send**.
- **Speaker 1**:
  - Show the terminal logs: Claude processes the reply with prompt v1.
  - Claude outputs JSON:
    ```json
    {
      "task_id": "TASK-103",
      "intent": "blocked",
      "blocker": "waiting for test credentials",
      "confidence": 0.96
    }
    ```
- **Visual Payoff**:
  - Switch back to the dashboard.
  - Within 2 seconds, **`TASK-103`** turns **`Blocked`** (Bright Red badge).
  - The blocker text *"waiting for test credentials"* appears directly beneath the task.
  > *"Notice what just happened: a naive bot would have seen 'connected' and marked the task Complete. Our coordinator recognized that 'waiting for test credentials' is an active blocker that stops the entire project."*

### 2:45 – 3:45 | Audit Trail & Ambiguity Clarification
- **Speaker 2**:
  - Click on the **Audit History** tab on the dashboard:
    - Show record: `TASK-103` | `Pending` → `Blocked` | Triggered by: *"connected, but waiting for test credentials"* | Confidence: `0.96`.
  - Demonstrate handling of vague messages:
    - Maya sends: *"almost done"* on `TASK-102`.
    - Claude detects confidence `< 0.70`, flags `needs_followup: true`.
    - Bot immediately replies in Telegram: *"Awesome! Do you think you'll have the endpoints ready to merge today, or are you still working through tests?"*
  > *"The coordinator doesn't guess. If an answer is vague, it asks a targeted follow-up question rather than corrupting project state."*

### 3:45 – 5:00 | Architecture Recap & Judge Q&A
- **Speaker 1**:
  - Summary slide/diagram: Telegram Bot API + Claude Structured Output + Supabase Audit Log.
  - Highlight key win: Zero new apps for students to install; complete visibility for the team.
  - Open floor for judge questions.

---

## 🛟 Contingency & Fallback Plan (Network / API Failure)

Hackathon venue Wi-Fi and Telegram webhook connections can degrade. We have an operational fallback plan:

| Failure Mode | Trigger / Symptom | Immediate Fallback Action |
|--------------|-------------------|---------------------------|
| **Venue Wi-Fi Dropout** | Telegram messages fail to deliver | Switch laptop immediately to mobile 5G hotspot (pre-paired). |
| **Telegram API Latency (> 5s)** | Bot webhook delays delivery | Run local simulation script: `python scripts/simulate_reply.py --task TASK-103 --reply "connected, but waiting for test credentials"`. |
| **Claude API Outage** | Anthropic API returns 500 or times out | Switch `.env` to local mock classifier mode (`USE_MOCK_LLM=true`) which evaluates offline against cached responses. |
| **Total Hardware Failure** | Laptop crashes | Present pre-recorded screen capture video and screenshots stored in `demo_evidence/`. |
