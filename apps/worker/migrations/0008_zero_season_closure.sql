-- Одна общая ветвь переживает дни; закрытие дня идемпотентно.
CREATE TABLE zero_season_branch_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  nests_json TEXT NOT NULL,
  shields_json TEXT NOT NULL,
  marks_json TEXT NOT NULL,
  updated_game_day INTEGER NOT NULL
);

CREATE TABLE zero_season_closures (
  game_day INTEGER PRIMARY KEY,
  result_json TEXT NOT NULL,
  closed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
