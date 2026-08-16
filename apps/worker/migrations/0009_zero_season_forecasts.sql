-- Яйца нулевого сезона существуют только для прогнозов и не передаются.
CREATE TABLE zero_season_egg_wallets (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  eggs INTEGER NOT NULL DEFAULT 0 CHECK (eggs >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE zero_season_forecasts (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_day INTEGER NOT NULL,
  bird TEXT NOT NULL CHECK (bird IN ('woodpecker', 'magpie', 'owl', 'crane')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void')),
  client_request_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, game_day),
  UNIQUE (user_id, client_request_id)
);

CREATE INDEX zero_season_forecasts_day_idx ON zero_season_forecasts (game_day, status);
