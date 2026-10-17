# 06. Evaluation Suite & Benchmark Results

This document tracks our benchmark evaluations of the LLM classifier across realistic student reply scenarios.

> **Integrity Note**: In accordance with hackathon evaluation standards, we do not fabricate benchmark scores or pass/fail numbers. Actual results below are marked as `TODO` until our evaluation runner (`tests/run_eval.py`) executes against the live Claude API.

---

## 📊 Test Reply Benchmark Matrix

| ID | Input Reply Message | Target Task Context | Expected Intent | Expected Blocker | Actual Intent | Actual Blocker | Pass / Fail | Notes |
|----|---------------------|---------------------|-----------------|------------------|---------------|----------------|-------------|-------|
| **TC-01** | *"connected, but waiting for test credentials"* | `TASK-103`: Connect payment API | `blocked` | `"waiting for test credentials"` | `TODO` | `TODO` | `TODO` | The Kabir Rule: Core edge case |
| **TC-02** | *"Just pushed the schema migrations to main, tests are passing!"* | `TASK-101`: Setup DB schema | `completed` | `null` | `TODO` | `TODO` | `TODO` | Explicit positive completion |
| **TC-03** | *"Done with the checkout screens, dropped the figma link in the doc"* | `TASK-104`: Design UI | `completed` | `null` | `TODO` | `TODO` | `TODO` | Deliverable link confirmation |
| **TC-04** | *"Got login and password hashing working, still need to finish the signup endpoint"* | `TASK-102`: Auth API | `in_progress` | `null` | `TODO` | `TODO` | `TODO` | Partial quantitative progress |
| **TC-05** | *"Started writing the unit tests for stripe webhooks today"* | `TASK-106`: Payment Tests | `in_progress` | `null` | `TODO` | `TODO` | `TODO` | Early phase progress |
| **TC-06** | *"almost done"* | `TASK-102`: Auth API | `in_progress` (`needs_followup=true`) | `null` | `TODO` | `TODO` | `TODO` | Ambiguous; must trigger follow-up |
| **TC-07** | *"working on it right now"* | `TASK-107`: Slide deck | `in_progress` (`needs_followup=true`) | `null` | `TODO` | `TODO` | `TODO` | Low signal; requires clarification |
| **TC-08** | *"Can't deploy yet because I don't have write access to the team's AWS account"* | `TASK-108`: Deploy Staging | `blocked` | `"no write access to team AWS account"` | `TODO` | `TODO` | `TODO` | External credential blocker |
| **TC-09** | *"I can't hook up the payment form until Kabir finishes the API endpoint"* | `TASK-105`: Integrate Gateway | `blocked` | `"waiting on Kabir to finish payment API"` | `TODO` | `TODO` | `TODO` | Dependency chain blocker |
| **TC-10** | *"Drowning in midterm prep tonight, won't be able to look at slides until Friday afternoon"* | `TASK-107`: Slide deck | `delayed` | `null` | `TODO` | `TODO` | `TODO` | Personal study delay |
| **TC-11** | *"Are we using Stripe Elements or just redirecting to Stripe Checkout?"* | `TASK-103`: Connect payment API | `question` | `null` | `TODO` | `TODO` | `TODO` | Technical spec clarification |
| **TC-12** | *"Getting a weird foreign key mismatch in PostgreSQL, anyone seen this error before?"* | `TASK-101`: Setup DB schema | `question` | `"PostgreSQL foreign key mismatch error"` | `TODO` | `TODO` | `TODO` | Snag requiring peer assistance |
| **TC-13** | *"Auth API is completely done, but for payments I'm still waiting on the client ID"* | `TASK-103`: Connect payment API | `blocked` | `"waiting on the client ID"` | `TODO` | `TODO` | `TODO` | Multi-task isolation |
| **TC-14** | *"anyone ordering chipotle to the library?"* | `TASK-104`: Design UI | `unrelated` | `null` | `TODO` | `TODO` | `TODO` | Chat noise rejection |
| **TC-15** | *"sorry wrong chat mom"* | `TASK-102`: Auth API | `unrelated` | `null` | `TODO` | `TODO` | `TODO` | Misdirected message |
| **TC-16** | *"idk, haven't opened my laptop all week"* | `TASK-108`: Deploy Staging | `delayed` | `null` | `TODO` | `TODO` | `TODO` | Ghosting risk signal |

---

## ⚠️ Known Failure Modes & Edge Cases Under Investigation

1. **Sarcasm / Hyperbole**:
   - Message: *"Oh yeah, it'll be done in 5 seconds (not)."*
   - Current Risk: Language models often miss inverted polarity in short sarcastic student slang.
   - Planned Mitigation: Prompt few-shot example instructing that bracketed or sarcastic disclaimers denote blockers/delays.

2. **Split-Message Bursts**:
   - Message 1: *"Done with the endpoints"*
   - Message 2 (10 seconds later): *"Wait actually tests are failing"*
   - Current Risk: If processed independently, Message 1 sets `Complete`, then Message 2 sets `Blocked`.
   - Planned Mitigation: Implement a 15-second debounce buffer before dispatching classification.

3. **Stickers & Voice Memos**:
   - Non-text media currently bypasses classification and triggers a gentle text nudge: *"I can only read text messages right now—could you type a quick status update?"*
