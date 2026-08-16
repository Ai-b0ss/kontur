-- Добровольный общий полёт: 4–6 участников синхронизируют обычный суточный ход.
CREATE TABLE zero_season_flights (
  id INTEGER PRIMARY KEY,
  game_day INTEGER NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('attack', 'shield', 'scout')),
  nest INTEGER NOT NULL CHECK (nest BETWEEN 0 AND 6),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ready')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE zero_season_flight_members (
  flight_id INTEGER NOT NULL REFERENCES zero_season_flights(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_day INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  client_request_id TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  left_at TEXT,
  PRIMARY KEY (flight_id, user_id),
  UNIQUE (user_id, game_day)
);

CREATE INDEX zero_season_flights_day_idx ON zero_season_flights (game_day, status);
