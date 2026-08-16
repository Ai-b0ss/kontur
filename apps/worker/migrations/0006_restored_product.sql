-- Восстановленный продукт живёт рядом с V1 и не удаляет данные неудачного V2.
-- Пользовательский текст хранится только после явного сохранения; события ниже
-- содержат лишь тип, статус и режим видимости.

CREATE TABLE restored_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'ask','help','connect','orient','opportunity','contribution','save','progress'
  )),
  status TEXT NOT NULL CHECK (status IN ('planned','active','done')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  chat_code TEXT REFERENCES pilot_chats(code),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','flock')),
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 128),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  UNIQUE (user_id, client_request_id)
);
CREATE INDEX restored_actions_by_user ON restored_actions (user_id, updated_at DESC);
CREATE INDEX restored_actions_visible_connections
  ON restored_actions (kind, visibility, status, updated_at DESC)
  WHERE kind='connect' AND visibility='flock' AND status IN ('planned','active');

CREATE TABLE restored_action_updates (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_id INTEGER NOT NULL REFERENCES restored_actions(id) ON DELETE CASCADE,
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 128),
  status TEXT NOT NULL CHECK (status IN ('planned','active','done')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, client_request_id)
);

CREATE TABLE restored_nest_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('action','opportunity','signal','note')),
  source_id TEXT CHECK (source_id IS NULL OR length(source_id) <= 100),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  next_step TEXT CHECK (next_step IS NULL OR length(next_step) <= 240),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done')),
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 128),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, client_request_id)
);
CREATE INDEX restored_nest_by_user ON restored_nest_items (user_id, status, updated_at DESC);
CREATE UNIQUE INDEX restored_nest_unique_source
  ON restored_nest_items (user_id, source_kind, source_id)
  WHERE source_id IS NOT NULL;

CREATE TRIGGER restored_action_status_monotonic
BEFORE UPDATE OF status ON restored_actions
WHEN (OLD.status = 'done' AND NEW.status <> 'done')
  OR (OLD.status = 'active' AND NEW.status = 'planned')
BEGIN
  SELECT RAISE(ABORT, 'restored action status is monotonic');
END;

CREATE TRIGGER restored_nest_status_monotonic
BEFORE UPDATE OF status ON restored_nest_items
WHEN OLD.status = 'done' AND NEW.status <> 'done'
BEGIN
  SELECT RAISE(ABORT, 'restored nest status is monotonic');
END;

CREATE TABLE restored_nest_updates (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nest_item_id INTEGER NOT NULL REFERENCES restored_nest_items(id) ON DELETE CASCADE,
  client_request_id TEXT NOT NULL CHECK (length(client_request_id) BETWEEN 8 AND 128),
  status TEXT NOT NULL CHECK (status IN ('active','done')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, client_request_id)
);

CREATE TABLE restored_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  motion TEXT NOT NULL DEFAULT 'system' CHECK (motion IN ('system','reduced')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE restored_opportunities (
  code TEXT PRIMARY KEY CHECK (length(code) BETWEEN 1 AND 40),
  kind TEXT NOT NULL CHECK (kind IN ('grant','project','event','resource')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 280),
  action_label TEXT NOT NULL CHECK (length(action_label) BETWEEN 1 AND 60),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO restored_opportunities (code,kind,title,description,action_label,position) VALUES
  ('find-grant','grant','Найти актуальный грант','Сформулируй, для чего нужен ресурс, и попроси стаю подсказать свежую возможность.','Подготовить запрос',1),
  ('join-project','project','Войти в проект','Расскажи, чем можешь быть полезен и сколько времени готов вложить.','Предложить участие',2),
  ('choose-event','event','Выбрать событие','Сохрани интересующую тему и найди человека, с которым пойдёшь или обсудишь результат.','Найти событие',3),
  ('find-resource','resource','Найти ресурс','Запроси контакт, материал, площадку или экспертизу — конкретно и без общего «помогите».','Собрать запрос',4);
