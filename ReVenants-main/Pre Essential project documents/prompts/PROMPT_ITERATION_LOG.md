# Prompt Iteration Log

This log tracks revisions to our LLM prompts, documenting the motivation behind each change, failure modes observed during testing, and resulting benchmark improvements.

---

## 📈 Revision History

| Version | Prompt Change | Problem Observed | Result |
|---------|---------------|------------------|--------|
| **v1.0** | Initial baseline prompt definitions for both `classifier_system_prompt_v1.md` and `followup_message_prompt_v1.md`. Added explicit "Kabir Rule" for blocker precedence over partial completion, JSON-only schema constraints, confidence scoring, and graduated follow-up tone. | Untested baseline. Anticipated risks: LLMs frequently confuse *"done with X but waiting on Y"* as `completed` or `in_progress`, and often output markdown code block wrappers (````json ... ````) that break zero-dependency parsers. | `TODO (Awaiting automated eval run on TEST_CASES.md)` |
| **v1.1** | *Planned: Refinements after initial test run* | *TBD based on eval failures* | *TODO* |

---

## 🔬 Benchmark Progression

| Prompt Version | Total Test Cases | Passed | Failed | Accuracy Rate | Notes |
|----------------|------------------|--------|--------|---------------|-------|
| **v1.0** | 15 | `TODO` | `TODO` | `TODO %` | Ready for evaluation runner execution against `prompts/TEST_CASES.md`. |
| **v1.1** | - | - | - | - | Planned post-eval iteration. |
