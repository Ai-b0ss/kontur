-- В каждом сезоне активна только одна птица, но ранги всех направлений сохраняются.
CREATE TABLE zero_season_active_birds (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL CHECK (season_number >= 0),
  bird TEXT NOT NULL CHECK (bird IN ('woodpecker', 'magpie', 'owl', 'crane')),
  client_request_id TEXT NOT NULL,
  chosen_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, season_number),
  UNIQUE (user_id, client_request_id)
);
