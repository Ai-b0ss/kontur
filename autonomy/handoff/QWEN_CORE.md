# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `249a31f86c27f0ac5128fb910d93c2bbf248ffd2`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3`, `mergeable=true`.

### Qwen pool / reliability — свежий результат

- Исходный fail-open из `QWEN_FAILOPEN_20260820.json` воспроизведён локально без provider traffic: при пустом `accountStore.candidates()` старый server-route действительно оживлял stale `current()`, а streaming `retryEmpty` — stale `preferredAccount`.
- Кандидатные patch критически проверены и перенесены в продукт после локального targeted PASS. Commit `ada80afeb9a0e0bddc129199e5f3e7478ba42623`: `preparePublicPayloadGoverned` больше не падает назад на `current()`, route выбирает только доступного сохранённого владельца либо eligible candidate, configured-but-none-eligible отвечает `503` + `QWEN_NO_ELIGIBLE_ACCOUNT`, отсутствие настроенных аккаунтов сохраняет `401`, streaming empty-retry при пустом пуле сразу останавливается. Дополнительно закрыта гонка: `QWEN_NO_ELIGIBLE_ACCOUNT`, возникший уже внутри governed preprocessing до отправки заголовков, также остаётся `503`, а не превращается в общий `500`.
- Добавлен regression `scripts/server-no-eligible-account-test.js` (`d5094559e5256d880f93321be7f49652bb5906d4`) и включён в обычный `npm test` (`2702b78d615767a01c97163fb4448820b0c3fbbf`). Локальный targeted harness: `QWEN_FAILOPEN_RUNTIME_PASS`, `SERVER_NO_ELIGIBLE_ACCOUNT_PASS`, account-selection policy PASS с LRU/preferred/provider-circuit fail-closed.
- Во время обязательной проверки связанных server/session тестов обнаружились два устаревших самотеста, а не новые дефекты продукта. `opencode-thread-affinity-test.js` считал только `response|retry` checkpoint и требовал несуществующий третий такой checkpoint, хотя streaming давно сохраняет точный `streamRouteResponse`; test исправлен на три явных инварианта non-stream/retry/stream (`976b65223f5c1ee3e30307ede1d73f00b20797ef`). `server-nonstream-session-commit-test.js` ожидал старый pre-SSE streaming checkpoint, который более новый safety-test уже запрещает; ожидание заменено на post-SSE `streamAccepted && streamRouteResponse.account` (`8f834b4be9be058401de0a1915d8390f252a922d`). `server-session-commit-order-test.js` также ошибочно сканировал non-stream ветку как будто это pre-SSE streaming path; область проверки сужена именно к stream branch (`d9f35dd41071c1769d152a4d396f672e6c36f792`). Локальные revised affinity/non-stream/session-order проверки проходят.
- Следующая pool-проверка нашла реальный дефект cooldown: после CAPTCHA на `/chats/new` `generateChatID()` уже ставит аккаунту 10-минутный cooldown, затем `sendChatRequest()` при `null chatId` мог вызвать общий `markFailure('Failed to generate chat_id')` и сократить тот же cooldown примерно до 60 секунд. Аналогично более слабая последующая ошибка могла сократить 6-часовой rate-limit cooldown. Локально baseline воспроизведён как `600000ms -> 60000ms`.
- Защитный инвариант исправлен в `account-store`: новая ошибка может продлить активный cooldown, но больше не может его сократить (`3eecc94a439c0c468190c525a9a0f3c4edaee6d3`, окончательно исправленный head после технической опечатки `d7ecea4d091352c652e4a1c60812ddc4330a0652`). Regression расширен в `account-store-cooldown-test.js` (`249a31f86c27f0ac5128fb910d93c2bbf248ffd2`): сильный cooldown, CAPTCHA и rate-limit должны переживать более слабую последующую ошибку. Локальный policy harness: `QWEN_COOLDOWN_MONOTONIC_PASS captcha_preserved=1 rate_limit_preserved=1`.
- В commit `3eecc94a…` при полном file-write через GitHub Contents API была допущена синтаксическая опечатка в строке cookie header; она обнаружена немедленной проверкой diff и исправлена следующим commit `d7ecea4d…`. Текущий `src/account-store.js` снова содержит исходную корректную cookie-строку; дополнительного product delta там нет.
- Для current head `249a31f8…` GitHub combined status пуст: внешние CI не запускались. CircleCI/GitHub Actions, provider/live Qwen, production и deploy в этом проходе не использовались.
- Ограничение доказательства: полного `npm test` на целиком материализованном exact private tree в hosted container всё ещё нет; локально выполнены targeted runtime/source harnesses на точных затронутых инвариантах. Не приписывать этому full-suite PASS.

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

1. Следующий узкий pool-check: после `generateChatID()` уже классифицированный CAPTCHA/rate-limit сейчас всё ещё может получить вторичный `markFailure('Failed to generate chat_id')`. Monotonic cooldown уже не даёт сократить паузу, но `failures` и `lastError` могут быть испорчены. На следующем проходе проверить и при подтверждении пропускать вторичную generic-маркировку, если target уже стал unavailable в `generateChatID()`.
2. При доступном способе материализовать exact tree бесплатно прогнать полный локальный `npm test`; hosted CI ради этого не запускать.
3. Windows native validation считать отдельным PLATFORM_CONTRACT и не подменять hosted CI.
4. Живой Qwen не запускать, пока не восстановлена судьба прежней разрешённой live-попытки; второй provider-run вслепую запрещён.
