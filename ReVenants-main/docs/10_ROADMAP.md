# 10. Product Roadmap & Growth Features

While our hackathon MVP focuses strictly on the core loop (Telegram message → Claude classification → Supabase update → live dashboard), this roadmap outlines high-value extensions for semester-long student projects and research labs.

---

## 🗺️ Milestone Horizons

```
[Phase 1: Hackathon MVP] ➔ [Phase 2: Project Health & Escalation] ➔ [Phase 3: Autonomous Scheduling] ➔ [Phase 4: Multi-Modal]
```

---

## 🚀 Phase Details

### Phase 1: Hackathon Core MVP (Current)
- [x] Full architectural specification and relational data model.
- [x] Production system prompts with the "Kabir Rule" blocker priority.
- [x] 16 realistic student chat evaluation test cases.
- [ ] Telegram Bot webhook/polling engine with bidirectional routing (`src/bot.py`).
- [ ] Claude structured JSON parser with validation and confidence scoring (`src/classifier.py`).
- [x] Supabase connection factory and PostgreSQL schema with immutable `status_history` audit trail (`src/db/database.py`, `supabase_schema.sql`).
- [ ] Live web dashboard displaying real-time task status badges and blocker notes (`src/dashboard.py`).

---

### Phase 2: Milestone & Risk Reports
- **Weekly Executive Digest for TAs & Mentors**:
  - Automatically generate a markdown/PDF summary of project velocity, completed tasks, and recurring bottlenecks.
  - Distribute summary via email or Telegram group channel every Sunday evening.
- **Dependency Bottleneck Detector**:
  - Automatically calculate critical path risk (e.g. *"Kabir's payment API task is blocking 2 downstream tasks and has been in Blocked state for 36 hours"*).
- **Graduated Team Escalations**:
  - Tier 1: Private DM check-in.
  - Tier 2: Public group chat mention (@handle) with polite dependency warning.
  - Tier 3: Direct notification to project lead or TA if a critical path task stalls.

---

### Phase 3: Meeting-Slot Finding from Teammate Availability
- **Problem**: Scheduling a 30-minute sync across 5 student course schedules takes 20 back-and-forth messages.
- **Natural Language Availability Parsing**:
  - Teammates type their schedule casually: *"Free Thursday after 3 PM and all Friday morning"*.
  - LLM extracts ISO time intervals and calculates the intersection set.
- **Integration with Google Calendar & When2Meet**:
  - One-click Google Meet link generation for the agreed-upon time window.

---

### Phase 4: Multi-Modal & Cross-Platform Support
- **Voice Note Transcription**:
  - Integrate OpenAI Whisper to transcribe informal voice memos sent on the walk between classes.
- **Screenshot / Error Log Parsing**:
  - Use Claude 3.5 Sonnet Vision to analyze terminal error screenshots or Figma links sent as progress proof.
- **Cross-Platform Bot Connectors**:
  - Extend adapter layer to Discord bot and WhatsApp Business API.
