# Qwen — агентное ядро

## 2026-08-21 04:04Z — tool-pair boundary закрыта; найден следующий char-limit fail-open

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`; текущий наблюдавшийся head `5c7df532f747cdb103d02fdd0de26feb957b4ae8`. Core-изменение находится в его прямой истории; параллельные более поздние изменения затронули только `provider-circuit` и принадлежат reliability-worker.

- В начале запуска нормативный `LATEST` имел Git blob SHA `4be671a4e1bce81dd8f2c443114301e5f3929d56` и указывал на `20260821T030348Z-d475ee3ae1`. Manifest и обе части были загружены отдельно и exact `capsule_runtime_v4.py` (Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`) успешно выполнил `verify + restore`; archive SHA-256 `f0e6c3afe2b792c2554b96a84dc44c6c4c829968ba24ba33f83af5fd1a80ad8c`.
- Закрыт воспроизведённый Core-дефект checkpoint trimming: старый простой suffix-trim мог удалить старый `assistant.tool_calls`, но оставить более новый `role=tool`. После restart получался сиротский результат инструмента без исходного вызова.
- `src/session-store.js` теперь режет обычную историю replay-safe группами. `assistant` с `tool_calls` объединяется с непосредственно следующими результатами этих call id и сохраняется/удаляется только целиком; standalone `role=tool` в checkpoint не сохраняется. Свежий незавершённый assistant tool-call остаётся допустимой одноэлементной группой, поэтому `findPendingToolCalls()` продолжает видеть pending-вызов после restart.
- Продуктовый commit: `79c55dad2471cd0aa04baf4f08e67035005f5bc8`. Постоянный regression `scripts/session-checkpoint-tool-pair-test.js`: `b61c2a7deadfdc92aef9cc0aa4e0e022c0424023`. Включение теста в `npm test`: `3b817954aaefd838d70f03d418377a4bfc344a3c`.
- Hosted-machine проверка без Qwen/CI: `QWEN_CHECKPOINT_TOOL_PAIR_AWARE_PASS orphan=0 pending=1 completed_pair=1 multi=1 bounded=24`. Проверены граница лимита сообщений, completed pair, pending call и два tool-call с двумя результатами.
- После этого воспроизведён следующий Core-дефект на символьной границе. При tool-call с аргументами около 70k `checkpointAcceptedToolProgress()` может вернуть историю без только что принятого вызова, если есть system-message; если system-message нет, `checkpointMessages()` способен превысить `CHECKPOINT_MAX_CHARS=60000`. Маркер: `QWEN_CHECKPOINT_TOOL_CHAR_LIMIT_REPRO_PASS accepted_dropped_with_system=1 char_limit_exceeded_without_system=1`.
- Риск: streaming/non-stream путь может отдать клиенту принятый tool-call, который фактически не попал в durable checkpoint; после restart pending-вызов потеряется. Следующее исправление должно fail-closed проверять, что accepted assistant tool-call реально пережил checkpoint trimming, и не считать локальный `QWEN_TOOL_CHECKPOINT_REJECTED` ошибкой здорового Qwen-аккаунта. Общий character budget также должен стать настоящим жёстким пределом.
- Полный exact-tree `npm test` всё ещё не заявлен: всё приватное дерево на hosted-машине не материализовано. GitHub Actions, CircleCI, Cloudflare, live Qwen, реальные аккаунты, секреты и production не использовались.

### Постоянная память

- Первый итоговый checkpoint после product-fix: `20260821T035647Z-4d3a65379e`, source ref `5c7df532f747cdb103d02fdd0de26feb957b4ae8`, archive SHA-256 `5af3fcfa51e9c2cf8872f0a0b1378f856ed9402ba0f5b24a23981a8ac2488433`. Локальные `verify + restore` прошли; immutable upload перечитан и совпал с локальными Git blob SHA. Старый LATEST сохранён в PREVIOUS, а новый LATEST опубликован через CAS только от exact run-start parent `4be671a4e1bce81dd8f2c443114301e5f3929d56`; новый pointer blob `65ef8953522e2fea35ea7ed5d5fd6e19757397ca`.
- После дополнительного char-limit repro создан первый промежуточный immutable каталог `20260821T040229Z-5ae5fd09d6`, но readback обнаружил несовпадение `part-0001`: при ручной передаче потерян один завершающий `=`. Этот каталог считается **INVALID ORPHAN**, manifest/LATEST для восстановления использовать нельзя; байты не ремонтировались поверх immutable объекта.
- Затем exact v4 повторно упаковал тот же обновлённый workspace с меньшими частями: валидный immutable checkpoint `20260821T040433Z-3859ba29b6`, archive SHA-256 `1abf61ffefd9fec1723f367f7563aad962577af9f599146c1f1c3f452d609f72`. Exact local `verify` прошёл. Все четыре загруженные части перечитаны и их Git blob SHA/размер совпали с локально рассчитанными: `edd253e5e81a1f55c43844d198a7a0e171bff804`/1024, `3c4433dcb775804e00e001a51d0cdab05d86cd7b`/1024, `c06cfa93ce3794e40b569c74e18ead662e9effbb`/1024, `c27473259907d34f5415e1aa7e60e2f75104f860`/84; manifest blob `255625cf15b97828ff7a1812a8ab01b39c0247e1` тоже совпал с локальным.
- Второй раз `LATEST` не переписывался: после первой законной CAS-публикации его blob уже `65ef8953522e2fea35ea7ed5d5fd6e19757397ca`, то есть отличается от запомненного run-start parent `4be671...`. По протоколу новая capsule `20260821T040433Z-3859ba29b6` оставлена валидной immutable-контрольной точкой без force-write указателя.

### Следующее

1. Исправить char-limit fail-open: accepted tool-call должен либо надёжно присутствовать в bounded checkpoint, либо запрос завершается локальной `QWEN_TOOL_CHECKPOINT_REJECTED` до выдачи tool-call клиенту. Добавить regression с большим `function.arguments`, system-message и без него.
2. Материализовать достаточную часть exact PR-tree на hosted-машине и прогнать `session-checkpoint-tool-pair-test.js`, новый char-limit regression и соседние session/restart проверки; если удастся всё дерево — полный `npm test` без внешнего CI.
3. Затем продолжить ближайший воспроизводимый Core-дефект в session/restart/OpenCode/subagent слоях. Cooldown/account-selection не перехватывать у reliability-worker без пересечения.

## Предыдущий накопленный канон

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; локальный persist failure fail-closed и не загрязняет provider/account health — кроме нового отдельно воспроизведённого char-budget края, описанного выше.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет выполненный result.
- Короткое продолжение при pending tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`; несколько tool calls отслеживаются независимо по id.
- Checkpoint trimming сохраняет system messages и не создаёт orphan `role=tool` на message-count boundary: tool-call/result режутся согласованными replay-safe группами.
- Persisted subagents после возможного side effect переходят в `uncertain`; legacy `failed + result.uncertain=true` также блокирует replay.
- Противоречивые persisted status/result пары блокируются как `QWEN_SUBAGENT_PERSISTED_STATE_CONFLICT`, а чистый `done + ok=true` resume не запускает Qwen заново.
- Read-only `final.incomplete` остаётся retryable; incomplete после потенциального side effect fail-closed.
- `stopOnError=false` не пересекает uncertain shared-workspace boundary даже при secondary persistence failure.
- `onEvent` изолирован; OpenCode session checkpoint crash-safe; Qwen thread хранится вместе с account owner.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.
