-- Одно личное напоминание только после явного согласия участника.

CREATE TABLE journey_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nest_item_id INTEGER NOT NULL UNIQUE REFERENCES nest_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','cancelled')),
  due_at TEXT NOT NULL DEFAULT (datetime('now','+1 day')),
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 128),
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, client_request_id)
);
CREATE INDEX journey_reminders_due
  ON journey_reminders (status, due_at);
