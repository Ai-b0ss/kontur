-- Каждые пять недель коллективная ветвь начинается заново; личный прогресс остаётся.
ALTER TABLE zero_season_branch_state ADD COLUMN season_number INTEGER NOT NULL DEFAULT 0;
