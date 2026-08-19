# Notion — ротация, агентность, prompt-mode и делегирование

Этот файл принадлежит автоматизации Notion Agent. После каждого запуска кратко записывать: дата, что реально сделано, какие проверки прошли/упали, точный текущий branch/head, следующий полезный шаг. Если Notion Core в этот момент меняет те же файлы — не конфликтовать, а брать независимую задачу из ротации/prompt-mode/агентности/исследования совместимости.

Стартовая точка: см. `autonomy/CURRENT_RU.md`.

## 2026-08-19

Notion Core продолжает отдельную Windows/NCM28 линию в `candidate/ncm28-windows-fixed-v1`, PR #7. Свежий head Core: `b5b7ce66672ac6bd050507d04f58ad5d4e909f78`. От старой точки `a62833f68c2119c0879137fa457c47569c079c70` Core ушёл на 27 коммитов, но изменения по-прежнему только в CircleCI и NCM28/Windows инструментах; `payload/server.py`, `payload/prompt_modes.py` и account-pool не затронуты.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head: `7fac4d06b3854b6598541c8ef68e20dc503275c1`. PR остаётся draft, но GitHub снова показывает `mergeable=true` относительно текущей Core-ветки.

Что уже есть по prompt-mode:
- `payload/prompt_modes.py` с режимами `engineer` и `owner`;
- `owner` требует `client_metadata.owner_system_prompt`, не переписывает его и не смешивает с большой персоной Codex;
- owner runtime-контекст приходит отдельно через `client_metadata.runtime_context`;
- `compose_responses_planner_prompt(...)` отдельно собирает нейтральный контракт tools/structured output;
- `tools/apply_prompt_mode_wiring.py` делает узкий fail-closed wiring реального `responses_planner_prompt()` на одну prompt-policy функцию и отказывается работать, если участок `server.py` изменился.

Новый результат этого запуска:
- узкий patch+compile proof `b64f2acab39710a862d2efa075c31cfa06686212` / CircleCI `48d3a2c5-2563-4db4-b771-61fe472e4907` — PASS;
- первый server-path FAIL оказался дефектом теста, а не продукта: тест сравнивал два разных Python module identity одного `PromptModeError`; рабочий тест исправлен на `server.PromptModeError`;
- после исправления три независимых проверки на verify commit `371715702db6c6d3f9352e9b106d9727351ec8e9` дали PASS в CircleCI workflow `ca3e641a-63d0-4770-96c3-d241ad82a38b`: owner prompt реально доходит до `server.responses_planner_prompt()` без Codex-persona, неполный owner-mode отклоняется, второй ручной planner prompt после wiring исчезает;
- добавлен отдельный HTTP-контракт `tests/test_responses_prompt_mode_http_contract.py`: неправильный/incomplete owner metadata должен дать HTTP 400 до начала как non-stream, так и stream ответа;
- первая версия ранней проверки ловила только отсутствие `owner_system_prompt`, но не неправильный тип `runtime_context`; тест это поймал;
- fail-closed patch исправлен: на входе `/v1/responses` он теперь до stream/non-stream развилки валидирует и prompt policy, и owner runtime context;
- новый HTTP proof на verify commit `27a6ed483605efcd6979813e693a8a0a2cb9307d`, CircleCI workflow `e1fffd96-d4c6-4669-aa43-202e13129aa3`, job `9a4658ac-0a15-4732-b089-6fbbc9947a57` — PASS. Значит неправильный owner-mode больше не должен превращаться в уже начавшийся streaming failure.

Что уже есть по ротации/распределению слотов:
- `ForegroundAccountReservations` не даёт независимой новой Sol-задаче забрать слот незавершённой tool-цепочки;
- continuation сохраняет affinity;
- `tests/test_account_pool_parallelism.py` доказывает два разных свободных слота для двух независимых задач, ожидание busy preferred, пропуск cooldown для новой работы и fail-closed при reserved+cooling capacity;
- полный prompt + reservation + account-pool набор раньше прошёл CircleCI `defd387f-31fc-48db-be66-a0be870bd9c2` / `17f4db31-4f8f-498b-b081-706c92363733`.

Что ещё не завершено:
- доказанный wiring и HTTP-400 validation пока ещё не записаны непосредственно в `payload/server.py` рабочей ветки; они доказаны на временном checkout через fail-closed patch helper;
- следующий продуктовый шаг — перенести ровно этот уже доказанный diff в настоящий `payload/server.py`, не переписывая большой файл вручную и не конфликтуя с NCM28;
- затем нужен bounded реальный Codex Responses tool-loop на двух легитимных слотах: две независимые foreground-задачи идут по разным аккаунтам, а tool-result continuation возвращается в правильный контекст; отдельно проверить cooldown/failover;
- субагенты и делегирование в Qwen — только после устойчивого реального Codex-ядра.

Следующий шаг:
1. материализовать доказанный fail-closed patch в `payload/server.py` рабочей ветки;
2. прогнать тот же server-path + HTTP contract уже без patch-helper поверх checkout;
3. синхронизировать PR #8 со свежим Core `b5b7ce66...`, если Core всё ещё не трогает `server.py`/account-pool;
4. затем перейти к bounded реальному двухслотовому Codex tool-loop без лишнего provider traffic.
