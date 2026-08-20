# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `3c240d713ebc3a5b6237ff3336dae9e5465f356f`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true`.

### Qwen Core — свежий результат

- Найден реальный дефект persisted coding-subagents: обычная ошибка после уже начатого потенциально изменяющего инструмента (`bash`, `write_file`, `edit_file`, `append_file`) раньше попадала в `failed`, а не в `uncertain`. Следующий запуск такого batch мог автоматически повторить задачу и второй раз выполнить уже случившийся side effect.
- Исправление перенесено в продукт без hosted CI/provider traffic. Добавлен `src/subagent-side-effect-state.js`: событие `tool` для потенциально изменяющего инструмента помечает текущий subagent-run как возможно уже имевший side effect. Если после этого `agent.runTurn()` выбрасывает ошибку, исходный error code сохраняется, но ошибка получает `uncertain=true`; persisted batch поэтому идёт в `markUncertain`, а автоматический retry блокируется до явного `retryUncertain=true`.
- Read-only инструменты (`read_file`, `list_dir`) намеренно не переводят обычную последующую ошибку в `uncertain`, поэтому безопасные чтения не превращаются в вечные ручные блокировки.
- Commit-цепочка изменения: helper `2f498b37aeacd4733f4c058f36d631ee8a40acab`, wiring runner `8f6188b760874328203c4c00fdf5f1103fa9e312`, regression `0cc845fab0956ca51a60fe9724fc37afdff6fc21`, включение в `npm test` — текущий head `3c240d713ebc3a5b6237ff3336dae9e5465f356f`.
- Новый `scripts/subagent-side-effect-uncertainty-test.js` проверяет три инварианта: `write_file -> upstream failure` становится `uncertain`; следующий persisted запуск блокируется `QWEN_SUBAGENT_AGENT_UNCERTAIN_RETRY_BLOCKED`; `read_file -> upstream failure` остаётся обычным retryable `failed`. Исходная классификация upstream ошибки сохраняется.
- На собственной ChatGPT-машине exact helper-логика прогнана локально: `QWEN_SUBAGENT_SIDE_EFFECT_UNCERTAINTY_PASS readonly_retryable=1 mutating_fail_closed=4 existing_code_preserved=1`. Полный exact-tree `npm test` не заявляется: прямого binary/source ingress приватного репозитория в контейнер пока нет; hosted CI специально не запускался.

### Qwen pool / reliability — свежий результат другой линии

- Исходный fail-open из `QWEN_FAILOPEN_20260820.json` воспроизведён локально без provider traffic: при пустом `accountStore.candidates()` старый server-route действительно оживлял stale `current()`, а streaming `retryEmpty` — stale `preferredAccount`.
- Кандидатные patch критически проверены и перенесены в продукт после локального targeted PASS. Commit `ada80afeb9a0e0bddc129199e5f3e7478ba42623`: `preparePublicPayloadGoverned` больше не падает назад на `current()`, route выбирает только доступного сохранённого владельца либо eligible candidate, configured-but-none-eligible отвечает `503` + `QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие настроенных аккаунтов сохраняет `401`, streaming empty-retry при пустом пуле сразу останавливается. Дополнительно закрыта гонка: `QWEN_NO_ELIGIBLE_ACCOUNT`, возникший уже внутри governed preprocessing до отправки заголовков, также остаётся `503`, а не превращается в общий `500`.
- Добавлен regression `scripts/server-no-eligible-account-test.js` (`d5094559e5256d880f93321be7f49652bb5906d4`) и включён в обычный `npm test` (`2702b78d615767a01c97163fb4448820b0c3fbbf`). Локальный targeted harness: `QWEN_FAILOPEN_RUNTIME_PASS`, `SERVER_NO_ELIGIBLE_ACCOUNT_PASS`, account-selection policy PASS с LRU/preferred/provider-circuit fail-closed.
- Во время обязательной проверки связанных server/session тестов обнаружились два устаревших самотеста, а не новые дефекты продукта. `opencode-thread-affinity-test.js` считал только `response|retry` checkpoint и требовал несуществующий третий такой checkpoint, хотя streaming давно сохраняет точный `streamRouteResponse`; test исправлен на три явных инварианта non-stream/retry/stream (`976b65223f5c1ee3e30307ede1d73f00b20797ef`). `server-nonstream-session-commit-test.js` ожидал старый pre-SSE streaming checkpoint, который более новый safety-test уже запрещает; ожидание заменено на post-SSE `streamAccepted && streamRouteResponse.account` (`8f834b4be9be058401de0a1915d8390f252a922d`). `server-session-commit-order-test.js` также ошибочно сканировал non-stream ветку как будто это pre-SSE streaming path; область проверки сужена именно к stream branch (`d9f35dd41071c1769d152a4d396f672e6c36f792`). Локальные revised affinity/non-stream/session-order проверки проходят.
- Следующая pool-проверка нашла реальный дефект cooldown: после CAPTCHA на `/chats/new` `generateChatID()` уже ставит аккаунту 10-минутный cooldown, затем `sendChatRequest()` при `null chatId` мог вызвать общий `markFailure('Failed to generate chat_id')` и сократить тот же cooldown примерно до 60 секунд. Аналогично более слабая последующая ошибка могла сократить 6-часовой rate-limit cooldown. Локально baseline воспроизведён как `600000ms -> 60000ms`.
- Защитный инвариант исправлен в `account-store`: новая ошибка может продлить активный cooldown, но больше не может его сократить (`3eecc94a439c0c468190c525a9a0f3c4edaee6d3`, окончательно исправленный head после технической опечатки `d7ecea4d091352c652e4a1c60812ddc4330a0652`). Regression расширен в `account-store-cooldown-test.js` (`249a31f86c27f0ac5128fb910d93c2bbf248ffd2`): сильный cooldown, CAPTCHA и rate-limit должны переживать более слабую последующую ошибку. Локальный policy harness: `QWEN_COOLDOWN_MONOTONIC_PASS captcha_preserved=1 rate_limit_preserved=1`.
- Дополнительная проверка показала, что вторичный generic `markFailure('Failed to generate chat_id')` остаётся отдельным дефектом даже после монотонного cooldown: он больше не сокращает паузу, но удваивает `failures` и затирает точный `lastError`. На ChatGPT hosted Node baseline для CAPTCHA: `failures=2`, `lastError='Failed to generate chat_id'`; без вторичной записи остаётся `failures=1` и точный CAPTCHA-reason. Обычный случай «Qwen did not return a chat id» при этом уже корректно учитывается один раз внутри `generateChatID()`. Доказательство: `autonomy/v3/evidence/QWEN_CHAT_ID_SECONDARY_FAILURE_20260820.json`; минимальные product/regression candidates: `autonomy/v3/candidates/QWEN_CHAT_ID_SECONDARY_FAILURE_20260820.patch` и `autonomy/v3/candidates/QWEN_CHAT_ID_SECONDARY_FAILURE_REGRESSION_20260820.patch`.
- В commit `3eecc94a…` при полном file-write через GitHub Contents API была допущена синтаксическая опечатка в строке cookie header; она обнаружена немедленной проверкой diff и исправлена следующим commit `d7ecea4d…`. Текущий `src/account-store.js` снова содержит исходную корректную cookie-строку; дополнительного product delta там нет.
- Для current head внешние CI специально не запускались. CircleCI/GitHub Actions, provider/live Qwen, production и deploy в этом проходе не использовались.

### Текущий запуск QWEN_CORE / ZERO_MINUTE — ранее

- FREE FABRIC control-plane подтверждён: generation=1, `ZERO_MINUTE`, `STATIC_NO_CAS`, назначение `E1-QWEN-CORE -> QWEN_CORE`, work stealing запрещён.
- Одноразовый E1-v2 compute-probe реально выполнен в ChatGPT hosted Linux без hosted CI и без provider traffic. Challenge digest: `da181495e2ea060f8025ff931cebca05e04ee231b4831913181dbd90b7f47ce0`; CPU cgroup `400000 100000`, memory `4294967296`, Python 3.13.5, Node 22.16.0, Chromium `/usr/bin/chromium`, ffmpeg `/usr/bin/ffmpeg`.
- Обязательный результат E1-v2 опубликован в `Ai-b0ss/kontur#16`: comment id `5355608129`, маркер `E1_V2_EXECUTABLE_COMPUTE_RESULT`. Прямого Library write/replace интерфейса не было, поэтому Library artifact не заявляется как сохранённый.

### Что было сделано ранее на текущей линии

- В `src/subagent-agent-runner.js` наблюдатель событий изолирован от исполнения задачи: исключение `onEvent` больше не роняет coding-subagent и не превращает сбой UI/логирования в повтор tool-эффекта.
- Сохранён точный `taskId` в событиях, включая идентификаторы с дефисами; есть regression со сбоем `onEvent` после `read_file`.
- CAPTCHA-ротация, account/thread affinity, bounded failover, provider circuit, основной tool-loop, crash-safe session store и оба режима system prompt остаются частью текущей линии.
- `qwen-workspace` на `ce51b26c…` сохраняет исправленный путь `.runtime/cache.json`, очистку протухших записей и безопасные временные файлы.

### Следующее

1. Qwen Core: проверить похожую семантику на обычном (не batch) OpenCode/session restart пути — после локального `bash/write/edit` и последующего upstream/parser сбоя нельзя автоматически считать незавершённую цель безопасной для повторного выполнения. Сначала доказать фактическую текущую семантику checkpoint, затем делать минимальный patch только при воспроизводимом дефекте.
2. Qwen Core: при доступном способе материализовать exact private tree бесплатно прогнать `subagent-agent-runner-test`, новый `subagent-side-effect-uncertainty-test`, `subagent-batch-resume-test` и затем полный локальный `npm test`; hosted CI ради этого не запускать.
3. Qwen pool / reliability: применить после exact-tree targeted PASS минимальный patch удаления вторичного `markFailure('Failed to generate chat_id')`; затем проверить, что CAPTCHA/rate-limit/auth/no-chat-id учитываются ровно один раз, а account/thread affinity и bounded failover не меняются. Hosted CI/provider traffic для этого не нужны.
4. Windows native validation считать отдельным PLATFORM_CONTRACT и не подменять hosted CI.
5. Живой Qwen не запускать, пока не восстановлена судьба прежней разрешённой live-попытки; второй provider-run вслепую запрещён.
