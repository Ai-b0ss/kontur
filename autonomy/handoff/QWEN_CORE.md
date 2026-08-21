# Qwen — агентное ядро

## 2026-08-21

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `fec721cff93d3dfb891d119cb1b08d40001c5807`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Свежий результат Qwen Core

- В начале запуска нормативно восстановлен LATEST `20260820T235137Z-5bb3f8906e` через `capsule_runtime_v4.py`; archive SHA-256 `d602c464811823c5279cc58e3da9b85e4a2941ac7fdee99eddc6e2ba15790c66`. Стартовый Git blob SHA указателя: `c7fbc10522cac933850bcccaae2fbf4157bbe9c1`.
- Проверен реальный отказ `markRunning()` при явном `retryUncertain=true`: при сбое замены batch-store прежнее каноническое `uncertain`-состояние и его диагностика остаются побайтно нетронутыми. Coding turn не стартует, потому что `markRunning()` выполняется до `runOne()`. Локальный результат: `QWEN_SUBAGENT_MARK_RUNNING_FAILURE_PASS fail_closed=1 prior_diagnostic_preserved=1 canonical_unchanged=1`.
- Найден и исправлен следующий Core-дефект автономности: любой `final.incomplete` / `QWEN_AGENT_ROUND_LIMIT` раньше безусловно помечался `uncertain=true`. Из-за этого даже подагент, который только читал файлы и исчерпал лимит ходов, становился заблокирован для обычного автоматического повтора.
- Теперь `src/subagent-agent-runner.js` классифицирует incomplete по реально наблюдавшимся инструментам. После только read-only работы результат остаётся обычным `failed` и может повториться; после `bash/write_file/edit_file/append_file` остаётся `uncertain` и fail-closed.
- Постоянный `scripts/subagent-side-effect-uncertainty-test.js` расширен двумя сценариями: read-only round limit обязан быть retryable, mutating round limit обязан оставаться uncertain.
- Продуктовые коммиты этого блока: `794f908075707d3ffeac61c08652206a2a72fe0f` и `fec721cff93d3dfb891d119cb1b08d40001c5807`.
- На ChatGPT-hosted машине без внешнего CI/provider traffic прошла целевая классификация: `QWEN_SUBAGENT_ROUND_LIMIT_CLASSIFICATION_PASS readonly_retryable=1 mutating_fail_closed=1`.
- Полный exact-tree `npm test` всё ещё **не заявлен**: целиком приватное дерево локально не материализовано. GitHub Actions, CircleCI, Cloudflare, живой Qwen, реальные аккаунты, секреты и production не использовались.

### Постоянная память / capsule runtime

- Новый нормативный v4 checkpoint: `20260821T010024Z-3f9244e954`, source ref `fec721cff93d3dfb891d119cb1b08d40001c5807`, archive SHA-256 `c885734b3b9a38312684d90f65b71b20d0f6fef74141dbabc5886780d029e28c`.
- Локальные `verify + restore` прошли. Immutable upload перечитан и побайтно сверён: manifest Git blob `064fcc655d0db84668dad3c593e32af4b41e66b7`; part-0000 2048 chars / Git blob `91a31133113b74dc9745e1656e189490032e77ce` / SHA-256 `9302056c7cfd1ad6e66c2484287c3394a432104648dfbc80b3576bee86fdbdcc`; part-0001 388 chars / Git blob `17187bfbed198f299e91ee84dad8a94f3bc75955` / SHA-256 `4e82c68094a76c5707eea1112c7096a89d2982593ec00eff20eb8651906e3e7a`.
- Перед публикацией LATEST был перечитан и всё ещё имел исходный blob `c7fbc10522cac933850bcccaae2fbf4157bbe9c1`, поэтому CAS разрешён. Старый LATEST сохранён как PREVIOUS, новый LATEST опубликован через `update_file` с exact parent SHA. Новый LATEST content blob: `803ed78ebd782de2bf10d3e99a3aefb7d65a69b8`.
- Валидная непубликованная старая capsule `20260820T235757Z-6376281fee` остаётся историческим immutable checkpoint; текущий LATEST уже новее и содержит результат этого запуска.
- Невалидные orphan capsule `20260820T210123Z-c4c0632939`, `20260820T185657Z-a15bcde178`, `20260820T190401Z-9dcd764069` не использовать и не чинить на месте.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; локальный persist failure работает fail-closed и не загрязняет provider/account health.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет уже выполненный результат.
- Короткое продолжение при незавершённом tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`.
- Несколько tool calls одного assistant-turn отслеживаются независимо по id; частичный набор результатов не снимает соседние pending-вызовы.
- Streaming terminal lifecycle exactly-once; поздние parser data не пишут после завершения.
- Persisted subagents после потенциально изменяющего инструмента переходят в `uncertain`; автоматический повтор после restart блокируется до явного разрешения.
- Сбой `markRunning` происходит до старта coding turn и не разрушает прежнюю uncertain-диагностику.
- Read-only `final.incomplete` больше не превращается искусственно в uncertain; incomplete после потенциального side effect остаётся fail-closed.
- `onEvent` изолирован от исполнения подагента.
- `opencode-sessions.json` имеет crash-safe primary/backup и откат неудачной записи.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. Следующий запуск начинает с нормативного LATEST `20260821T010024Z-3f9244e954`, затем перечитывает этот handoff и свежий PR #6 head.
2. Материализовать достаточный exact private tree на ChatGPT-hosted машине и выполнить постоянные `subagent-side-effect-uncertainty`, `subagent-batch-resume`, `subagent-retry-diagnostic-preservation` и соседние session/restart regressions; если получится всё дерево — полный `npm test`, без внешнего CI/provider traffic.
3. Следующий Core boundary: проверить много-задачный persisted batch при `stopOnError=false`. Безопасная read-only ошибка/round-limit не должна без причины превращать последующие независимые задачи в skipped; mutating uncertain по-прежнему должен оставаться консервативным.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
