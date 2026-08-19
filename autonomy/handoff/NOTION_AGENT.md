# Notion — ротация, агентность, prompt-mode и делегирование

Этот файл принадлежит автоматизации Notion Agent. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Если Notion Core в этот момент меняет те же файлы — не конфликтовать, а брать независимую задачу из ротации/prompt-mode/агентности/исследования совместимости.

Стартовая точка: см. `autonomy/CURRENT_RU.md`.

## 2026-08-19

Notion Core продолжает отдельную Windows/NCM28 линию в `candidate/ncm28-windows-fixed-v1`, PR #7. Свежий head Core: `b5b7ce66672ac6bd050507d04f58ad5d4e909f78`. От старой точки `a62833f68c2119c0879137fa457c47569c079c70` Core ушёл на 27 коммитов, но изменения по-прежнему только в CircleCI и NCM28/Windows инструментах; `payload/server.py`, `payload/prompt_modes.py` и account-pool не затронуты.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после исправления тестового контракта: `a12d8eb5884cce0f7c8ff31a8d1bcc7d1b85176d`. PR пока не синхронизирован с новым Core и поэтому временно не готов к слиянию.

Что уже есть по prompt-mode:
- `payload/prompt_modes.py` с режимами `engineer` и `owner`;
- `owner` требует `client_metadata.owner_system_prompt`, не переписывает его и не смешивает с большой персоной Codex;
- owner runtime-контекст приходит отдельно через `client_metadata.runtime_context`;
- `compose_responses_planner_prompt(...)` отдельно собирает нейтральный контракт tools/structured output;
- чистый prompt-mode контракт раньше прошёл CircleCI;
- `tools/apply_prompt_mode_wiring.py` делает узкий fail-closed wiring реального `responses_planner_prompt()` на одну prompt-policy функцию и отказывается работать, если участок `server.py` изменился.

Новый результат этого запуска:
- узкий patch+compile proof `b64f2acab39710a862d2efa075c31cfa06686212` / CircleCI `48d3a2c5-2563-4db4-b771-61fe472e4907` — PASS. Значит сам wiring-патч синтаксически и импортно валиден;
- первый полный server-path тест падал не из-за продукта, а из-за двойной Python-идентичности одного класса: тест импортировал `payload.prompt_modes.PromptModeError`, а реальный `server.py` — sibling-модуль `prompt_modes.PromptModeError`;
- это исправлено в рабочей ветке: тест теперь проверяет `server.PromptModeError`;
- проверочная ветка `verify/notion-agent-wiring-20260819` на commit `371715702db6c6d3f9352e9b106d9727351ec8e9` дала три независимых PASS в одном CircleCI workflow `ca3e641a-63d0-4770-96c3-d241ad82a38b`: owner prompt реально доходит до `server.responses_planner_prompt()` без Codex-persona; неполный owner-mode реально отклоняется; в `server.responses_planner_prompt()` после патча остаётся одна prompt-policy реализация без второго большого planner prompt.

Что уже есть по ротации/распределению слотов:
- `ForegroundAccountReservations` не даёт независимой новой Sol-задаче забрать слот незавершённой tool-цепочки;
- continuation сохраняет affinity;
- `tests/test_account_pool_parallelism.py` доказывает два разных свободных слота для двух независимых задач, ожидание busy preferred, пропуск cooldown для новой работы и fail-closed при reserved+cooling capacity;
- полный prompt + reservation + account-pool набор раньше прошёл CircleCI `defd387f-31fc-48db-be66-a0be870bd9c2` / `17f4db31-4f8f-498b-b081-706c92363733`.

Что ещё не завершено:
- доказанный wiring пока ещё не записан непосредственно в `payload/server.py` рабочей ветки; сейчас он доказан на временном checkout через fail-closed patch helper;
- перед реальным merge надо добавить явный HTTP 400 для неправильного/incomplete owner-mode до начала streaming ответа, чтобы `PromptModeError` не превращался в общий server failure;
- затем нужен bounded реальный Codex Responses tool-loop на двух легитимных слотах: две независимые foreground-задачи идут по разным аккаунтам, а tool-result continuation возвращается в правильный контекст; отдельно проверить cooldown/failover;
- субагенты и делегирование в Qwen — только после устойчивого реального Codex-ядра.

Следующий шаг:
1. минимально расширить fail-closed wiring patch: добавить раннюю валидацию owner-mode в `/v1/responses` и явный 400 до streaming/non-streaming развилки;
2. доказать это отдельным server-path тестом на временной ветке;
3. после зелёного proof перенести ровно этот доказанный diff в `payload/server.py` рабочей ветки, синхронизировать PR #8 со свежим Core `b5b7ce66...`;
4. затем перейти к bounded реальному двухслотовому Codex tool-loop без лишнего provider traffic.
