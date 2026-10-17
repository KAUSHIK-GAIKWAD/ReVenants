# 05. Reply Understanding & Intent Taxonomy

Teammates communicate in natural, messy, and conversational ways in group chats. The goal of the reply understanding engine is not just sentiment analysis; it is **state extraction**.

---

## 🧭 Intent Taxonomy

| Intent | Description | Example Message | Target Status |
|--------|-------------|-----------------|---------------|
| **`completed`** | Task is fully finished, code is merged, or deliverable is shared. | *"Pushed the final commit to main, tests pass"* | `Complete` |
| **`in_progress`** | Meaningful forward movement has occurred; no blockers are present. | *"Working on the login form, got fields validating"* | `In Progress` |
| **`blocked`** | Progress is halted by an external dependency, teammate, or missing info. | *"connected, but waiting for test credentials"* | `Blocked` |
| **`delayed`** | Work has slipped or not started due to personal schedule (exams, sickness), without technical blockers. | *"Can't get to this tonight due to midterms, starting Friday"* | `Pending` / `In Progress` (updates ETA) |
| **`question`** | Member needs clarification on requirements, specs, or architecture. | *"Are we supposed to use Stripe checkout or custom card forms?"* | No status change (notifies team) |
| **`unrelated`** | Casual chatter, social talk, or message meant for another thread. | *"Who wants to grab lunch at the dining hall?"* | Ignored (No state change) |

---

## 📋 JSON Output Schema

The Claude classifier is constrained to produce strictly valid JSON matching this schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "task_id": {
      "type": "string",
      "description": "Identifier of the associated task, e.g. TASK-103"
    },
    "intent": {
      "type": "string",
      "enum": ["completed", "in_progress", "blocked", "delayed", "question", "unrelated"]
    },
    "progress_percent": {
      "type": ["integer", "null"],
      "minimum": 0,
      "maximum": 100,
      "description": "Estimated completion percentage, or null if unstated"
    },
    "blocker": {
      "type": ["string", "null"],
      "description": "Concise summary of the obstacle if intent is blocked"
    },
    "needs_followup": {
      "type": "boolean",
      "description": "True if the bot must ask a clarifying question"
    },
    "clarification_question": {
      "type": ["string", "null"],
      "description": "Targeted question to ask user if needs_followup is true"
    },
    "confidence": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "description": "Model self-assessed certainty of this classification"
    },
    "reasoning": {
      "type": "string",
      "description": "One sentence explaining why this intent was selected"
    }
  },
  "required": ["task_id", "intent", "progress_percent", "blocker", "needs_followup", "confidence", "reasoning"],
  "additionalProperties": false
}
```

---

## ⚖️ Edge Case Decision Rules

### 1. The "Connected But Waiting" Rule (Partial Progress + Blocker)
- **The Trap**: A message contains positive action words (*"connected"*, *"finished the code"*, *"integrated the SDK"*) followed by a dependent clause (*"but waiting for test credentials"*, *"still need API key"*). Naive keyword classifiers mark this as `completed` because of the word "connected".
- **Our Rule**: **Blockers always take precedence over partial progress.**
  - Status becomes **`Blocked`**.
  - `blocker` is set to `"waiting for test credentials"`.
  - `progress_percent` can reflect progress (e.g. `75%`), but the status badge is red/blocked.

### 2. Vague Replies ("almost done", "working on it")
- Teammates often reply with conversational non-answers when hurried.
- **Our Rule**:
  - Assign intent `in_progress`.
  - Score confidence strictly `< 0.70`.
  - Set `needs_followup: true`.
  - Claude generates a polite, concrete clarification:
    > *"Great to hear! Are you planning to push that tonight, or do you need help wrapping it up?"*

### 3. Multi-Task Messages
- Example: *"Auth API is completely done, but for payments I'm still waiting on the client ID."*
- **Our Rule**: The prompt injects the specific target `task_id` that the bot asked about. Claude isolates the clause that pertains to `task_id` (`TASK-103`: payments) and ignores the unrelated task (`TASK-102`: auth).

### 4. Low Confidence Safeguard (< 0.70)
- Instead of making an erroneous guess that alters project status, any reply with `confidence < 0.70` keeps the task in its previous state and sends a clarifying Telegram message.
- Prevents database corruption from ambiguous text.
