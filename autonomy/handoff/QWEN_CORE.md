# Qwen — агентное ядро

## 2026-08-21

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `9dc80f6c30ae524bbbc96b126bf2e9c90ea819a0`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Свежий результат Qwen Core

- В начале запуска нормативно восстановлен LATEST `20260821T010024Z-3f9244e954` через exact `capsule_runtime_v4.py`; archive SHA-256 `c885734b3b9a38312684d90f65b71b20d0f6fef74141dbabc5886780d029e28c`. Стартовый Git blob SHA указателя: `803ed78ebd782de2bf10d3e99a3aefb7d65a69b8`.
- Найден backward-compatibility дефект persisted coding-subagents: старое состояние могло содержать `status=failed` вместе с `result.uncertain=true`. Restart-логика смотрела только на статус и могла автоматически повторить задачу, хотя предыдущий `write/edit/bash` мог уже сработать.
- `src/subagent-agent-runner.js` теперь считает persisted `result.uncertain=true` таким же fail-closed restart guard, как `status=uncertain/running`. Обычный запуск блокируется `QWEN_SUBAGENT_AGENT_UNCERTAIN_RETRY_BLOCKED`, а явный `retryUncertain=true` сохраняет возможность ручного восстановления.
- Добавлен постоянный `scripts/subagent-legacy-uncertain-restart-test.js`, включён в `npm test`: legacy `failed + uncertain` не должен запускать coding turn, должен сохранить `priorCode/priorPersistenceCode`, а явный retry после этого разрешён.
- Проверен следующий boundary `stopOnError=false + persistence failure`: текущая продуктовая логика уже не пропускает следующие shared-workspace subagents после исходного mutating/uncertain сбоя, даже если сама запись `markUncertain()` падает. Для read-only ошибки сбой `markFailed()` не обязан останавливать следующие задачи; durable `running` при этом остаётся консервативным restart guard.
- Этот инвариант закреплён отдельным `scripts/subagent-state-persist-batch-boundary-test.js`, также включённым в `npm test`.
- Целевая hosted-machine проверка без сети: `QWEN_CORE_TARGETED_RESTART_BOUNDARY_PASS legacy_failed_uncertain=1 explicit_retry=1 persist_failure_boundary=1`.
- Коммиты этого запуска: `7d91f225afb30542c12697ab1ddfa8ae18f7d041`, `1b651c0cff9575d6a60e655e0d7b7ae1d612b26f`, `0a8f081f2d21c0e73f682e8a09bf3aceb629c243`, `ddd10581481456a2248e8aa926ddc22eeef96357`, `9dc80f6c30ae524bbbc96b126bf2e9c90ea819a0`.
- Полный exact-tree `npm test` всё ещё **не заявлен**: целиком приватное дерево локально не материализовано. GitHub Actions, CircleCI, Cloudflare, живой Qwen, реальные аккаунты, секреты и production не использовались.

### Постоянная память / capsule runtime

- Новый нормативный v4 checkpoint: `20260821T015504Z-3ef1e77567`, source ref `9dc80f6c30ae524bbbc96b126bf2e9c90ea819a0`, archive SHA-256 `5ea494a30a3654e5f0c32f56ad723050e61f7a6e76bc0bcdad91d056c3983e3f`.
- Локальные `verify + restore` прошли.
- Immutable upload перечитан и побайтно сверён: manifest Git blob `b4144f95f704c659ae03da40a96ce34e84ca872d`; `part-0000` — 2048 chars / Git blob `5c6d893c316b1bc6304771cedb16cc64c61098bd` / SHA-256 текста `eb8a2ff1c397b075f350dc069a35e0f336933a3a282fb2cb8c154dce7ee1dc24`; `part-0001` — 240 chars / Git blob `1d8425179979339efa500cd88bace081025f6409` / SHA-256 текста `7178832965d156bcc58861b977a4076538de6de06f2998a8d85fa2e35ac8dcf6`.
- Перед публикацией LATEST перечитан и всё ещё имел стартовый blob `803ed78ebd782de2bf10d3e99a3aefb7d65a69b8`, поэтому CAS разрешён. Старый LATEST сохранён как PREVIOUS, новый LATEST опубликован только через `update_file` с exact parent SHA. Новый LATEST content blob: `12f53eb58606568331f83609549e8bab8ca802bd`.
- Исторические immutable capsule не переписывать. Невалидные orphan capsule из старых запусков не использовать и не чинить на месте.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; локальный persist failure работает fail-closed и не загрязняет provider/account health.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет уже выполненный результат.
- Короткое продолжение при незавершённом tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`.
- Несколько tool calls одного assistant-turn отслеживаются независимо по id; частичный набор результатов не снимает соседние pending-вызовы.
- Persisted subagents после потенциально изменяющего инструмента переходят в `uncertain`; старые `failed` записи с `result.uncertain=true` теперь тоже блокируют автоматический replay.
- Read-only `final.incomplete` остаётся retryable; incomplete после потенциального side effect остаётся fail-closed.
- `stopOnError=false` не может протащить следующие shared-workspace subagents через uncertain side-effect boundary, включая secondary persistence failure самого `markUncertain`.
- `onEvent` изолирован от исполнения подагента.
- `opencode-sessions.json` имеет crash-safe primary/backup и откат неудачной записи.
- Qwen thread хранится вместе с аккаунтом-владельцем; при допустимой смене аккаунта старый `chatId` соседу не передаётся.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым инженерным prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. Начать со свежего нормативного LATEST `20260821T015504Z-3ef1e77567`, затем перечитать этот handoff и свежий PR #6 head.
2. Материализовать достаточный exact private tree на ChatGPT-hosted машине и выполнить новые `subagent-legacy-uncertain-restart`, `subagent-state-persist-batch-boundary` плюс соседние `subagent-side-effect-uncertainty`, `subagent-uncertain-batch-stop`, `subagent-batch-resume`, `subagent-retry-diagnostic-preservation`; если получится всё дерево — полный `npm test`, без внешнего CI/provider traffic.
3. Следующий Core boundary: проверить partially migrated persisted records — например `status=done/failed` с противоречащими `result.ok/result.uncertain` — и убедиться, что restart никогда не принимает небезопасную запись как завершённую только из-за одного старого поля статуса.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
