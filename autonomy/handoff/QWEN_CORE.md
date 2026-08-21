# Qwen — агентное ядро

## 2026-08-21

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`, текущий head `3b8206eefbf319957c12a0ef46ed31fdf74801f8`, PR draft/open.

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Свежий результат Qwen Core

- В начале запуска нормативно восстановлен LATEST `20260821T010024Z-3f9244e954` через exact `capsule_runtime_v4.py`; archive SHA-256 `c885734b3b9a38312684d90f65b71b20d0f6fef74141dbabc5886780d029e28c`. Стартовый Git blob SHA указателя: `803ed78ebd782de2bf10d3e99a3aefb7d65a69b8`.
- Закрыт backward-compatibility replay-дефект: persisted state вида `status=failed + result.uncertain=true` раньше мог автоматически повториться после restart. Теперь `result.uncertain=true` сам по себе является fail-closed guard независимо от старого поля status. Обычный запуск блокируется, `retryUncertain=true` остаётся явным способом восстановления.
- Добавлен `scripts/subagent-legacy-uncertain-restart-test.js` и включён в `npm test`.
- Проверен и закреплён boundary `stopOnError=false + persistence failure`: secondary ошибка `markUncertain()` не может пропустить следующий shared-workspace subagent после mutating/uncertain сбоя; read-only ошибка при упавшем `markFailed()` может продолжить batch, сохраняя durable `running` как консервативный restart guard. Добавлен `scripts/subagent-state-persist-batch-boundary-test.js`.
- После этого найден второй persisted-state дефект: код доверял одному полю `status`. Противоречивые записи вроде `status=done` с missing/failed result или `status=failed/pending` с `result.ok=true` могли либо быть ошибочно приняты как завершённые, либо автоматически повторить уже завершившуюся задачу.
- Теперь такие записи дают `QWEN_SUBAGENT_PERSISTED_STATE_CONFLICT` и fail-closed блокируют automatic replay. Единственный нормальный resume без запуска — `status=done + result.ok=true`. Явный `retryUncertain=true` остаётся recovery escape hatch для конфликтных старых записей.
- Добавлен `scripts/subagent-persisted-state-conflict-test.js` и включён в `npm test`: блокируются `done+failed`, `done+missing`, `failed+ok`, `pending+ok`; чистый `done+ok` resume проходит; explicit retry разрешён.
- Целевая hosted-machine проверка первого блока без сети: `QWEN_CORE_TARGETED_RESTART_BOUNDARY_PASS legacy_failed_uncertain=1 explicit_retry=1 persist_failure_boundary=1`.
- Коммиты этого запуска в продуктовой ветке: `7d91f225afb30542c12697ab1ddfa8ae18f7d041`, `1b651c0cff9575d6a60e655e0d7b7ae1d612b26f`, `0a8f081f2d21c0e73f682e8a09bf3aceb629c243`, `ddd10581481456a2248e8aa926ddc22eeef96357`, `9dc80f6c30ae524bbbc96b126bf2e9c90ea819a0`, `e7c86a3b53cf9cb175dcec31f7098063926b789f`, `9efe785638cd6e2286d458bb0275deb58ccb7c70`, `3b8206eefbf319957c12a0ef46ed31fdf74801f8`.
- Полный exact-tree `npm test` всё ещё **не заявлен**: целиком приватное дерево локально не материализовано. GitHub Actions, CircleCI, Cloudflare, живой Qwen, реальные аккаунты, секреты и production не использовались.

### Постоянная память / capsule runtime

- Первый новый нормативный v4 checkpoint этого запуска: `20260821T015504Z-3ef1e77567`, source ref `9dc80f6c30ae524bbbc96b126bf2e9c90ea819a0`, archive SHA-256 `5ea494a30a3654e5f0c32f56ad723050e61f7a6e76bc0bcdad91d056c3983e3f`.
- Локальные `verify + restore` прошли. Immutable upload перечитан: manifest Git blob `b4144f95f704c659ae03da40a96ce34e84ca872d`; part-0000 2048 chars / blob `5c6d893c316b1bc6304771cedb16cc64c61098bd`; part-0001 240 chars / blob `1d8425179979339efa500cd88bace081025f6409`.
- Перед публикацией LATEST всё ещё имел стартовый blob `803ed78ebd782de2bf10d3e99a3aefb7d65a69b8`. Старый LATEST сохранён как PREVIOUS, новый опубликован через CAS. Текущий LATEST blob `12f53eb58606568331f83609549e8bab8ca802bd` указывает на `20260821T015504Z-3ef1e77567`.
- После второго существенного блока создан более свежий immutable v4 checkpoint `20260821T020001Z-5d1c311199`, source ref `3b8206eefbf319957c12a0ef46ed31fdf74801f8`, archive SHA-256 `b0bcb1d816c21fb5f82adc1dac045e066b978c924117321361f1c0edbe1e9c0d`. Локальные `verify + restore` прошли; uploaded part blob `6b6aa3072a380878742cc3a28ad5e5bf704a42ed`, manifest blob `19db0b5809d6719e99e5134a88b94e5cdf137029`.
- Второй checkpoint **не публиковался в LATEST**: run-start CAS parent уже был использован и LATEST изменился на `12f53e...`. Протокол v2 запрещает force-write. Оставить `20260821T020001Z-5d1c311199` immutable и принять его через handoff/fresh source в следующем запуске.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; локальный persist failure fail-closed и не загрязняет provider/account health.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет выполненный result.
- Короткое продолжение при pending tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`; несколько tool calls отслеживаются независимо по id.
- Persisted subagents после возможного side effect переходят в `uncertain`; legacy `failed + result.uncertain=true` также блокирует replay.
- Противоречивые persisted status/result пары теперь блокируются как `QWEN_SUBAGENT_PERSISTED_STATE_CONFLICT`, а чистый `done + ok=true` resume не запускает Qwen заново.
- Read-only `final.incomplete` остаётся retryable; incomplete после потенциального side effect fail-closed.
- `stopOnError=false` не пересекает uncertain shared-workspace boundary даже при secondary persistence failure.
- `onEvent` изолирован; OpenCode session checkpoint crash-safe; Qwen thread хранится вместе с account owner.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. Начать с нормативного LATEST `20260821T015504Z-3ef1e77567`, затем обязательно учесть более свежий immutable checkpoint `20260821T020001Z-5d1c311199` и свежий PR #6 head `3b8206ee...`.
2. Материализовать достаточный exact private tree на ChatGPT-hosted машине и выполнить новые `subagent-legacy-uncertain-restart`, `subagent-state-persist-batch-boundary`, `subagent-persisted-state-conflict` плюс соседние subagent/session regressions; если получится всё дерево — полный `npm test`, без внешнего CI/provider traffic.
3. Следующий Core boundary: проверить, может ли `retryUncertain=true` на конфликтной persisted записи потерять старую диагностику при новом `markRunning`/последующем crash, и нужны ли отдельные migration/diagnostic поля для таких conflict-records.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
