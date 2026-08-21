# Qwen — агентное ядро

## 2026-08-21 03:56Z — checkpoint trimming больше не рвёт tool-call/result

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`; текущий наблюдавшийся head `5c7df532f747cdb103d02fdd0de26feb957b4ae8`. Core-изменение находится в его прямой истории; параллельные более поздние изменения затронули только `provider-circuit` и принадлежат reliability-worker.

- В начале запуска нормативный `LATEST` имел Git blob SHA `4be671a4e1bce81dd8f2c443114301e5f3929d56` и указывал на `20260821T030348Z-d475ee3ae1`. Manifest и обе части были загружены отдельно и exact `capsule_runtime_v4.py` (Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`) успешно выполнил `verify + restore`; archive SHA-256 `f0e6c3afe2b792c2554b96a84dc44c6c4c829968ba24ba33f83af5fd1a80ad8c`.
- Закрыт воспроизведённый Core-дефект checkpoint trimming: старый простой suffix-trim мог удалить старый `assistant.tool_calls`, но оставить более новый `role=tool`. После restart получался сиротский результат инструмента без исходного вызова.
- `src/session-store.js` теперь режет обычную историю replay-safe группами. `assistant` с `tool_calls` объединяется с непосредственно следующими результатами этих call id и сохраняется/удаляется только целиком; standalone `role=tool` в checkpoint не сохраняется. Свежий незавершённый assistant tool-call остаётся допустимой одноэлементной группой, поэтому `findPendingToolCalls()` продолжает видеть pending-вызов после restart.
- Продуктовый commit: `79c55dad2471cd0aa04baf4f08e67035005f5bc8`. Постоянный regression `scripts/session-checkpoint-tool-pair-test.js`: `b61c2a7deadfdc92aef9cc0aa4e0e022c0424023`. Включение теста в `npm test`: `3b817954aaefd838d70f03d418377a4bfc344a3c`.
- Hosted-machine проверка без Qwen/CI: `QWEN_CHECKPOINT_TOOL_PAIR_AWARE_PASS orphan=0 pending=1 completed_pair=1 multi=1 bounded=24`. Проверены граница лимита сообщений, completed pair, pending call и два tool-call с двумя результатами.
- Full exact-tree `npm test` всё ещё не заявлен: всё приватное дерево на hosted-машине не материализовано. GitHub Actions, CircleCI, Cloudflare, live Qwen, реальные аккаунты, секреты и production не использовались.

### Постоянная память

- После изменения рабочий checkpoint упакован exact v4: capsule `20260821T035647Z-4d3a65379e`, source ref `5c7df532f747cdb103d02fdd0de26feb957b4ae8`, archive SHA-256 `5af3fcfa51e9c2cf8872f0a0b1378f856ed9402ba0f5b24a23981a8ac2488433`.
- Локальные `verify + restore` прошли. Immutable upload перечитан: `part-0000` Git blob `1a317616ab42920b835f68f06aa48308a0aeb1d5`, `part-0001` `5e93d79746366a544231b21e62bf47539aae0754`, manifest `456f1a95f7ff73b0e709746a40df282ffe9ebce7`; они совпали с заранее рассчитанными локальными Git blob SHA/длинами.
- Перед публикацией `LATEST` был перечитан и всё ещё имел точный run-start parent `4be671a4e1bce81dd8f2c443114301e5f3929d56`, поэтому CAS допустим. Старый LATEST сохранён в PREVIOUS, новый LATEST опубликован только с этим exact parent SHA; новый pointer blob `65ef8953522e2fea35ea7ed5d5fd6e19757397ca`.

### Следующее

1. Материализовать достаточную часть exact PR-tree на hosted-машине и прогнать новый `session-checkpoint-tool-pair-test.js` вместе с соседними session/restart проверками; если удастся всё дерево — полный `npm test` без внешнего CI.
2. Проверить тот же инвариант на символьной границе `CHECKPOINT_MAX_CHARS`: большой completed tool-turn должен удаляться целиком, а не превращаться в orphan/pending и не вытеснять обязательные system messages.
3. Затем продолжить ближайший воспроизводимый Core-дефект в session/restart/OpenCode/subagent слоях. Cooldown/account-selection не перехватывать у reliability-worker без пересечения.

## 2026-08-21 — предыдущий свежий результат

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`; head того прохода `ffd19b208da8be58f5de9d11c4240327b9e0ad81`. Core-изменения находятся в его прямой истории.

- Найден backward-compatibility fail-open в persisted coding-subagent state. Старый predicate блокировал только `done+not-ok` и `non-done+ok=true`, поэтому malformed/partially migrated записи `failed` без нормального `result.ok=false`, `pending+stale result`, неизвестный `status` могли автоматически запустить задачу заново.
- Исправлено: добавлен явный `hasPersistedStateConflict()`. Разрешённые согласованные состояния теперь проверяются по статусу: `done` требует `ok=true`; `failed` требует `ok=false`; `pending` не должен иметь result; неизвестный status конфликтный; `running/uncertain + ok=true` конфликтны. Конфликт остаётся fail-closed до явного `retryUncertain=true`.
- Коммит продукта: `0842350db2e6bf7dc4bd03d13cc9c19a10d50410`; расширенный regression: `075602972f1b41ecaf61ed44319a2681760ffd3b`. Hosted-machine marker: `QWEN_SUBAGENT_PERSISTED_STATE_GAP_REPRO_PASS fail_open_cases=4 hardened_blocks=4 valid_states_preserved=5`.
- Исправлен restart/system-prompt дефект: при истории >24 сообщений checkpoint терял второй и следующие system-блоки. Теперь ёмкость сначала резервируется для всех системных сообщений в порядке исходной истории, затем для свежих обычных ходов. Regression `scripts/session-checkpoint-system-retention-test.js` включён в `npm test`; marker `QWEN_CHECKPOINT_MULTI_SYSTEM_LONG_REPRO_PASS before_systems=1 after_systems=2 bounded_messages=24 newest_turn=1`.

## Предыдущий накопленный канон

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; локальный persist failure fail-closed и не загрязняет provider/account health.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет выполненный result.
- Короткое продолжение при pending tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`; несколько tool calls отслеживаются независимо по id.
- Checkpoint trimming сохраняет system messages и теперь не создаёт orphan `role=tool`: tool-call/result режутся согласованными replay-safe группами.
- Persisted subagents после возможного side effect переходят в `uncertain`; legacy `failed + result.uncertain=true` также блокирует replay.
- Противоречивые persisted status/result пары блокируются как `QWEN_SUBAGENT_PERSISTED_STATE_CONFLICT`, а чистый `done + ok=true` resume не запускает Qwen заново.
- Read-only `final.incomplete` остаётся retryable; incomplete после потенциального side effect fail-closed.
- `stopOnError=false` не пересекает uncertain shared-workspace boundary даже при secondary persistence failure.
- `onEvent` изолирован; OpenCode session checkpoint crash-safe; Qwen thread хранится вместе с account owner.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.
