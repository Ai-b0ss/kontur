-- Новый путь участия живёт рядом с прежней игровой системой.
-- Старые роли, кошелёк, окрасы и история не изменяются и не пересчитываются.

CREATE TABLE participation_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'looking'
    CHECK (stage IN ('looking','thread','nest','connection')),
  current_intent TEXT
    CHECK (current_intent IN ('orient','ask','help','return')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE pilot_chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE CHECK (length(code) BETWEEN 1 AND 40),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  purpose TEXT NOT NULL CHECK (length(purpose) BETWEEN 1 AND 240),
  kind TEXT NOT NULL CHECK (kind IN ('general','specialist')),
  telegram_chat_id INTEGER UNIQUE,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE journeys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pilot_chat_id INTEGER REFERENCES pilot_chats(id),
  intent TEXT NOT NULL CHECK (intent IN ('orient','ask','help','return')),
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN (
      'started','prepared','published','waiting','helped','clarify','saved','done','closed'
    )),
  source_chat_id INTEGER,
  source_message_id INTEGER CHECK (source_message_id IS NULL OR source_message_id > 0),
  reply_message_id INTEGER CHECK (reply_message_id IS NULL OR reply_message_id > 0),
  message_link TEXT CHECK (message_link IS NULL OR length(message_link) <= 500),
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 128),
  prepared_at TEXT,
  published_at TEXT,
  outcome_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, client_request_id)
);
CREATE INDEX journeys_by_user ON journeys (user_id, updated_at DESC);
CREATE INDEX journeys_by_message
  ON journeys (source_chat_id, source_message_id)
  WHERE source_chat_id IS NOT NULL AND source_message_id IS NOT NULL;
CREATE UNIQUE INDEX one_active_journey_per_user
  ON journeys (user_id)
  WHERE status NOT IN ('done','closed');

CREATE TABLE help_confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journey_id INTEGER NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  requester_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  helper_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_chat_id INTEGER NOT NULL,
  source_message_id INTEGER NOT NULL CHECK (source_message_id > 0),
  reply_message_id INTEGER NOT NULL CHECK (reply_message_id > 0),
  status TEXT NOT NULL CHECK (status IN ('helped','clarify','review')),
  rejection_reason TEXT,
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 128),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (requester_user_id <> helper_user_id),
  CHECK (source_message_id <> reply_message_id),
  UNIQUE (source_chat_id, source_message_id, reply_message_id),
  UNIQUE (requester_user_id, client_request_id)
);
CREATE INDEX confirmations_by_helper
  ON help_confirmations (helper_user_id, created_at DESC);
CREATE INDEX confirmations_by_pair
  ON help_confirmations (requester_user_id, helper_user_id, created_at DESC);

CREATE TABLE nest_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journey_id INTEGER NOT NULL UNIQUE REFERENCES journeys(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 120),
  status TEXT NOT NULL CHECK (status IN ('waiting','helped','clarify','done')),
  message_link TEXT CHECK (message_link IS NULL OR length(message_link) <= 500),
  next_step TEXT CHECK (next_step IS NULL OR length(trim(next_step)) BETWEEN 1 AND 240),
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 128),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  UNIQUE (user_id, client_request_id)
);
CREATE INDEX nest_items_by_user
  ON nest_items (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE journey_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  journey_id INTEGER REFERENCES journeys(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'journey_started','question_prepared','chat_opened','message_linked',
    'reply_observed','outcome_helped','outcome_clarify','result_saved',
    'next_step_opened','returned_other_day'
  )),
  experience_version TEXT NOT NULL DEFAULT 'v2' CHECK (experience_version = 'v2'),
  client TEXT NOT NULL DEFAULT 'unknown'
    CHECK (client IN ('desktop','ios','android','web','unknown')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX journey_events_by_type ON journey_events (type, created_at DESC);
CREATE INDEX journey_events_by_created_at ON journey_events (created_at);
