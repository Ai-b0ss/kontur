-- V5 player data is separate from profiles, wallets, colorings, and all
-- Zero Season tables. No existing bird, egg, or inventory state is reused.
CREATE TABLE v5_wallets (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  eggs INTEGER NOT NULL DEFAULT 0 CHECK (eggs >= 0),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE v5_birds (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bird TEXT NOT NULL CHECK (bird IN ('woodpecker', 'magpie', 'owl', 'crane')),
  form INTEGER NOT NULL DEFAULT 1 CHECK (form IN (1, 2)),
  path_feathers INTEGER NOT NULL DEFAULT 0 CHECK (path_feathers BETWEEN 0 AND 8),
  origin TEXT NOT NULL DEFAULT 'pretest' CHECK (origin IN ('pretest', 'molt')),
  promoted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, bird)
);

CREATE INDEX v5_birds_user_form_idx
  ON v5_birds (user_id, form, bird);

-- No row means no V5 claim. The first successful pretest atomically claims a
-- single base bird; its request key is global so a replay cannot claim twice.
CREATE TABLE v5_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  base_bird TEXT NOT NULL CHECK (base_bird IN ('woodpecker', 'magpie', 'owl', 'crane')),
  pretest_catalog_version TEXT NOT NULL,
  pretest_answers_json TEXT NOT NULL,
  pretest_scores_json TEXT NOT NULL,
  pretest_tiebreaker TEXT,
  client_request_id TEXT NOT NULL UNIQUE,
  claimed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A claimed V5 profile always has exactly one initial bird and wallet without
-- touching the legacy bootstrap trigger.
CREATE TRIGGER v5_profile_bootstrap AFTER INSERT ON v5_profiles
BEGIN
  INSERT INTO v5_birds (user_id, bird, form, path_feathers, origin)
    VALUES (NEW.user_id, NEW.base_bird, 1, 0, 'pretest');
  INSERT OR IGNORE INTO v5_wallets (user_id) VALUES (NEW.user_id);
END;

-- One source bird reaches its form-II choice once. An unlock creates another
-- form-II bird; an evolve targets the source bird itself.
CREATE TABLE v5_bird_molts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_bird TEXT NOT NULL CHECK (source_bird IN ('woodpecker', 'magpie', 'owl', 'crane')),
  target_bird TEXT NOT NULL CHECK (target_bird IN ('woodpecker', 'magpie', 'owl', 'crane')),
  decision TEXT NOT NULL CHECK (decision IN ('evolve', 'unlock')),
  feathers_spent INTEGER NOT NULL DEFAULT 8 CHECK (feathers_spent = 8),
  client_request_id TEXT NOT NULL UNIQUE,
  chosen_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (decision = 'evolve' AND source_bird = target_bird) OR
    (decision = 'unlock' AND source_bird <> target_bird)
  ),
  UNIQUE (user_id, source_bird),
  FOREIGN KEY (user_id, source_bird)
    REFERENCES v5_birds (user_id, bird) ON DELETE CASCADE,
  FOREIGN KEY (user_id, target_bird)
    REFERENCES v5_birds (user_id, bird) ON DELETE CASCADE
);

CREATE INDEX v5_bird_molts_user_idx
  ON v5_bird_molts (user_id, chosen_at);

-- A player may alter their campaign choice until the first session begins.
-- The selection request log makes a replay return its original selection
-- rather than overwriting a newer pre-start choice.
CREATE TABLE v5_campaign_active_birds (
  campaign_id INTEGER NOT NULL REFERENCES v5_campaigns(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bird TEXT NOT NULL CHECK (bird IN ('woodpecker', 'magpie', 'owl', 'crane')),
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
  selected_at TEXT NOT NULL DEFAULT (datetime('now')),
  locked_at TEXT,
  signature_action TEXT CHECK (signature_action IN ('scout', 'claim', 'hold')),
  signature_used_at TEXT,
  signature_request_id TEXT UNIQUE,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  PRIMARY KEY (campaign_id, user_id),
  UNIQUE (campaign_id, user_id, bird),
  CHECK (is_locked = 0 OR locked_at IS NOT NULL),
  FOREIGN KEY (user_id, bird)
    REFERENCES v5_birds (user_id, bird) ON DELETE CASCADE
);

CREATE TABLE v5_campaign_bird_selection_requests (
  campaign_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  bird TEXT NOT NULL CHECK (bird IN ('woodpecker', 'magpie', 'owl', 'crane')),
  client_request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (campaign_id, user_id, client_request_id),
  FOREIGN KEY (campaign_id, user_id)
    REFERENCES v5_campaign_active_birds (campaign_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, bird)
    REFERENCES v5_birds (user_id, bird) ON DELETE CASCADE
);

CREATE INDEX v5_campaign_active_birds_campaign_idx
  ON v5_campaign_active_birds (campaign_id, bird, is_locked);

-- The egg ledger is a distinct audit trail. Entries have server-generated
-- idempotency keys and never model a market, transfer, donation, or purchase.
CREATE TABLE v5_wallet_ledger (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL CHECK (delta <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  source_kind TEXT NOT NULL CHECK (source_kind IN (
    'forecast_stake', 'forecast_payout', 'forecast_void',
    'event_award', 'raid_award', 'campaign_grant'
  )),
  source_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, source_key)
);

CREATE INDEX v5_wallet_ledger_user_created_idx
  ON v5_wallet_ledger (user_id, created_at DESC);

-- Items are physical rows rather than a fungible shop balance. Only owned and
-- armed rows consume one of three slots; consumed/discarded rows are retained
-- as server audit data and cannot be revived.
CREATE TABLE v5_inventory_items (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK (item_kind IN (
    'sharpening-feather', 'nest-resin', 'lens', 'signal-thread'
  )),
  status TEXT NOT NULL DEFAULT 'owned'
    CHECK (status IN ('owned', 'armed', 'consumed', 'discarded')),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('event', 'raid', 'campaign')),
  source_key TEXT NOT NULL,
  created_request_id TEXT NOT NULL UNIQUE,
  armed_at TEXT,
  consumed_at TEXT,
  discarded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, source_key)
);

CREATE TRIGGER v5_inventory_slot_limit_insert
BEFORE INSERT ON v5_inventory_items
WHEN NEW.status IN ('owned', 'armed') AND (
  SELECT count(*)
  FROM v5_inventory_items
  WHERE user_id = NEW.user_id AND status IN ('owned', 'armed')
) >= 3
BEGIN
  SELECT RAISE(ABORT, 'V5_INVENTORY_FULL');
END;

CREATE TRIGGER v5_inventory_item_state_guard
BEFORE UPDATE OF status ON v5_inventory_items
WHEN NOT (
  (OLD.status = 'owned' AND NEW.status IN ('owned', 'armed', 'discarded')) OR
  (OLD.status = 'armed' AND NEW.status IN ('armed', 'owned', 'consumed', 'discarded')) OR
  (OLD.status = 'consumed' AND NEW.status = 'consumed') OR
  (OLD.status = 'discarded' AND NEW.status = 'discarded')
)
BEGIN
  SELECT RAISE(ABORT, 'V5_INVALID_ITEM_TRANSITION');
END;

CREATE INDEX v5_inventory_items_user_status_idx
  ON v5_inventory_items (user_id, status, created_at DESC);
