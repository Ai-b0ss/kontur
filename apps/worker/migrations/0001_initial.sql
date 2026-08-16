-- Контур on Cloudflare D1. Узкая схема чатового MVP без legacy-сезонов.
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id INTEGER NOT NULL UNIQUE,
  username TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT,
  started_bot_at TEXT,
  is_member INTEGER NOT NULL DEFAULT 0 CHECK (is_member IN (0,1)),
  member_checked_at TEXT,
  banned_at TEXT,
  push_enabled INTEGER NOT NULL DEFAULT 1 CHECK (push_enabled IN (0,1)),
  quiet_from_hour INTEGER NOT NULL DEFAULT 20,
  quiet_to_hour INTEGER NOT NULL DEFAULT 6,
  push_misses INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('designer','coder','creative','manager','vibe')),
  coloring TEXT NOT NULL DEFAULT 'plain',
  hatched_at TEXT,
  bird_name TEXT
);

CREATE TABLE wallets (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  wallet INTEGER NOT NULL DEFAULT 0 CHECK (wallet >= 0),
  reputation INTEGER NOT NULL DEFAULT 0 CHECK (reputation >= 0),
  passive_collected_day INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER users_bootstrap AFTER INSERT ON users BEGIN
  INSERT INTO profiles (user_id) VALUES (NEW.id);
  INSERT INTO wallets (user_id) VALUES (NEW.id);
END;

CREATE TABLE colorings (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common','rare','legendary')),
  palette TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight > 0)
);

CREATE TABLE player_colorings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coloring_code TEXT NOT NULL REFERENCES colorings(code),
  obtained_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, coloring_code)
);

CREATE TABLE onboarding_answers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  client_request_id TEXT NOT NULL UNIQUE,
  answers TEXT NOT NULL,
  role TEXT NOT NULL,
  scores TEXT NOT NULL,
  bird_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER hatch_once BEFORE INSERT ON onboarding_answers
WHEN (SELECT role FROM profiles WHERE user_id = NEW.user_id) IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'ALREADY_HATCHED');
END;

CREATE TRIGGER hatch_apply AFTER INSERT ON onboarding_answers BEGIN
  UPDATE profiles
     SET role = NEW.role,
         hatched_at = datetime('now'),
         bird_name = NEW.bird_name,
         coloring = 'plain'
   WHERE user_id = NEW.user_id;
  INSERT OR IGNORE INTO player_colorings (user_id, coloring_code)
    VALUES (NEW.user_id, 'plain');
END;

CREATE TABLE passive_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_day INTEGER NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  client_request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, game_day),
  UNIQUE (user_id, client_request_id)
);

CREATE TRIGGER passive_apply AFTER INSERT ON passive_claims BEGIN
  UPDATE wallets
     SET wallet = wallet + NEW.amount,
         passive_collected_day = NEW.game_day,
         updated_at = datetime('now')
   WHERE user_id = NEW.user_id;
END;

CREATE TABLE worm_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT,
  chat_message_id INTEGER,
  game_day INTEGER NOT NULL,
  daily_budget INTEGER NOT NULL CHECK (daily_budget > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (from_user_id <> to_user_id),
  UNIQUE (from_user_id, to_user_id, game_day)
);

CREATE INDEX grants_to_user ON worm_grants (to_user_id, created_at DESC);
CREATE INDEX grants_from_day ON worm_grants (from_user_id, game_day);
CREATE INDEX grants_pair_recent ON worm_grants (from_user_id, to_user_id, created_at DESC);

CREATE TRIGGER worm_daily_budget BEFORE INSERT ON worm_grants
WHEN (SELECT count(*) FROM worm_grants
       WHERE from_user_id = NEW.from_user_id AND game_day = NEW.game_day) >= NEW.daily_budget
BEGIN
  SELECT RAISE(ABORT, 'DAILY_LIMIT');
END;

CREATE TRIGGER worm_apply AFTER INSERT ON worm_grants BEGIN
  UPDATE wallets
     SET wallet = wallet + NEW.amount,
         reputation = reputation + NEW.amount,
         updated_at = datetime('now')
   WHERE user_id = NEW.to_user_id;
END;

CREATE TABLE egg_pulls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coloring_code TEXT NOT NULL REFERENCES colorings(code),
  duplicate INTEGER NOT NULL CHECK (duplicate IN (0,1)),
  spend INTEGER NOT NULL CHECK (spend >= 0),
  announced INTEGER NOT NULL DEFAULT 0 CHECK (announced IN (0,1)),
  client_request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, client_request_id)
);

CREATE TRIGGER egg_apply AFTER INSERT ON egg_pulls BEGIN
  UPDATE wallets
     SET wallet = wallet - NEW.spend, updated_at = datetime('now')
   WHERE user_id = NEW.user_id;
  INSERT OR IGNORE INTO player_colorings (user_id, coloring_code)
    VALUES (NEW.user_id, NEW.coloring_code);
END;

CREATE TABLE nest_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_day INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (visitor_id <> host_id),
  UNIQUE (visitor_id, host_id, game_day)
);

CREATE TABLE signal_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('cu_event','agency_case','own_project')),
  title TEXT NOT NULL,
  reference_code TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX signal_cards_by_user ON signal_cards (user_id, issued_at DESC);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX events_by_type ON events (type, created_at DESC);

CREATE TABLE push_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  game_day INTEGER NOT NULL,
  kind TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, game_day, kind)
);

CREATE TABLE cron_log (
  job TEXT NOT NULL,
  game_day INTEGER NOT NULL,
  ran_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (job, game_day)
);

CREATE TABLE rate_limits (
  user_id INTEGER NOT NULL,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window)
);

INSERT INTO colorings (code,title,rarity,weight,palette) VALUES
('plain','Обычный','common',20,'{"body":"#edd9b6","belly":"#faeed6","wing":"#d3ae74","tail":"#c09a68","crest":"#c8a26c","beak":"#ef8a52"}'),
('soot','Копчёный','common',16,'{"body":"#8d8794","belly":"#c4bfc9","wing":"#6f6a77","tail":"#5d5865","crest":"#6f6a77","beak":"#e0a05a"}'),
('clay','Глиняный','common',16,'{"body":"#c98f6a","belly":"#e8c3a4","wing":"#a9704f","tail":"#95613f","crest":"#a9704f","beak":"#e8b04a"}'),
('moss','Мшистый','common',16,'{"body":"#9aae86","belly":"#cfdcbd","wing":"#778a63","tail":"#657653","crest":"#778a63","beak":"#e6a24f"}'),
('ember','Уголёк','rare',9,'{"body":"#e07a4f","belly":"#ffc79a","wing":"#bd5a35","tail":"#9d4526","crest":"#ff9d5c","beak":"#ffd07a"}'),
('frost','Иней','rare',9,'{"body":"#b9d7e8","belly":"#eaf6ff","wing":"#8fb8d0","tail":"#7aa3bd","crest":"#d6ecfa","beak":"#f0a05a"}'),
('plum','Сливовый','rare',9,'{"body":"#9a7bb8","belly":"#d9c6ea","wing":"#7c5d9b","tail":"#654a80","crest":"#b193cd","beak":"#f0a05a"}'),
('aurora','Полярный','legendary',2,'{"body":"#7fe3c0","belly":"#d6fff2","wing":"#4fb8f5","tail":"#7a6bf0","crest":"#a8f0d8","beak":"#ffd07a"}'),
('gilded','Золочёный','legendary',2,'{"body":"#e8c65a","belly":"#fff2c0","wing":"#c99f2e","tail":"#a8811d","crest":"#ffe08a","beak":"#fff0b0"}'),
('void','Беззвёздный','legendary',1,'{"body":"#2b2740","belly":"#453f63","wing":"#1d1a2e","tail":"#15121f","crest":"#6a5fa0","beak":"#c5b8ff"}');
