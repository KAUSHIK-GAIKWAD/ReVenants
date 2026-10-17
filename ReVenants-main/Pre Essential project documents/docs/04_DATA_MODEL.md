# 04. Relational Data Model & Audit Schema

The coordinator maintains project state in Supabase/PostgreSQL. A critical requirement for hackathon credibility is an **immutable audit trail** (`status_history`): every single status change must store the verbatim user message and LLM confidence score that triggered it. The executable PostgreSQL schema is in `supabase_schema.sql`.

---

## 🚦 Task Status Definitions

| Status | Meaning | Valid Next States |
|--------|---------|-------------------|
| **`Pending`** | Task is queued or waiting on prerequisite tasks; work has not yet started. | `In Progress`, `Blocked` |
| **`In Progress`** | Assignee is actively writing code, designing, or researching with no blockers. | `Blocked`, `Complete`, `Pending` |
| **`Blocked`** | Work cannot continue due to an external impediment, missing credentials, or teammate dependency. `blocker` field must be populated. | `In Progress`, `Complete` |
| **`Complete`** | Work is 100% finished, tested, or merged into the codebase. | `In Progress` (if reopened) |

---

## 🗄️ Relational Schema

### 1. `participants` Table
Stores team members and their Telegram contact information.

```sql
CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,               -- e.g. "USER-01"
    name TEXT NOT NULL,                -- e.g. "Kabir Patel"
    telegram_id INTEGER UNIQUE,        -- Numeric Telegram User ID
    telegram_handle TEXT,              -- e.g. "@kabir_p"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. `tasks` Table
Stores current project tasks, assignments, status, and active blockers.

```sql
CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY,          -- e.g. "TASK-103"
    title TEXT NOT NULL,               -- e.g. "Connect the payment API"
    description TEXT,                  -- Detailed scope
    owner_id TEXT NOT NULL,            -- FK -> participants(id)
    status TEXT NOT NULL DEFAULT 'Pending' 
        CHECK(status IN ('Pending', 'In Progress', 'Blocked', 'Complete')),
    progress_percent INTEGER DEFAULT 0 
        CHECK(progress_percent BETWEEN 0 AND 100),
    blocker TEXT,                      -- Non-null when status='Blocked'
    due_date TEXT NOT NULL,            -- ISO8601 string: YYYY-MM-DD
    priority TEXT DEFAULT 'Medium'     -- 'Low', 'Medium', 'High', 'Urgent'
        CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')),
    depends_on_task_id TEXT,           -- FK -> tasks(task_id)
    reminder_count INTEGER DEFAULT 0,  -- Number of unanswered follow-ups sent
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES participants(id),
    FOREIGN KEY (depends_on_task_id) REFERENCES tasks(task_id)
);
```

### 3. `messages` Table
Full transcript log of all inbound student messages and outbound bot follow-ups.

```sql
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_message_id INTEGER,
    sender_id TEXT,                    -- FK -> participants(id) or 'SYSTEM_BOT'
    task_id TEXT,                      -- Associated task ID
    direction TEXT NOT NULL 
        CHECK(direction IN ('inbound', 'outbound')),
    content TEXT NOT NULL,             -- Raw message text
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id)
);
```

### 4. `status_history` Table (Immutable Audit Log)
Records every status transition with the exact raw message that caused it.

```sql
CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    changed_by_message TEXT NOT NULL,  -- Verbatim student message text
    trigger_source TEXT DEFAULT 'telegram_reply', -- 'telegram_reply', 'manual_dashboard', 'init'
    confidence REAL,                   -- LLM classifier confidence (0.0 - 1.0)
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id)
);
```

---

## 🔍 Concrete Audit Trail Example (The Kabir Scenario)

When Kabir replies to the bot follow-up with *"connected, but waiting for test credentials"*, the database executes an atomic transaction:

1. **Update `tasks`**:
   ```sql
   UPDATE tasks 
   SET status = 'Blocked',
       progress_percent = 75,
       blocker = 'waiting for test credentials',
       updated_at = CURRENT_TIMESTAMP
   WHERE task_id = 'TASK-103';
   ```

2. **Insert `status_history`**:
   ```sql
   INSERT INTO status_history (
       task_id, previous_status, new_status, 
       changed_by_message, trigger_source, confidence
   ) VALUES (
       'TASK-103', 'Pending', 'Blocked',
       'connected, but waiting for test credentials',
       'telegram_reply', 0.96
   );
   ```

This provides complete, tamper-proof transparency for judges reviewing the demo.
