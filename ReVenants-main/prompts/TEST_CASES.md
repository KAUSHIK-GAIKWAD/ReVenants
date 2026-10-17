# Evaluation Test Cases (15+ Scenarios)

These test cases evaluate our intent classifier's ability to interpret real, informal messages sent by college students in a group chat. They cover clean updates, subtle edge cases, ambiguous status messages, and unrelated noise.

---

## 🧪 Test Case Matrix

| ID | Category | Target Task Context | Teammate Reply Message | Expected Intent | Expected Blocker | Needs Followup | Expected Confidence | Why This Matters |
|----|----------|---------------------|------------------------|-----------------|------------------|----------------|---------------------|------------------|
| **TC-01** | **Blocker / Dependency (The Kabir Case)** | `TASK-103`: Connect the payment API (`Pending`) | *"connected, but waiting for test credentials"* | `blocked` | `"waiting for test credentials"` | `false` | `>= 0.90` | **Core Hackathon Rule**: Must not mark as `completed` despite the word "connected". |
| **TC-02** | **Clear Completion** | `TASK-101`: Setup database schema (`In Progress`) | *"Just pushed the schema migrations to main, tests are passing!"* | `completed` | `null` | `false` | `>= 0.95` | Standard positive completion update. |
| **TC-03** | **Casual Completion** | `TASK-104`: Design Checkout UI (`In Progress`) | *"Done with the checkout screens, dropped the figma link in the doc"* | `completed` | `null` | `false` | `>= 0.90` | Informal completion with deliverable link. |
| **TC-04** | **Partial Progress (Quantified)** | `TASK-102`: Build Auth API (`In Progress`) | *"Got login and password hashing working, still need to finish the signup endpoint"* | `in_progress` | `null` | `false` | `>= 0.85` | Concrete progress without blockers. |
| **TC-05** | **Partial Progress (Descriptive)** | `TASK-106`: Payment Integration Tests (`Pending`) | *"Started writing the unit tests for stripe webhooks today"* | `in_progress` | `null` | `false` | `>= 0.85` | Work initiated ahead of deadline. |
| **TC-06** | **Ambiguity / Vague Progress** | `TASK-102`: Build Auth API (`In Progress`) | *"almost done"* | `in_progress` | `null` | `true` | `< 0.70` | Classic student non-answer. Must trigger clarifying question. |
| **TC-07** | **Ambiguity / Low Signal** | `TASK-107`: Prepare Slide Deck (`In Progress`) | *"working on it right now"* | `in_progress` | `null` | `true` | `< 0.70` | Indicates activity, but provides zero milestone or ETA data. |
| **TC-08** | **Explicit External Blocker** | `TASK-108`: Deploy Staging (`Pending`) | *"Can't deploy yet because I don't have write access to the team's AWS account"* | `blocked` | `"no write access to team AWS account"` | `false` | `>= 0.95` | Permissions hurdle blocking infrastructure deployment. |
| **TC-09** | **Teammate Dependency Blocker** | `TASK-105`: Integrate Gateway with UI (`Pending`) | *"I can't hook up the payment form until Kabir finishes the API endpoint"* | `blocked` | `"waiting on Kabir to finish payment API"` | `false` | `>= 0.90` | Explicit dependency on an uncompleted prerequisite task. |
| **TC-10** | **Schedule Delay (No Tech Blocker)** | `TASK-107`: Prepare Slide Deck (`Pending`) | *"Drowning in midterm prep tonight, won't be able to look at slides until Friday afternoon"* | `delayed` | `null` | `false` | `>= 0.90` | Honest delay without blaming technical or external hurdles. |
| **TC-11** | **Question / Clarification Request** | `TASK-103`: Connect the payment API (`Pending`) | *"Are we using Stripe Elements or just redirecting to Stripe Checkout?"* | `question` | `null` | `true` | `>= 0.90` | Requires architectural clarification, not a status change. |
| **TC-12** | **Technical Help Request** | `TASK-101`: Setup database schema (`In Progress`) | *"Getting a weird foreign key mismatch in SQLite, anyone seen this error before?"* | `question` | `"SQLite foreign key mismatch error"` | `true` | `>= 0.85` | Question combined with a localized technical snag. |
| **TC-13** | **Multi-Task Reply (Mixed Status)** | `TASK-103`: Connect the payment API (`Pending`) | *"Auth API is completely done, but for payments I'm still waiting on the client ID"* | `blocked` | `"waiting on the client ID"` | `false` | `>= 0.85` | Must isolate the target task (payments) from the mention of auth. |
| **TC-14** | **Unrelated Banter** | `TASK-104`: Design Checkout UI (`In Progress`) | *"anyone ordering chipotle to the library?"* | `unrelated` | `null` | `false` | `>= 0.95` | Group chat noise; database task state must remain untouched. |
| **TC-15** | **Misdirected / Wrong Chat** | `TASK-102`: Build Auth API (`In Progress`) | *"sorry wrong chat mom"* | `unrelated` | `null` | `false` | `>= 0.95` | Accidental message; no action required. |
| **TC-16** | **Passive Frustration / Ghosting Cue** | `TASK-108`: Deploy Staging (`Pending`) | *"idk, haven't opened my laptop all week"* | `delayed` | `null` | `true` | `>= 0.80` | High-risk signal requiring gentle coordinator follow-up. |

---

## 🎯 Verification Criteria
- **Blocker Sensitivity**: 100% detection of blockers in TC-01, TC-08, TC-09, TC-13.
- **Ambiguity Interception**: TC-06 and TC-07 must return `needs_followup: true` and generate a `clarification_question`.
- **Noise Rejection**: TC-14 and TC-15 must never alter task statuses.
