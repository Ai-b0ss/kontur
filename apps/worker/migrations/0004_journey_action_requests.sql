-- Идемпотентность каждого изменяющего действия новой версии.
-- Отдельная таблица нужна, потому что один путь получает несколько запросов,
-- а хранение только последнего ключа не защищает от позднего повтора.

CREATE TABLE journey_action_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 128),
  action TEXT NOT NULL CHECK (action IN (
    'journey_start','journey_prepared','journey_published','journey_outcome_helped',
    'journey_outcome_clarify','journey_outcome_saved','nest_save',
    'nest_next_step','nest_delete','journey_close'
  )),
  journey_id INTEGER REFERENCES journeys(id) ON DELETE CASCADE,
  nest_item_id INTEGER REFERENCES nest_items(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, client_request_id)
);
CREATE INDEX journey_action_requests_by_created_at
  ON journey_action_requests (created_at);
