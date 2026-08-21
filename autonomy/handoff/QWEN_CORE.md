# Qwen — агентное ядро

## 2026-08-21

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `e3c961c36e67d30fcebf5da82139288a0af5a092`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Свежий результат Qwen Core

- В начале запуска нормативно восстановлен LATEST `20260820T235137Z-5bb3f8906e` через `capsule_runtime_v4.py`; archive SHA-256 `d602c464811823c5279cc58e3da9b85e4a2941ac7fdee99eddc6e2ba15790c66`. Стартовый Git blob SHA указателя: `c7fbc10522cac933850bcccaae2fbf4157bbe9c1`.
- Проверен реальный отказ `markRunning()` при явном `retryUncertain=true`: при сбое замены batch-store прежнее каноническое `uncertain`-состояние и его диагностика остаются побайтно нетронутыми. Coding turn не стартует, потому что `markRunning()` выполняется до `runOne()`. Локальный результат: `QWEN_SUBAGENT_MARK_RUNNING_FAILURE_PASS fail_closed=1 prior_diagnostic_preserved=1 canonical_unchanged=1`.
- Исправлен дефект round-limit: любой `final.incomplete` раньше безусловно становился `uncertain=true`, из-за чего даже чисто read-only подагент блокировался для обычного повтора. Теперь incomplete классифицируется по реально наблюдавшимся инструментам: read-only остаётся обычным `failed`, а после `bash/write_file/edit_file/append_file` остаётся `uncertain` и fail-closed.
- `scripts/subagent-side-effect-uncertainty-test.js` расширен сценариями read-only и mutating round-limit. Продуктовые коммиты: `794f908075707d3ffeac61c08652206a2a72fe0f`, `fec721cff93d3dfb891d119cb1b08d40001c5807`. Локальная целевая проверка: `QWEN_SUBAGENT_ROUND_LIMIT_CLASSIFICATION_PASS readonly_retryable=1 mutating_fail_closed=1`.
- После этого найден и закрыт второй Core-дефект: при `stopOnError=false` batch раньше продолжал следующие coding-subagents даже после `uncertain`-сбоя с потенциальным изменением общего workspace. Это опасно: следующий агент мог работать поверх состояния, про которое неизвестно, успел ли предыдущий `write/edit/bash` завершиться.
- Теперь `stopOnError=false` продолжает batch только после обычной retryable-ошибки. После `failed.uncertain === true` batch всегда останавливается, а оставшиеся задачи помечаются skipped. Добавлен постоянный `scripts/subagent-uncertain-batch-stop-test.js` и включён в `npm test`; он отдельно требует, чтобы mutating-uncertain остановил вторую задачу, а две read-only ошибки при `stopOnError=false` обе реально исполнились.
- Коммиты второго блока: `08ae89e32668a65fec2e31a91f249ab4d03c2635`, `ad399b2faab628851fd72a6666c6ad555cbc5c24`, `e3c961c36e67d30fcebf5da82139288a0af5a092`. Локальная целевая проверка: `QWEN_SUBAGENT_UNCERTAIN_BATCH_STOP_LOGIC_PASS mutating_stops=1 readonly_continue=1 default_stops=1`.
- Полный exact-tree `npm test` всё ещё **не заявлен**: целиком приватное дерево локально не материализовано. GitHub Actions, CircleCI, Cloudflare, живой Qwen, реальные аккаунты, секреты и production не использовались.

### Постоянная память / capsule runtime

- Первый новый нормативный v4 checkpoint: `20260821T010024Z-3f9244e954`, source ref `fec721cff93d3dfb891d119cb1b08d40001c5807`, archive SHA-256 `c885734b3b9a38312684d90f65b71b20d0f6fef74141dbabc5886780d029e28c`.
- Его локальные `verify + restore` прошли. Immutable upload перечитан и побайтно сверён: manifest Git blob `064fcc655d0db84668dad3c593e32af4b41e66b7`; part-0000 2048 chars / Git blob `91a31133113b74dc9745e1656e189490032e77ce` / SHA-256 `9302056c7cfd1ad6e66c2484287c3394a432104648dfbc80b3576bee86fdbdcc`; part-0001 388 chars / Git blob `17187bfbed198f299e91ee84dad8a94f3bc75955` / SHA-256 `4e82c68094a76c5707eea1112c7096a89d2982593ec00eff20eb8651906e3e7a`.
- Перед первой публикацией LATEST был перечитан и всё ещё имел исходный blob `c7fbc10522cac933850bcccaae2fbf4157bbe9c1`, поэтому CAS разрешён. Старый LATEST сохранён как PREVIOUS, новый LATEST опубликован через `update_file` с exact parent SHA. Новый LATEST content blob: `803ed78ebd782de2bf10d3e99a3aefb7d65a69b8`.
- После второго существенного блока создан ещё один валидный immutable v4 checkpoint `20260821T010503Z-3d44a4df33`, source ref `e3c961c36e67d30fcebf5da82139288a0af5a092`, archive SHA-256 `6bae48948772052656ff78548e508342838c2bfea0d1089508b643e4777c3485`. Локальные `verify + restore` прошли; uploaded manifest Git blob `4576f3a8e550ef207fb8afcc5237a295e8a9a71d`, part-0000 1940 chars / Git blob `9a0db4537fd7758fabae4f6ecabb5e4e9dcf7351` / SHA-256 `657aee1dad483d250fec9e4277bbadc45e8a91d56dc150ba28a46d33a0af56d0`.
- Второй checkpoint **не публиковался в LATEST**: run-start CAS-parent уже был использован первой публикацией и изменился. Протокол v2 запрещает force-write. `20260821T010503Z-3d44a4df33` оставить immutable и принять в следующем запуске через handoff + fresh source head.
- Валидная непубликованная старая capsule `20260820T235757Z-6376281fee` остаётся историческим immutable checkpoint. Невалидные orphan capsule `20260820T210123Z-c4c0632939`, `20260820T185657Z-a15bcde178`, `20260820T190401Z-9dcd764069` не использовать и не чинить на месте.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; локальный persist failure работает fail-closed и не загрязняет provider/account health.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет уже выполненный результат.
- Короткое продолжение при незавершённом tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`.
- Несколько tool calls одного assistant-turn отслеживаются независимо по id; частичный набор результатов не снимает соседние pending-вызовы.
- Streaming terminal lifecycle exactly-once; поздние parser data не пишут после завершения.
- Persisted subagents после потенциально изменяющего инструмента переходят в `uncertain`; автоматический повтор после restart блокируется до явного разрешения.
- Сбой `markRunning` происходит до старта coding turn и не разрушает прежнюю uncertain-диагностику.
- Read-only `final.incomplete` больше не превращается искусственно в uncertain; incomplete после потенциального side effect остаётся fail-closed.
- `stopOnError=false` не может протащить следующие shared-workspace subagents через uncertain side-effect boundary; после обычной read-only/retryable ошибки продолжение по-прежнему разрешено.
- `onEvent` изолирован от исполнения подагента.
- `opencode-sessions.json` имеет crash-safe primary/backup и откат неудачной записи.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. Следующий запуск начинает с нормативного LATEST `20260821T010024Z-3f9244e954`, затем перечитывает этот handoff и свежий PR #6 head. Более свежая immutable capsule `20260821T010503Z-3d44a4df33` не является LATEST из-за строгого CAS-правила.
2. Материализовать достаточный exact private tree на ChatGPT-hosted машине и выполнить постоянные `subagent-side-effect-uncertainty`, `subagent-uncertain-batch-stop`, `subagent-batch-resume`, `subagent-retry-diagnostic-preservation` и соседние session/restart regressions; если получится всё дерево — полный `npm test`, без внешнего CI/provider traffic.
3. Следующий Core boundary: проверить `stopOnError=false` вместе с persistence failure самого `markFailed/markUncertain`: secondary store failure не должен случайно разрешать продолжение shared-workspace batch, если исходный результат uncertain.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
