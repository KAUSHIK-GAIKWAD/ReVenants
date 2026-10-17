# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased (Hackathon Milestone 1)

### Added
- Complete project documentation framework and specifications:
  - Problem and scope definition (`docs/01_PROBLEM_AND_SCOPE.md`)
  - Development methodology and build order (`docs/02_METHODOLOGY.md`)
  - End-to-end architecture and Mermaid flow diagrams (`docs/03_ARCHITECTURE.md`)
  - Supabase/PostgreSQL relational data model and schema definitions (`docs/04_DATA_MODEL.md`, `supabase_schema.sql`)
  - LLM intent taxonomy and reply understanding rules (`docs/05_REPLY_UNDERSTANDING.md`)
  - Test suites and evaluation framework (`docs/06_EVALUATION.md`)
  - 5-minute live demo script and fallback runbook (`docs/07_DEMO_SCRIPT.md`)
  - Risk analysis, edge cases, and mitigations (`docs/08_RISKS_AND_LIMITATIONS.md`)
  - Transparent AI tool usage log (`docs/09_AI_USAGE_LOG.md`)
  - Post-hackathon feature roadmap (`docs/10_ROADMAP.md`)
- Production prompt specifications:
  - Classifier system prompt v1 with strict JSON output and blocker detection (`prompts/classifier_system_prompt_v1.md`)
  - Dynamic follow-up message prompt v1 (`prompts/followup_message_prompt_v1.md`)
  - Prompt iteration log tracking test iterations (`prompts/PROMPT_ITERATION_LOG.md`)
  - 15 realistic reply test cases (`prompts/TEST_CASES.md`)
- Initial seed data in `data/sample_tasks.csv` representing a realistic student group project.
- Demo evidence checklist in `demo_evidence/README.md`.
- Environment template (`.env.example`) and `.gitignore`.

### In Progress / TODO
- Implementation of Telegram messaging loop (`src/bot.py`).
- Claude structured output classification client (`src/classifier.py`).
- Supabase storage & audit logging service (`src/db/database.py`).
- Lightweight web status dashboard (`src/dashboard.py`).
- Automated evaluation runner (`tests/run_eval.py`).
