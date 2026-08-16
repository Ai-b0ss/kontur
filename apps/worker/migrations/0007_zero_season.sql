-- Нулевой сезон изолирован от V1/V3 и остаётся закрытым gate-ом.
CREATE TABLE zero_season_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bird TEXT NOT NULL CHECK (bird IN ('woodpecker', 'magpie', 'owl', 'crane')),
  scores_json TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, client_request_id)
);

CREATE TABLE zero_season_series (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_day INTEGER NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('attack', 'shield', 'scout')),
  nest INTEGER NOT NULL CHECK (nest BETWEEN 0 AND 6),
  correct INTEGER NOT NULL CHECK (correct BETWEEN 0 AND 5),
  effect TEXT NOT NULL CHECK (effect IN ('attack', 'shield', 'scout', 'none')),
  client_request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, game_day),
  UNIQUE (user_id, client_request_id)
);

CREATE INDEX zero_season_series_day_bird_idx
  ON zero_season_series (game_day, user_id);
