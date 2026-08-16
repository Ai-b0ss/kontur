-- V5 writes are deliberately modeled as one-way records. V1-V4 session,
-- forecast, and flight data stays untouched and is never joined here.
CREATE TABLE v5_sessions (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL REFERENCES v5_events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_bird TEXT NOT NULL CHECK (active_bird IN ('woodpecker', 'magpie', 'owl', 'crane')),
  sector INTEGER NOT NULL CHECK (sector BETWEEN 0 AND 6),
  action TEXT NOT NULL CHECK (action IN ('scout', 'claim', 'hold')),
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'submitted', 'settled', 'timed_out')),
  seed TEXT NOT NULL,
  catalog_version TEXT NOT NULL,
  map_revision INTEGER NOT NULL CHECK (map_revision >= 0),
  map_snapshot_json TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  close_at TEXT NOT NULL,
  submitted_at TEXT,
  settled_at TEXT,
  correct_count INTEGER CHECK (correct_count BETWEEN 0 AND 5),
  tactical_correct INTEGER CHECK (tactical_correct IN (0, 1)),
  evidence_score INTEGER CHECK (evidence_score BETWEEN 0 AND 2),
  result_json TEXT,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  CHECK (close_at > started_at),
  UNIQUE (event_id, user_id),
  UNIQUE (user_id, client_request_id),
  FOREIGN KEY (campaign_id, user_id, active_bird)
    REFERENCES v5_campaign_active_birds (campaign_id, user_id, bird) ON DELETE RESTRICT
);

CREATE INDEX v5_sessions_event_status_idx
  ON v5_sessions (event_id, status, sector, action);

CREATE INDEX v5_sessions_close_idx
  ON v5_sessions (status, close_at);

-- Five immutable server-side card records let a returning device receive the
-- same variant while keeping the correct option out of the client response.
CREATE TABLE v5_session_cards (
  session_id INTEGER NOT NULL REFERENCES v5_sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),
  kind TEXT NOT NULL CHECK (kind IN (
    'base', 'track', 'chain', 'tactical', 'risk'
  )),
  prompt_key TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  render_json TEXT NOT NULL,
  correct_option INTEGER NOT NULL CHECK (correct_option BETWEEN 0 AND 7),
  PRIMARY KEY (session_id, position),
  UNIQUE (session_id, kind)
);

CREATE TABLE v5_session_submissions (
  session_id INTEGER PRIMARY KEY REFERENCES v5_sessions(id) ON DELETE CASCADE,
  client_request_id TEXT NOT NULL UNIQUE,
  answers_json TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  was_late INTEGER NOT NULL DEFAULT 0 CHECK (was_late IN (0, 1)),
  correct_count INTEGER NOT NULL CHECK (correct_count BETWEEN 0 AND 5),
  tactical_correct INTEGER NOT NULL CHECK (tactical_correct IN (0, 1)),
  evidence_score INTEGER NOT NULL CHECK (evidence_score BETWEEN 0 AND 2),
  result_json TEXT NOT NULL
);

-- The first session locks the campaign bird. This trigger deliberately does
-- not award anything and cannot create an extra move on a retried request.
CREATE TRIGGER v5_session_lock_active_bird
AFTER INSERT ON v5_sessions
BEGIN
  UPDATE v5_campaign_active_birds
     SET is_locked = 1,
         locked_at = COALESCE(locked_at, NEW.started_at)
   WHERE campaign_id = NEW.campaign_id
     AND user_id = NEW.user_id;
END;

CREATE TRIGGER v5_active_bird_no_switch_after_session
BEFORE UPDATE OF bird ON v5_campaign_active_birds
WHEN EXISTS (
  SELECT 1
  FROM v5_sessions
  WHERE campaign_id = OLD.campaign_id AND user_id = OLD.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'V5_ACTIVE_BIRD_LOCKED');
END;

-- A session may arm at most one owned item. Ownership is checked at insert and
-- the transition of the item is carried out in the same SQLite transaction.
CREATE TABLE v5_session_items (
  session_id INTEGER PRIMARY KEY REFERENCES v5_sessions(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL UNIQUE
    REFERENCES v5_inventory_items(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'armed'
    CHECK (status IN ('armed', 'consumed', 'released')),
  armed_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TRIGGER v5_session_item_owner_guard
BEFORE INSERT ON v5_session_items
WHEN NOT EXISTS (
  SELECT 1
  FROM v5_sessions AS s
  JOIN v5_inventory_items AS i ON i.id = NEW.inventory_item_id
  WHERE s.id = NEW.session_id
    AND i.user_id = s.user_id
    AND i.status = 'owned'
)
BEGIN
  SELECT RAISE(ABORT, 'V5_ITEM_NOT_OWNED');
END;

CREATE TRIGGER v5_session_item_arm
AFTER INSERT ON v5_session_items
BEGIN
  UPDATE v5_inventory_items
     SET status = 'armed',
         armed_at = NEW.armed_at,
         updated_at = NEW.armed_at
   WHERE id = NEW.inventory_item_id;
END;

CREATE TRIGGER v5_session_item_state_guard
BEFORE UPDATE OF status ON v5_session_items
WHEN NOT (
  (OLD.status = 'armed' AND NEW.status IN ('armed', 'consumed', 'released')) OR
  (OLD.status = 'consumed' AND NEW.status = 'consumed') OR
  (OLD.status = 'released' AND NEW.status = 'released')
)
BEGIN
  SELECT RAISE(ABORT, 'V5_INVALID_SESSION_ITEM_TRANSITION');
END;

CREATE TRIGGER v5_session_item_consume
AFTER UPDATE OF status ON v5_session_items
WHEN OLD.status = 'armed' AND NEW.status = 'consumed'
BEGIN
  UPDATE v5_inventory_items
     SET status = 'consumed',
         consumed_at = COALESCE(NEW.resolved_at, datetime('now')),
         updated_at = COALESCE(NEW.resolved_at, datetime('now'))
   WHERE id = NEW.inventory_item_id;
END;

CREATE TRIGGER v5_session_item_release
AFTER UPDATE OF status ON v5_session_items
WHEN OLD.status = 'armed' AND NEW.status = 'released'
BEGIN
  UPDATE v5_inventory_items
     SET status = 'owned',
         armed_at = NULL,
         updated_at = COALESCE(NEW.resolved_at, datetime('now'))
   WHERE id = NEW.inventory_item_id;
END;

-- Exactly one resolved action belongs to a solo session. Total impact has an
-- explicit hard cap of two even if a form-II maneuver or item was armed.
CREATE TABLE v5_event_actions (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES v5_events(id) ON DELETE CASCADE,
  objective_id INTEGER NOT NULL REFERENCES v5_event_objectives(id) ON DELETE RESTRICT,
  session_id INTEGER NOT NULL UNIQUE REFERENCES v5_sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector INTEGER NOT NULL CHECK (sector BETWEEN 0 AND 6),
  action TEXT NOT NULL CHECK (action IN ('scout', 'claim', 'hold')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'void')),
  base_value INTEGER NOT NULL CHECK (base_value BETWEEN 0 AND 2),
  item_bonus INTEGER NOT NULL DEFAULT 0 CHECK (item_bonus BETWEEN 0 AND 1),
  maneuver_bonus INTEGER NOT NULL DEFAULT 0 CHECK (maneuver_bonus BETWEEN 0 AND 1),
  total_value INTEGER NOT NULL CHECK (total_value BETWEEN 0 AND 2),
  idempotency_key TEXT NOT NULL UNIQUE,
  applied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, user_id)
);

CREATE INDEX v5_event_actions_objective_idx
  ON v5_event_actions (objective_id, status, created_at);

-- Forecasts are anonymous in every player-facing query; the user reference is
-- retained only for server-side debit, settlement, and replay protection.
CREATE TABLE v5_predictions (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES v5_campaigns(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES v5_events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector INTEGER NOT NULL CHECK (sector BETWEEN 0 AND 6),
  action TEXT NOT NULL CHECK (action IN ('scout', 'claim', 'hold')),
  market_kind TEXT NOT NULL DEFAULT 'objective_complete'
    CHECK (market_kind IN ('objective_complete')),
  predicted_outcome TEXT NOT NULL CHECK (predicted_outcome IN ('complete', 'incomplete')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'won', 'lost', 'void')),
  stake INTEGER NOT NULL DEFAULT 1 CHECK (stake = 1),
  payout INTEGER NOT NULL DEFAULT 0 CHECK (payout IN (0, 1, 2)),
  forecast_deadline TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  placed_at TEXT NOT NULL DEFAULT (datetime('now')),
  settled_at TEXT,
  CHECK (
    (status = 'pending' AND payout = 0 AND settled_at IS NULL) OR
    (status = 'won' AND payout = 2 AND settled_at IS NOT NULL) OR
    (status = 'lost' AND payout = 0 AND settled_at IS NOT NULL) OR
    (status = 'void' AND payout = 1 AND settled_at IS NOT NULL)
  ),
  UNIQUE (event_id, user_id),
  UNIQUE (user_id, client_request_id)
);

-- A forecast cannot be placed after a move that can influence exactly the
-- selected objective. The Worker also checks the event deadline using its
-- canonical server clock before attempting this write.
CREATE TRIGGER v5_prediction_influence_guard
BEFORE INSERT ON v5_predictions
WHEN EXISTS (
  SELECT 1
  FROM v5_sessions
  WHERE event_id = NEW.event_id
    AND sector = NEW.sector
    AND action = NEW.action
)
BEGIN
  SELECT RAISE(ABORT, 'V5_FORECAST_LOCKED');
END;

CREATE TRIGGER v5_prediction_egg_guard
BEFORE INSERT ON v5_predictions
WHEN COALESCE((
  SELECT eggs FROM v5_wallets WHERE user_id = NEW.user_id
), 0) < 1
BEGIN
  SELECT RAISE(ABORT, 'V5_NOT_ENOUGH_EGGS');
END;

CREATE TRIGGER v5_prediction_stake_apply
AFTER INSERT ON v5_predictions
BEGIN
  UPDATE v5_wallets
     SET eggs = eggs - 1,
         revision = revision + 1,
         updated_at = NEW.placed_at
   WHERE user_id = NEW.user_id;
  INSERT INTO v5_wallet_ledger (
    user_id, delta, balance_after, source_kind, source_key, idempotency_key, created_at
  ) VALUES (
    NEW.user_id,
    -1,
    (SELECT eggs FROM v5_wallets WHERE user_id = NEW.user_id),
    'forecast_stake',
    printf('prediction:%d:stake', NEW.id),
    printf('prediction:%d:stake', NEW.id),
    NEW.placed_at
  );
END;

CREATE TRIGGER v5_prediction_final_state_guard
BEFORE UPDATE OF status ON v5_predictions
WHEN OLD.status <> 'pending' AND NEW.status <> OLD.status
BEGIN
  SELECT RAISE(ABORT, 'V5_PREDICTION_ALREADY_SETTLED');
END;

CREATE TRIGGER v5_prediction_payout_apply
AFTER UPDATE OF status ON v5_predictions
WHEN OLD.status = 'pending' AND NEW.status IN ('won', 'lost', 'void')
BEGIN
  UPDATE v5_wallets
     SET eggs = eggs + NEW.payout,
         revision = revision + 1,
         updated_at = NEW.settled_at
   WHERE user_id = NEW.user_id;
  INSERT INTO v5_wallet_ledger (
    user_id, delta, balance_after, source_kind, source_key, idempotency_key, created_at
  ) SELECT
    NEW.user_id,
    NEW.payout,
    (SELECT eggs FROM v5_wallets WHERE user_id = NEW.user_id),
    CASE NEW.status
      WHEN 'won' THEN 'forecast_payout'
      WHEN 'void' THEN 'forecast_void'
      ELSE 'forecast_payout'
    END,
    printf('prediction:%d:settlement', NEW.id),
    printf('prediction:%d:settlement', NEW.id),
    NEW.settled_at
  WHERE NEW.payout <> 0;
END;

CREATE INDEX v5_predictions_event_status_idx
  ON v5_predictions (event_id, status, sector, action);

CREATE INDEX v5_predictions_user_created_idx
  ON v5_predictions (user_id, placed_at DESC);

-- Raids never replace a normal session. A player may join one event raid and
-- still own their independent solo move for that event.
CREATE TABLE v5_raids (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES v5_campaigns(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES v5_events(id) ON DELETE CASCADE,
  target_sector INTEGER NOT NULL CHECK (target_sector BETWEEN 0 AND 6),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'ready', 'resolved', 'withdrawn', 'dissolved')),
  min_members INTEGER NOT NULL DEFAULT 4 CHECK (min_members = 4),
  max_members INTEGER NOT NULL DEFAULT 6 CHECK (max_members = 6),
  required_completion_ratio REAL NOT NULL DEFAULT 0.6
    CHECK (required_completion_ratio >= 0.6 AND required_completion_ratio <= 1.0),
  reward_item_kind TEXT NOT NULL CHECK (reward_item_kind IN (
    'sharpening-feather', 'nest-resin', 'lens', 'signal-thread'
  )),
  reward_route_sector INTEGER CHECK (reward_route_sector BETWEEN 0 AND 6),
  client_request_key TEXT NOT NULL UNIQUE,
  queue_closes_at TEXT NOT NULL,
  ready_at TEXT,
  resolved_at TEXT,
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (queue_closes_at >= created_at),
  UNIQUE (event_id, target_sector)
);

CREATE INDEX v5_raids_event_status_idx
  ON v5_raids (event_id, status, queue_closes_at);

CREATE TABLE v5_raid_members (
  raid_id INTEGER NOT NULL REFERENCES v5_raids(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES v5_events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_role TEXT NOT NULL CHECK (assigned_role IN ('scout', 'claim', 'hold')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'ready', 'started', 'submitted', 'settled', 'withdrawn', 'dissolved')),
  attempt_seed TEXT,
  attempt_started_at TEXT,
  attempt_close_at TEXT,
  attempt_answers_json TEXT,
  correct_count INTEGER CHECK (correct_count BETWEEN 0 AND 2),
  client_request_id TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  PRIMARY KEY (raid_id, user_id),
  UNIQUE (event_id, user_id),
  UNIQUE (user_id, client_request_id)
);

CREATE TRIGGER v5_raid_member_event_guard
BEFORE INSERT ON v5_raid_members
WHEN NOT EXISTS (
  SELECT 1 FROM v5_raids
  WHERE id = NEW.raid_id AND event_id = NEW.event_id
)
BEGIN
  SELECT RAISE(ABORT, 'V5_RAID_EVENT_MISMATCH');
END;

CREATE INDEX v5_raid_members_ready_idx
  ON v5_raid_members (raid_id, status, assigned_role);

CREATE TABLE v5_raid_cards (
  raid_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 2),
  prompt_key TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  render_json TEXT NOT NULL,
  correct_option INTEGER NOT NULL CHECK (correct_option BETWEEN 0 AND 7),
  PRIMARY KEY (raid_id, user_id, position),
  FOREIGN KEY (raid_id, user_id)
    REFERENCES v5_raid_members (raid_id, user_id) ON DELETE CASCADE
);

CREATE TABLE v5_raid_rewards (
  raid_id INTEGER NOT NULL REFERENCES v5_raids(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inventory_item_id INTEGER UNIQUE REFERENCES v5_inventory_items(id) ON DELETE SET NULL,
  route_sector INTEGER CHECK (route_sector BETWEEN 0 AND 6),
  grant_key TEXT NOT NULL UNIQUE,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (raid_id, user_id)
);

-- Reply invocation records identifiers and an allowed action only. The source
-- message text is intentionally not stored or inspected by the V5 product.
CREATE TABLE v5_chat_contracts (
  id INTEGER PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES v5_campaign_chats(id) ON DELETE CASCADE,
  source_message_id INTEGER NOT NULL,
  requester_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_action TEXT NOT NULL CHECK (requested_action IN ('scout', 'claim', 'hold', 'raid')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'scheduled', 'fulfilled', 'expired', 'cancelled')),
  scheduled_event_id INTEGER UNIQUE REFERENCES v5_events(id) ON DELETE SET NULL,
  client_request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  resolved_at TEXT,
  UNIQUE (chat_id, source_message_id),
  UNIQUE (requester_user_id, client_request_id)
);

CREATE INDEX v5_chat_contracts_schedule_idx
  ON v5_chat_contracts (chat_id, status, created_at);
