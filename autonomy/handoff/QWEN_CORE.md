# Qwen — агентное ядро

## 2026-08-21 06:06Z — ошибки записи ответа больше не маскируют основной сбой

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`; текущий Core-head `58e2cfdae8cdea82dd2e30b3886672353c83c612`.

- Воспроизведён новый Core-дефект на границе streaming/session durability: если `session-store` уже отверг принятый tool-call с локальной `QWEN_TOOL_CHECKPOINT_REJECTED`, а клиент в тот же момент отключился, вторичная ошибка `res.write()` могла вылететь из callback и замаскировать исходный отказ долговечной записи. Hosted-маркер до/после: `QWEN_LOCAL_PERSIST_DISCONNECT_PASS old_masked=1 primary_preserved=1 secondary_write_swallowed=1`.
- Исправление `1eef57a6bb44739675602acf27785ee4508cc8cd`: `failLocalPersistence()` теперь не даёт ошибке записи SSE заменить исходную checkpoint-ошибку; provider/account observer при локальном отказе по-прежнему не вызывается, tool-call наружу не выпускается.
- Regression `scripts/stream-session-local-persist-failure-test.js` расширен коммитом `6c5f961baf1c7f0f10f850d55290be1374942b48`: отдельно моделируется отключившийся клиент и требуется сохранить точные code/message исходной `QWEN_TOOL_CHECKPOINT_REJECTED`.
- Сразу найден соседний дефект того же класса в терминальных parser/upstream errors: `finishWithError()` мог сам упасть на `res.write()`/`res.end()` уже отключившегося клиента. Коммит `a1ca3093eda9d84273d756628bab2676dfc293b4` изолирует эти вторичные ошибки, сохраняя ровно один вызов provider observer для первичной upstream/parser ошибки. Коммит `58e2cfdae8cdea82dd2e30b3886672353c83c612` добавляет этот случай в `stream-session-lifecycle-race-test.js`.
- Полный exact-tree `npm test` всё ещё не заявлен: целиком приватное дерево не материализовано на hosted-машине. В этом проходе не использовались GitHub Actions, CircleCI, Cloudflare, live Qwen, реальные аккаунты, секреты или production.

### Постоянная память

- На старте `LATEST` имел exact Git blob SHA `65ef8953522e2fea35ea7ed5d5fd6e19757397ca`. Его capsule `20260821T035647Z-4d3a65379e` была заново собрана локально из отдельно полученных manifest/parts и успешно прошла exact `capsule_runtime_v4.py verify + restore`; локальный runtime имел канонический Git blob SHA `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.
- После работы exact v4 собрал capsule `20260821T055653Z-ce3cad6218`, archive SHA-256 `2beb0e63444f642b113dbd74d0845f0f56b7ec82189f5781eb3d50cddcb164d3`. Загруженные part-0000/part-0001/manifest перечитаны; их Git blob SHA точно совпали с локально рассчитанными: `b83726116d7ddcf352ed9d14c0c7ac99790eb33a`, `95db3f91394ffb13f96dbf72531bff984b08ca80`, `dae1e5179a9958fcaa07ea274855a5a41d76d205`. Exact local `verify` новой capsule — PASS.
- Непосредственно перед публикацией `LATEST` всё ещё имел исходный parent blob `65ef895...`, поэтому CAS был законен. Старый LATEST сохранён как `PREVIOUS`, новый LATEST опубликован без force-write и теперь имеет blob `0a26b34f066d9baf08317d9ee5aa5fb82fd15a57`.

### Следующее

1. На hosted-машине проверить успешное завершение streaming-ответа при исчезнувшем клиенте: финальные `res.write(finalChunk)`, `[DONE]`, `res.end()` не должны ронять callback/процесс и не должны ошибочно портить здоровье Qwen-аккаунта.
2. Затем материализовать достаточную часть exact PR-tree для запуска `stream-session-local-persist-failure-test.js`, `stream-session-lifecycle-race-test.js`, char-limit/session-restart кластера на реальных файлах; полный `npm test` заявлять только если будет реально материализован весь tree.
3. После следующего существенного изменения снова соблюдать v2/v4 checkpoint protocol; текущий опубликованный recovery floor — capsule `20260821T055653Z-ce3cad6218` + exact product head `58e2cfdae8cdea82dd2e30b3886672353c83c612`.

## 2026-08-21 04:52Z — char-limit fail-open закрыт fail-closed

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`; текущий head после Core-исправления `4bf8bbdb0b7dcf185e2180dd5894fbc49bf6ebd4`.

- На старте этого запуска `LATEST` имел Git blob SHA `65ef8953522e2fea35ea7ed5d5fd6e19757397ca` и указывал на валидную ранее опубликованную капсулу `20260821T035647Z-4d3a65379e`, archive SHA-256 `5af3fcfa51e9c2cf8872f0a0b1378f856ed9402ba0f5b24a23981a8ac2488433`.
- Воспроизведённый char-limit fail-open закрыт в `src/session-store.js`: общий checkpoint теперь имеет настоящий жёсткий предел `CHECKPOINT_MAX_CHARS=60000`, а принятый `assistant.tool_calls` обязан целиком пережить trimming. Если это невозможно, `checkpointAcceptedToolProgress()` выбрасывает локальный `QWEN_TOOL_CHECKPOINT_REJECTED` до сохранения/выдачи принятого tool-call клиенту.
- Первичная версия проверки по одним `tool_call.id` оказалась недостаточной: старый вызов с повторно использованным id мог ложноположительно «доказать» сохранение нового oversized-вызова. Это отдельно воспроизведено (`duplicate-id false-pass=true`) и исправлено: теперь проверяется exact нормализованный assistant tool-call, а не только множество id.
- Коммиты: `601806a8b1913e3dff5de4c61826cf238240d5fc` — жёсткий char-budget + fail-closed; `a8a81c4b2dcbc97eedf24644a0b92dab97a1da29` — новый regression; `5d29b2fcaf20870c5dfd052bfe2997d1731b1f41` — включение в `npm test`; `e7dd3e165eb380116ecd25c533c3aa5170c27bb9` + `4bf8bbdb0b7dcf185e2180dd5894fbc49bf6ebd4` — exact accepted-message proof и reused-id regression.
- Новый постоянный regression `scripts/session-checkpoint-tool-char-limit-test.js` проверяет: обычный небольшой вызов сохраняется; oversized вызов с system-message и без него закрывается `QWEN_TOOL_CHECKPOINT_REJECTED`; общий checkpoint не превышает 60k; tool-call без id отвергается; старый вызов с тем же id не может замаскировать выпадение нового oversized-вызова.
- На ChatGPT-hosted машине без сети к Qwen и без внешнего CI целевая логика прошла: `QWEN_CHECKPOINT_TOOL_CHAR_LIMIT_TARGETED_PASS` и после усиления `QWEN_CHECKPOINT_TOOL_CHAR_LIMIT_EXACT_ID_PASS`.
- `server.js` уже отделяет `QWEN_TOOL_CHECKPOINT_REJECTED` от provider/account failure в non-stream пути; streaming-путь ранее уже проводит локальные checkpoint failures через локальную ошибку, не наказывая здоровый Qwen-аккаунт. Живой Qwen не запускался.
- Полный exact-tree `npm test` всё ещё не заявлен: целиком приватное дерево не материализовано на hosted-машине. GitHub Actions, CircleCI, Cloudflare, live Qwen, реальные аккаунты, секреты и production не использовались.

### Постоянная память этого запуска

- Нормативный протокол v2 и исходник `capsule_runtime_v4.py` были перечитаны. Локально вручную реконструировать runtime ради `pack/restore` не стал: проверка Git blob SHA показала, что локальная копия не является exact blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. По правилу «не реконструировать неизвестные bytes» такая копия не использовалась для публикации новой капсулы.
- Поэтому `LATEST/PREVIOUS` в этом запуске намеренно не менялись и force-write не выполнялся. Безопасная точка восстановления продукта — exact GitHub head `4bf8bbdb0b7dcf185e2180dd5894fbc49bf6ebd4`; последняя нормативно опубликованная v4-капсула остаётся `20260821T035647Z-4d3a65379e`.

### Следующее

1. Материализовать exact PR-tree на hosted-машине настолько полно, чтобы прогнать новый `session-checkpoint-tool-char-limit-test.js`, `session-checkpoint-tool-pair-test.js` и соседние session/restart проверки на реальном `src/session-store.js`; если получится всё дерево — полный `npm test` без внешнего CI.
2. Проверить streaming и non-stream ответ на реальном серверном пути при oversized accepted tool-call: клиент не должен получить tool-call, checkpoint не должен измениться, аккаунт Qwen не должен получить cooldown/failure.
3. После следующего существенного факта снова выполнить нормативный v4 checkpoint только exact `capsule_runtime_v4.py`; если exact runtime нельзя материализовать, не подменять его ручной реализацией и не трогать LATEST.

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
