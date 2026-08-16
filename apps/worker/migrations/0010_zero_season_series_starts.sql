-- Серверное время старта: быстрый квиз не должен превращаться в поиск ответа.
CREATE TABLE zero_season_series_starts (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_day INTEGER NOT NULL,
  intent TEXT NOT NULL CHECK (intent IN ('attack', 'shield', 'scout')),
  nest INTEGER NOT NULL CHECK (nest BETWEEN 0 AND 6),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, game_day)
);
