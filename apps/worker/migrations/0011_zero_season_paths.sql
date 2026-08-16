-- Рост птицы отделён от валюты и не влияет на силу коллективного хода.
CREATE TABLE zero_season_path_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bird TEXT NOT NULL CHECK (bird IN ('woodpecker', 'magpie', 'owl', 'crane')),
  mastery INTEGER NOT NULL DEFAULT 0 CHECK (mastery >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, bird)
);
