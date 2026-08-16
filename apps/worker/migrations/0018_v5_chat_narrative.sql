-- V5 access is per explicitly registered campaign chat. Existing V3/V4
-- membership and allowlist behaviour remains entirely outside this schema.
CREATE TABLE v5_chat_memberships (
  chat_id INTEGER NOT NULL REFERENCES v5_campaign_chats(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'verified'
    CHECK (status IN ('verified', 'left', 'banned')),
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX v5_chat_memberships_user_idx
  ON v5_chat_memberships (user_id, status, checked_at DESC);

-- Registration starts disabled. Arming a test group and publishing posts are
-- independent controls; publish may never be enabled while V5 itself is off.
CREATE TABLE v5_chat_settings (
  chat_id INTEGER PRIMARY KEY REFERENCES v5_campaign_chats(id) ON DELETE CASCADE,
  game_enabled INTEGER NOT NULL DEFAULT 0 CHECK (game_enabled IN (0, 1)),
  publish_enabled INTEGER NOT NULL DEFAULT 0 CHECK (publish_enabled IN (0, 1)),
  llm_mode TEXT NOT NULL DEFAULT 'disabled'
    CHECK (llm_mode IN ('disabled', 'cloudflare', 'groq')),
  narrative_catalog_version TEXT NOT NULL DEFAULT 'v1',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (publish_enabled <= game_enabled)
);

CREATE INDEX v5_chat_settings_enabled_idx
  ON v5_chat_settings (game_enabled, publish_enabled);

-- Templates contain only approved server-side keys and safe presentation data.
-- They are not question banks, reward rules, or a source of Telegram posts.
CREATE TABLE v5_narrative_templates (
  template_key TEXT NOT NULL,
  version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('opening', 'summary')),
  payload_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (template_key, version)
);

CREATE INDEX v5_narrative_templates_kind_idx
  ON v5_narrative_templates (kind, is_enabled, version);

-- One validated narrative is selected for each event post. A static fallback
-- is a first-class source, so a disabled/failed LLM cannot block the game.
CREATE TABLE v5_event_narratives (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES v5_events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('opening', 'summary')),
  template_key TEXT NOT NULL,
  template_version TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('static', 'cloudflare', 'groq')),
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'fallback', 'suppressed')),
  safe_topic_key TEXT NOT NULL,
  title TEXT NOT NULL,
  line TEXT NOT NULL,
  result_json TEXT NOT NULL DEFAULT '{}',
  output_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, kind),
  FOREIGN KEY (template_key, template_version)
    REFERENCES v5_narrative_templates (template_key, version) ON DELETE RESTRICT
);

CREATE INDEX v5_event_narratives_dispatch_idx
  ON v5_event_narratives (event_id, kind, status);

-- This log stores only a fingerprint and already validated safe JSON. It never
-- holds an API key, unfiltered chat text, question answer, reward decision, or
-- Telegram delivery authority. The Worker falls back after every non-success.
CREATE TABLE v5_llm_attempts (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES v5_events(id) ON DELETE CASCADE,
  narrative_id INTEGER REFERENCES v5_event_narratives(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('opening', 'summary')),
  provider TEXT NOT NULL CHECK (provider IN ('disabled', 'cloudflare', 'groq')),
  status TEXT NOT NULL CHECK (status IN (
    'skipped', 'started', 'succeeded', 'timeout', 'rate_limited', 'invalid', 'failed'
  )),
  request_fingerprint TEXT NOT NULL,
  response_fingerprint TEXT,
  validated_json TEXT,
  fallback_used INTEGER NOT NULL DEFAULT 0 CHECK (fallback_used IN (0, 1)),
  idempotency_key TEXT NOT NULL UNIQUE,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  UNIQUE (event_id, purpose, provider, request_fingerprint)
);

CREATE INDEX v5_llm_attempts_event_status_idx
  ON v5_llm_attempts (event_id, purpose, status, attempted_at);
