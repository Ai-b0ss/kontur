-- V5 is fully isolated from V1-V4. A registered campaign chat is the only
-- place where the new campaign engine may operate; no legacy chat setting is
-- read or altered by these tables.
CREATE TABLE v5_campaign_chats (
  id INTEGER PRIMARY KEY,
  telegram_chat_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'armed', 'paused')),
  campaign_id INTEGER,
  schedule_json TEXT NOT NULL DEFAULT '{}',
  next_event_at TEXT,
  created_request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  armed_at TEXT,
  paused_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status <> 'armed' OR armed_at IS NOT NULL)
);

CREATE INDEX v5_campaign_chats_status_next_idx
  ON v5_campaign_chats (status, next_event_at);

-- One 28-day campaign belongs to one explicitly registered chat. The nullable
-- pointer on v5_campaign_chats is intentionally maintained in the same
-- transaction as activation, because this table must precede campaigns.
CREATE TABLE v5_campaigns (
  id INTEGER PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES v5_campaign_chats(id) ON DELETE CASCADE,
  campaign_number INTEGER NOT NULL CHECK (campaign_number >= 0),
  catalog_key TEXT NOT NULL,
  catalog_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'resolved', 'archived')),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_request_key TEXT NOT NULL,
  activated_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (ends_at > starts_at),
  UNIQUE (chat_id, campaign_number),
  UNIQUE (chat_id, created_request_key)
);

CREATE UNIQUE INDEX v5_campaigns_one_active_per_chat_idx
  ON v5_campaigns (chat_id)
  WHERE status = 'active';

CREATE INDEX v5_campaigns_by_chat_window_idx
  ON v5_campaigns (chat_id, status, starts_at, ends_at);

-- The nullable pointer was declared before campaigns so a new chat can be
-- registered without a campaign. Once set, it must point back to that chat.
CREATE TRIGGER v5_campaign_chat_campaign_pointer_guard
BEFORE UPDATE OF campaign_id ON v5_campaign_chats
WHEN NEW.campaign_id IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM v5_campaigns
  WHERE id = NEW.campaign_id AND chat_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'V5_CAMPAIGN_CHAT_MISMATCH');
END;

CREATE TRIGGER v5_campaign_chat_clear_deleted_campaign
AFTER DELETE ON v5_campaigns
BEGIN
  UPDATE v5_campaign_chats
     SET campaign_id = NULL,
         updated_at = datetime('now')
   WHERE id = OLD.chat_id AND campaign_id = OLD.id;
END;

-- Seven persistent sectors form the tree. Mutations are written separately so
-- a resolver can prove a compare-and-swap result without deriving it from UI.
CREATE TABLE v5_campaign_sectors (
  campaign_id INTEGER NOT NULL REFERENCES v5_campaigns(id) ON DELETE CASCADE,
  sector INTEGER NOT NULL CHECK (sector BETWEEN 0 AND 6),
  state TEXT NOT NULL DEFAULT 'hidden'
    CHECK (state IN ('hidden', 'exposed', 'secured', 'rooted')),
  ward_count INTEGER NOT NULL DEFAULT 0 CHECK (ward_count >= 0),
  next_storm_at TEXT,
  next_risk_key TEXT,
  safety_exposed INTEGER NOT NULL DEFAULT 0 CHECK (safety_exposed IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (campaign_id, sector)
);

CREATE INDEX v5_campaign_sectors_state_idx
  ON v5_campaign_sectors (campaign_id, state, sector);

-- An event is a bounded eight-hour (or shorter) campaign window. Thresholds
-- are snapshotted at opening so later activity cannot silently move a goal.
CREATE TABLE v5_events (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES v5_campaigns(id) ON DELETE CASCADE,
  event_number INTEGER NOT NULL CHECK (event_number >= 0),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'open', 'locked', 'resolved')),
  catalog_key TEXT NOT NULL,
  event_tier INTEGER NOT NULL CHECK (event_tier BETWEEN 1 AND 5),
  active_players_7d INTEGER NOT NULL DEFAULT 0 CHECK (active_players_7d >= 0),
  threshold INTEGER NOT NULL CHECK (threshold BETWEEN 3 AND 12),
  storm_sector INTEGER CHECK (storm_sector BETWEEN 0 AND 6),
  safety_rail INTEGER NOT NULL DEFAULT 0 CHECK (safety_rail IN (0, 1)),
  opens_at TEXT NOT NULL,
  locks_at TEXT NOT NULL,
  forecast_deadline TEXT NOT NULL,
  created_request_key TEXT NOT NULL,
  result_json TEXT NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  opened_at TEXT,
  locked_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (locks_at > opens_at),
  CHECK (forecast_deadline >= opens_at AND forecast_deadline <= locks_at),
  UNIQUE (campaign_id, event_number),
  UNIQUE (campaign_id, created_request_key)
);

-- A chat may schedule future windows, but it can never have two live V5
-- events. A locked event still reserves the chat until its resolver finishes.
CREATE UNIQUE INDEX v5_events_one_live_per_campaign_idx
  ON v5_events (campaign_id)
  WHERE status IN ('open', 'locked');

CREATE INDEX v5_events_due_idx
  ON v5_events (status, opens_at, locks_at, forecast_deadline);

CREATE INDEX v5_events_campaign_status_idx
  ON v5_events (campaign_id, status, event_number);

-- Each action/sector scale is separate. The resolver clamps a contribution
-- before incrementing progress, and the CHECK makes an accidental overflow
-- fail instead of changing campaign balance.
CREATE TABLE v5_event_objectives (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES v5_events(id) ON DELETE CASCADE,
  sector INTEGER NOT NULL CHECK (sector BETWEEN 0 AND 6),
  action TEXT NOT NULL CHECK (action IN ('scout', 'claim', 'hold')),
  opening_state TEXT NOT NULL
    CHECK (opening_state IN ('hidden', 'exposed', 'secured', 'rooted')),
  threshold INTEGER NOT NULL CHECK (threshold BETWEEN 3 AND 12),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= threshold),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'failed', 'void')),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  completed_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, sector, action)
);

CREATE INDEX v5_event_objectives_lookup_idx
  ON v5_event_objectives (event_id, status, sector, action);

-- A durable append-only map audit prevents a repeated cron/action resolver
-- from applying a storm, ward, or transition twice.
CREATE TABLE v5_map_mutations (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  event_id INTEGER REFERENCES v5_events(id) ON DELETE CASCADE,
  objective_id INTEGER REFERENCES v5_event_objectives(id) ON DELETE SET NULL,
  sector INTEGER NOT NULL CHECK (sector BETWEEN 0 AND 6),
  mutation_kind TEXT NOT NULL CHECK (mutation_kind IN (
    'reveal', 'secure', 'root', 'storm', 'ward_added', 'ward_consumed', 'safety_rail'
  )),
  before_state TEXT NOT NULL
    CHECK (before_state IN ('hidden', 'exposed', 'secured', 'rooted')),
  after_state TEXT NOT NULL
    CHECK (after_state IN ('hidden', 'exposed', 'secured', 'rooted')),
  wards_before INTEGER NOT NULL CHECK (wards_before >= 0),
  wards_after INTEGER NOT NULL CHECK (wards_after >= 0),
  mutation_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id, sector)
    REFERENCES v5_campaign_sectors (campaign_id, sector) ON DELETE CASCADE
);

CREATE INDEX v5_map_mutations_campaign_sector_idx
  ON v5_map_mutations (campaign_id, sector, created_at);

CREATE INDEX v5_map_mutations_event_idx
  ON v5_map_mutations (event_id, created_at);

-- Delivery is intentionally at-most-once per event/kind. If Telegram's result
-- is unknown, the worker marks the row suppressed rather than creating a
-- duplicate post in the community chat.
CREATE TABLE v5_telegram_outbox (
  id INTEGER PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES v5_campaign_chats(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES v5_campaigns(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES v5_events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('opening', 'summary')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'claimed', 'sent', 'suppressed', 'failed')),
  payload_json TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claim_token TEXT,
  claimed_at TEXT,
  sent_at TEXT,
  telegram_message_id INTEGER,
  last_error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, kind)
);

CREATE INDEX v5_telegram_outbox_dispatch_idx
  ON v5_telegram_outbox (status, created_at);
