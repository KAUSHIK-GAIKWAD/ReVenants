# Prompts & LLM Orchestration

This directory contains our production system prompts, iteration logs, and evaluation test cases for the **AI Group Project Coordinator**.

In live messaging workflows, prompt reliability is critical: an incorrect status update can misinform an entire team or silence real blockers. We treat prompts as production code with strict schema validation, version control, and regression testing.

---

## 📂 Directory Contents

| File | Description |
|------|-------------|
| [classifier_system_prompt_v1.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/prompts/classifier_system_prompt_v1.md) | The core intent classifier prompt: extracts structured JSON, detects blockers (e.g. "connected but waiting"), and assesses confidence. |
| [followup_message_prompt_v1.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/prompts/followup_message_prompt_v1.md) | Generates short, context-aware Telegram follow-ups that escalate gracefully from friendly nudge to firm check-in. |
| [PROMPT_ITERATION_LOG.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/prompts/PROMPT_ITERATION_LOG.md) | Audit trail of prompt versions, observed failure modes, edits, and benchmark results. |
| [TEST_CASES.md](file:///c:/Users/Admin/Pre%20Essential%20project%20documents/prompts/TEST_CASES.md) | 15+ realistic student reply test cases covering completion, partial progress, edge-case blockers, ambiguity, and chit-chat. |

---

## 🧠 Design Principles

1. **Strict JSON-Only Output**: No markdown fences, no conversational conversational filler. Claude must respond with valid JSON parseable directly by `json.loads()`.
2. **The "Connected But Waiting" Rule (Blocker Priority)**: If a message mentions technical completion or progress alongside an external blocker (e.g., waiting on credentials, API keys, or another member), the intent **MUST** be classified as `blocked`.
3. **Calibrated Confidence & Disambiguation**: Vague responses like *"almost done"* or *"making progress"* should receive low confidence (< 0.7) and set `needs_followup: true`, triggering a clarifying question rather than making a wild guess.
4. **Context Injection**: Every prompt receives the target `task_id`, `task_title`, `current_status`, `due_date`, and `owner_name` to anchor interpretation.
