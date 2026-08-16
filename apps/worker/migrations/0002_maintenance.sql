-- Повторяемые cron-задачи и ограниченное хранение технических логов.
ALTER TABLE cron_log ADD COLUMN status TEXT NOT NULL DEFAULT 'done'
  CHECK (status IN ('running','done','failed'));
ALTER TABLE cron_log ADD COLUMN attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0);
ALTER TABLE cron_log ADD COLUMN last_error TEXT;

CREATE INDEX rate_limits_by_window ON rate_limits (window);
CREATE INDEX events_by_created_at ON events (created_at);
CREATE INDEX push_log_by_sent_at ON push_log (sent_at);
CREATE INDEX cron_log_by_ran_at ON cron_log (ran_at);
