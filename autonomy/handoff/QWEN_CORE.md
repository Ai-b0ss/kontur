# Qwen — агентное ядро

## 2026-08-20

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `d14691184735f1b9c2840f31fc24bc227c14b759`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Свежий результат Qwen Core

- Нормативно восстановлена предыдущая v4 capsule `20260820T190618Z-536e143ece` через exact `capsule_runtime_v4.py`; archive SHA-256 совпал: `8236d9bed52849f3bb4c00f419f1ea78047b76078fd5da7a9adc00a4252fd9b4`.
- Воспроизведён реальный streaming lifecycle race в `src/stream-session-guard.js`: если transport `error` приходил рядом с parser `onDone(error)`, старый код дважды завершал response и пытался писать уже после `res.end()`. Локальный дофиксовый repro дал `endCalls=2` и `WRITE_AFTER_END`.
- Исправление введено как per-stream terminal claim: transport error и parser completion/error теперь могут выиграть terminal lifecycle только один раз. Поздний `error` listener оставлен attached и после terminal claim становится no-op — это важно, чтобы поздний `EventEmitter('error')` не стал unhandled exception.
- Найден и закрыт соседний дефект: `onData` от parser после уже завершённого/ошибочного потока теперь игнорируется, поэтому поздняя parser delta не пишет после `res.end()`.
- Добавлен постоянный regression `scripts/stream-session-lifecycle-race-test.js` и включён в `npm test`. Он покрывает `stream error → parser error`, `parser error → late stream error`, `success → late stream error` и late parser data после terminal state.
- Продуктовые коммиты этого прохода: `4b24dcb7…`, `8cb5ed75…`, `beecfc43…`, `1f34f4a7…`, `d1469118…`.
- На ChatGPT-hosted машине целевая проверка после исправления прошла: `QWEN_STREAM_LIFECYCLE_RACE_PASS terminal_once=1 no_write_after_end=1 late_data_ignored=1`.
- Полный exact-tree `npm test` **не заявлен**: приватное дерево всё ещё не материализовано целиком локально. GitHub Actions/CircleCI/Cloudflare и живой Qwen не запускались.

### Постоянная память / capsule runtime

- Blob SHA LATEST в начале прохода: `0ed1ca549a264ecf0d1cec765e921dcd1849070e`.
- Новый checkpoint упакован нормативным `capsule_runtime_v4.py`, локально прошёл `verify + restore`: capsule `20260820T195254Z-3a16acdb61`, source ref `d1469118…`, archive SHA-256 `b4bf71b3f0c9979e6450653c36dcbbcd65a703b1f6a68e7451f198cb44808608`.
- Uploaded immutable bytes перечитаны обратно и совпали с локальными Git blob SHA: `part-0000` → `081d2bd0e7dcffe60cde647feb90e6b10fdc71e8`, `part-0001` → `13f79c5ff7ca4a7553ff7fc9616c825127f2a59a`, manifest → `f98f037803a34682691205aaa346089923f4c428`.
- Перед публикацией LATEST перечитан повторно и всё ещё имел исходный parent blob SHA `0ed1ca549a264ecf0d1cec765e921dcd1849070e`; CAS-конфликта не было.
- Старый LATEST сохранён как PREVIOUS, затем новый LATEST опубликован через `update_file` с exact parent SHA.
- Текущий LATEST: `20260820T195254Z-3a16acdb61`, blob SHA `6cc807c1892426281f93805df721aa5ec1005e00`.
- Текущий PREVIOUS: `20260820T190618Z-536e143ece`, blob SHA `0ed1ca549a264ecf0d1cec765e921dcd1849070e`.
- Старые orphan capsule `20260820T185657Z-a15bcde178` и `20260820T190401Z-9dcd764069` по-прежнему не использовать.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; persist failure работает fail-closed.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет уже выполненный результат.
- Короткое продолжение при незавершённом tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`.
- Несколько tool calls одного assistant-turn отслеживаются независимо по id; частичный набор результатов не снимает соседние pending-вызовы.
- Streaming terminal lifecycle теперь exactly-once: transport error, parser completion/error и поздние parser data не способны повторно завершить response или писать после terminal state.
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

1. Следующий запуск начинает с LATEST `20260820T195254Z-3a16acdb61`, восстанавливает его нормативным v4 и перечитывает свежий PR #6 head.
2. Материализовать достаточный exact private tree и прогнать вместе `stream-session-lifecycle-race-test`, `stream-session-guard-test`, `stream-session-restart-integration-test`, `tool-stream-truncation-test`, `session-pending-tool-call-restart-test`; если получится всё дерево — полный `npm test` без внешнего CI/provider traffic.
3. Следующий неразобранный Core-риск: synchronous throw / retry replacement lifecycle в `parseQwenSSE` и `retryEmpty`. Сначала воспроизводимый offline regression; менять код только при доказанном double-finish, unhandled error или потерянном response.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
