-- Канонический визуальный результат теста должен переживать новый WebView/устройство.
-- Игровая роль остаётся прежней пятизначной таксономией; это только presentation identity.

ALTER TABLE profiles ADD COLUMN bird_result_id TEXT
  CHECK (bird_result_id IS NULL OR bird_result_id IN ('magpie','woodpecker','jay','crane','owl','kotosov'));

-- Восстанавливаем идентичность уже вылупившихся пользователей из сохранённых
-- role + scores. Для неполного/повреждённого vibe-профиля безопасный fallback — owl.
-- JSON-функциям всегда передаётся валидный объект: одного `json_valid(...) AND ...`
-- недостаточно, потому что SQLite не обещает короткое замыкание выражений AND.
UPDATE profiles
SET bird_result_id = CASE role
  WHEN 'designer' THEN 'magpie'
  WHEN 'coder' THEN 'woodpecker'
  WHEN 'creative' THEN 'jay'
  WHEN 'manager' THEN 'crane'
  WHEN 'vibe' THEN CASE
    WHEN EXISTS (
      SELECT 1
      FROM onboarding_answers oa
      WHERE oa.user_id = profiles.user_id
        AND json_valid(oa.scores)
        AND json_type(CASE WHEN json_valid(oa.scores) THEN oa.scores ELSE '{}' END, '$.coder') IN ('integer','real')
        AND json_type(CASE WHEN json_valid(oa.scores) THEN oa.scores ELSE '{}' END, '$.designer') IN ('integer','real')
        AND json_type(CASE WHEN json_valid(oa.scores) THEN oa.scores ELSE '{}' END, '$.creative') IN ('integer','real')
        AND json_type(CASE WHEN json_valid(oa.scores) THEN oa.scores ELSE '{}' END, '$.manager') IN ('integer','real')
        AND CAST(json_extract(CASE WHEN json_valid(oa.scores) THEN oa.scores ELSE '{}' END, '$.coder') AS REAL) > CAST(json_extract(CASE WHEN json_valid(oa.scores) THEN oa.scores ELSE '{}' END, '$.designer') AS REAL)
        AND CAST(json_extract(CASE WHEN json_valid(oa.scores) THEN oa.scores ELSE '{}' END, '$.coder') AS REAL) > CAST(json_extract(CASE WHEN json_valid(oa.scores) THEN oa.scores ELSE '{}' END, '$.creative') AS REAL)
        AND CAST(json_extract(CASE WHEN json_valid(oa.scores) THEN oa.scores ELSE '{}' END, '$.coder') AS REAL) > CAST(json_extract(CASE WHEN json_valid(oa.scores) THEN oa.scores ELSE '{}' END, '$.manager') AS REAL)
    ) THEN 'kotosov'
    ELSE 'owl'
  END
  ELSE NULL
END
WHERE role IS NOT NULL;

-- Новый hatch записывает ту же каноническую identity атомарно с прежними полями.
DROP TRIGGER IF EXISTS hatch_apply;
CREATE TRIGGER hatch_apply AFTER INSERT ON onboarding_answers BEGIN
  UPDATE profiles
     SET role = NEW.role,
         bird_result_id = CASE NEW.role
           WHEN 'designer' THEN 'magpie'
           WHEN 'coder' THEN 'woodpecker'
           WHEN 'creative' THEN 'jay'
           WHEN 'manager' THEN 'crane'
           WHEN 'vibe' THEN CASE
             WHEN json_valid(NEW.scores)
              AND json_type(CASE WHEN json_valid(NEW.scores) THEN NEW.scores ELSE '{}' END, '$.coder') IN ('integer','real')
              AND json_type(CASE WHEN json_valid(NEW.scores) THEN NEW.scores ELSE '{}' END, '$.designer') IN ('integer','real')
              AND json_type(CASE WHEN json_valid(NEW.scores) THEN NEW.scores ELSE '{}' END, '$.creative') IN ('integer','real')
              AND json_type(CASE WHEN json_valid(NEW.scores) THEN NEW.scores ELSE '{}' END, '$.manager') IN ('integer','real')
              AND CAST(json_extract(CASE WHEN json_valid(NEW.scores) THEN NEW.scores ELSE '{}' END, '$.coder') AS REAL) > CAST(json_extract(CASE WHEN json_valid(NEW.scores) THEN NEW.scores ELSE '{}' END, '$.designer') AS REAL)
              AND CAST(json_extract(CASE WHEN json_valid(NEW.scores) THEN NEW.scores ELSE '{}' END, '$.coder') AS REAL) > CAST(json_extract(CASE WHEN json_valid(NEW.scores) THEN NEW.scores ELSE '{}' END, '$.creative') AS REAL)
              AND CAST(json_extract(CASE WHEN json_valid(NEW.scores) THEN NEW.scores ELSE '{}' END, '$.coder') AS REAL) > CAST(json_extract(CASE WHEN json_valid(NEW.scores) THEN NEW.scores ELSE '{}' END, '$.manager') AS REAL)
             THEN 'kotosov'
             ELSE 'owl'
           END
           ELSE NULL
         END,
         hatched_at = datetime('now'),
         bird_name = NEW.bird_name,
         coloring = 'plain'
   WHERE user_id = NEW.user_id;
  INSERT OR IGNORE INTO player_colorings (user_id, coloring_code)
    VALUES (NEW.user_id, 'plain');
END;
