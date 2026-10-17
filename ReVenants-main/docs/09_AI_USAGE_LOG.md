# 09. AI Tool Usage & Verification Log

In compliance with hackathon transparency guidelines, this document logs all generative AI tools used in the conception, architecture, code generation, and testing of the **AI Group Project Coordinator**.

We believe in using AI as an accelerator while retaining human engineering ownership and rigorous verification over every artifact.

---

## 📝 Tool Usage & Verification Registry

| Date | Tool / Model | Task / Purpose | Artifact(s) Produced | Human Verification & Validation Method |
|------|--------------|----------------|----------------------|---------------------------------------|
| **2025-11-10** | **Antigravity IDE Assistant** (Google DeepMind) | Scaffold repository structure, system prompt drafts, relational schema, architecture flows, and evaluation cases. | Complete `docs/` suite, `prompts/`, `.env.example`, `data/sample_tasks.csv`, and `README.md`. | Verified relational DDL constraints; reviewed prompt edge cases (the Kabir Rule); confirmed no real credentials exist. |
| **2025-11-10** | **Claude 3.5 Sonnet** (Anthropic) | Runtime intent classification and blocker detection from raw Telegram student replies. | `src/classifier.py`, `prompts/classifier_system_prompt_v1.md`. | Built 16-case benchmark in `prompts/TEST_CASES.md`; structured JSON schema validation with Pydantic; confidence score gating. |
| **2025-11-10** | **Claude 3.5 Sonnet** (Anthropic) | Contextual follow-up message generation adapting tone to reminder count. | `prompts/followup_message_prompt_v1.md`. | Reviewed sample outputs across 3 escalation levels to prevent corporate or passive-aggressive phrasing. |
| **2025-11-11** | **GitHub Copilot / IDE Completion** | Autocomplete boilerplate for `python-telegram-bot` event loops and FastAPI REST endpoints. | `src/bot.py`, `src/dashboard.py`. | Line-by-line peer code review; tested local execution with fake Telegram update webhooks. |
| **2025-11-11** | **Evaluation Runner** | Automated script to test Claude prompt against all edge cases. | `tests/run_eval.py`. | Verified test runner prints full diff when expected intent does not match actual LLM output. |
| **2025-11-11** | **Antigravity IDE Assistant** (Google DeepMind) | Draft comprehensive technical stack justification, Docker packaging strategy, Telegram vs WhatsApp trade-offs, and deployment plan. | `docs/11_TECH_STACK_AND_DEPLOYMENT.md`. | Reviewed by engineering team for consistency with architecture, realistic timelines, and strict adherence to zero-secret ground rules. |


---

## 📌 Guiding Principles for AI Usage

1. **Zero Unverified Code**: No generated code is pushed to `main` without local execution and syntax verification.
2. **Schema Enforcement**: AI models are never allowed to write unstructured free-form text directly into the database; all inputs pass through strict JSON schema parsing and type checking.
3. **Honest Reporting**: Test metrics, failure logs, and demo limitations are never fabricated by AI.
