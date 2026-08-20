# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `a89d4066b030e7b15119583db1029d1bb371d66e`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Свежий результат Qwen Core

- В начале прохода нормативно восстановлен LATEST `20260820T195254Z-3a16acdb61` через exact `capsule_runtime_v4.py`; archive SHA-256 совпал: `b4bf71b3f0c9979e6450653c36dcbbcd65a703b1f6a68e7451f198cb44808608`. Стартовый Git blob SHA LATEST: `6cc807c1892426281f93805df721aa5ec1005e00`.
- Старый пункт handoff про synchronous throw / retry replacement уже был закрыт соседней работой до начала этого прохода: свежий PR содержал `stream-session-retry-sync-throw-test.js`, защиту synchronous `parseQwenSSE` throw и Promise-defer для `retryEmpty`.
- Найден и воспроизведён новый пересекающийся Core-дефект: локальная ошибка сохранения принятого streaming tool-call (`QWEN_TOOL_CHECKPOINT_REJECTED`) проходила через общий `onError`. В `server.js` этот observer обновляет состояние аккаунта/провайдера, поэтому локальный сбой диска/session-store ошибочно штрафовал здоровый Qwen-аккаунт. Дофиксовый offline repro получил `providerObserverCalls=1`.
- Исправление в `src/stream-session-guard.js`: local persistence failure теперь отдельный server-side класс. Он не вызывает provider/account observer, не выпускает удержанный tool-call, сохраняет исходный код ошибки и reject-ится обратно в route. Route владеет единственным финальным `res.end()` и не выполняет нормальный post-stream commit. Аналогичный reject из replacement-stream после `retryEmpty` теперь явно прокидывается наружу, а не превращается в unhandled rejection.
- Добавлен постоянный regression `scripts/stream-session-local-persist-failure-test.js`; включён в `npm test`. Он проверяет direct + replacement stream, `provider_health_untouched`, fail-closed tool output и сохранение `QWEN_TOOL_CHECKPOINT_REJECTED`.
- Продуктовые коммиты этого прохода: `2864d4a93b8b2fabfa4a21d0f29ec5b27773a776`, `bd92fe93ccad107f226d10b5cf2455b0729cbc44`, `a89d4066b030e7b15119583db1029d1bb371d66e`.
- На ChatGPT-hosted машине целевой тест после исправления прошёл: `QWEN_STREAM_LOCAL_PERSIST_FAILURE_PASS provider_health_untouched=1 route_reject=1 retry_reject_propagated=1 tool_output_withheld=1`.
- Полный exact-tree `npm test` всё ещё **не заявлен**: целиком приватное дерево локально не материализовано. GitHub Actions/CircleCI/Cloudflare и живой Qwen намеренно не запускались.

### Постоянная память / capsule runtime

- После работы создан checkpoint и нормативно упакован v4 capsule `20260820T210201Z-7d8dcd7309`, source ref `a89d4066…`, archive SHA-256 `ccb644d51a9806b969892e9bfb0bda559b5ae66b049930e1fef28321fe2554e7`.
- Локально `verify + restore` прошли. Part SHA-256 text: `part-0000` → `8786ee64d6c3ac8118f575b5e40285f2e133174808d5793f24b53cbf2c602792`, `part-0001` → `0e327f5cc2ce1ad48667f30835fd4d4ede4e8ae7837325818b1d7856e619af82`; reconstructed archive снова дал exact SHA `ccb644d5…`.
- Immutable upload перечитан с GitHub: part-0000 blob `db2f72a6d95df2799ce85c22f711407a5e221515`, part-0001 blob `70a73069e7189de138fba24f627a46052bf669f6`, manifest blob `2d5c3c6b6aacc73410703a283538fa67abab8d73`; байты соответствуют локальному pack.
- Перед публикацией LATEST перечитан повторно и всё ещё имел исходный parent blob SHA `6cc807c1892426281f93805df721aa5ec1005e00`; CAS-конфликта не было. Старый LATEST сохранён как PREVIOUS, новый LATEST опубликован только через `update_file` с exact parent SHA.
- Текущий LATEST: `20260820T210201Z-7d8dcd7309`, blob SHA `b18662a6523b4a45531f7eacda208cd16281017d`.
- Текущий PREVIOUS: `20260820T195254Z-3a16acdb61`.
- В этом проходе по ошибке началась загрузка capsule `20260820T210123Z-c4c0632939` с неверным `part-0001`; manifest не публиковался. Это **невалидный immutable orphan**, его никогда не использовать и не чинить на месте.
- Старые orphan capsule `20260820T185657Z-a15bcde178` и `20260820T190401Z-9dcd764069` также не использовать.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; локальный persist failure работает fail-closed и больше не загрязняет provider/account health.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет уже выполненный результат.
- Короткое продолжение при незавершённом tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`.
- Несколько tool calls одного assistant-turn отслеживаются независимо по id; частичный набор результатов не снимает соседние pending-вызовы.
- Streaming terminal lifecycle exactly-once: transport error, parser completion/error и поздние parser data не способны повторно завершить response или писать после terminal state.
- Synchronous parser/retry factory failures удерживаются внутри streaming lifecycle; replacement rejection не остаётся unhandled.
- Error observers streaming-пути не способны сорвать штатное закрытие клиентского ответа.
- Persisted subagents после потенциально изменяющего инструмента переходят в `uncertain`; автоматический повтор после restart блокируется до явного разрешения.
- `onEvent` изолирован от исполнения подагента.
- `opencode-sessions.json` имеет crash-safe primary/backup и откат неудачной записи.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. Начать с LATEST `20260820T210201Z-7d8dcd7309`, восстановить его нормативным v4 и перечитать свежий PR #6 head: ветка активно меняется, не предполагать, что `a89d4066…` всё ещё head.
2. Материализовать достаточный exact private tree на ChatGPT-hosted машине и прогнать кластер `stream-session-guard-test`, `stream-session-local-persist-failure-test`, `stream-session-retry-sync-throw-test`, `stream-session-lifecycle-race-test`, `stream-session-restart-integration-test`, `server-stream-session-guard-wiring-test`, `session-pending-tool-call-restart-test`; если получится всё дерево — полный `npm test`, без внешнего CI/provider traffic.
3. Проверить аналогичную границу local-vs-upstream error classification в non-stream/session/subagent persistence. Менять код только после воспроизводимого случая, где локальная ошибка ошибочно мутирует provider/account health, теряет durable state или создаёт повтор side effect.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
