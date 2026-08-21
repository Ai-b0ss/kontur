# Qwen — агентное ядро

Обновлено: 2026-08-21 18:52Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6. На старте этого запуска прошлый Core-head был `58cb428c313ee23d39cafb07a66e688f8b65e8ad`; текущий PR-head при проверке — `d605db5d8f8411f9054ffabf258616d5b9e0132d`.

Сравнение показывает, что четыре коммита после прошлого Core-head меняли `account-store` и `stream-session-guard`, но не `src/session-store.js`. Значит прошлое исправление восстановления system prompt после tool-result остаётся в текущей линии.

## Новый воспроизводимый Core-дефект: большой owner system prompt режется в checkpoint

В текущем `src/session-store.js` `checkpointMessages()` применяет `CHECKPOINT_MESSAGE_MAX_CHARS = 12000` ко всем сообщениям, включая `role=system`. Поэтому большой приватный промпт режима владельца при долговечном сохранении silently переписывается: хвост заменяется на `...[checkpoint truncated]`.

На hosted-машине воспроизведено без сети и без Qwen:

`QWEN_OWNER_SYSTEM_CHECKPOINT_TRUNCATION_REPRODUCED owner_exact=0`

Входной owner prompt имел 20 006 символов, в checkpoint осталось 12 026. Второй system-блок с правилами проекта сохранился, то есть проблема именно в побайтовой точности крупного system message.

Это нарушает обязательный контракт режима владельца: большой приватный system prompt должен доходить до модели без переписывания. Первичный запрос может получить полный prompt, но после restart + короткого continuation восстановится уже урезанная версия.

Правильная граница следующего исправления:
- system-инструкции нельзя молча обрезать;
- rolling-budget надо в первую очередь тратить на обычную историю, а не на переписывание system-блоков;
- если всё же нужен отдельный жёсткий предел для system prompt, превышение должно давать локальный явный отказ до принятия состояния, а не тихо менять текст владельца;
- regression должен покрывать owner prompt >12k, restart/short continuation и несколько system-блоков в исходном порядке.

Продуктовый код в этом запуске не менялся: для безопасной правки нужен exact `src/session-store.js`, а весь приватный tree локально пока не материализован. Не реконструировать неизвестные байты по памяти.

## Проверка соседнего streaming-слоя

Текущий `stream-session-guard` после последних параллельных изменений разобран отдельно. На hosted-машине целевая семантика прошла для `accepted-before-output`, локального persistence fail-closed, retry, multi-call и late-error withholding. Это целевой локальный прогон, не полный exact-tree `npm test`.

## Постоянная память

Стартовый `LATEST`: Git blob `90f5d20fcf259dee6979dda589743303079bc0f9`, capsule `20260821T175536Z-4ba90882f1`, archive SHA-256 `dde1c6bb7755ff80897f32372b0860352f93801e0f2d5086fb35578c10111bf1`.

Он восстановлен exact нормативным `autonomy/v3/tools/capsule_runtime_v4.py`; локальный Git blob runtime совпал с каноническим `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. `verify + restore` — PASS.

После исследования exact runtime собрал новую v4 capsule `20260821T185121Z-843f98abcc`, archive SHA-256 `28606a683d23f71f7675a816249256e1e5693be8844991fd29cdb6e1516baae1`. Загружены immutable manifest + 2 parts; после загрузки они перечитаны. Git blob SHA совпали с локальными: manifest `7e70db66d87e96aa876587167d65502b4752e794`, part0 `0a2d8d97596c242000feab7a2350fe7a0d28071e`, part1 `116e5ec0dcc4b89e1c974a3721253fdd7e281b97`.

## Граница доказанного

- Новый дефект воспроизведён на текущей логике `session-store`.
- Продуктовый fix ещё НЕ внесён.
- Полный exact-tree `npm test` текущего PR-head не заявлен.
- GitHub Actions, CircleCI, Cloudflare, live Qwen/provider traffic, реальные аккаунты, секреты и production не использовались.

## Следующее

1. Материализовать exact `src/session-store.js` и исправить silent truncation system messages без ослабления bounded history.
2. Добавить regression `large owner system prompt → checkpoint → restart → short continue`, плюс сохранение нескольких system-блоков в порядке.
3. Прогнать локальный session/restart-кластер и затем искать следующий воспроизводимый Core-дефект.
