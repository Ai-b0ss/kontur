# Qwen — агентное ядро

## 2026-08-21 — свежий результат

`qwen-free-api`: PR #6, ветка `autopilot/qwen-runtime-preflight-20260818`; текущий head на момент handoff `ffd19b208da8be58f5de9d11c4240327b9e0ad81`. Core-изменения этого прохода находятся в его прямой истории; два более поздних коммита затрагивают только `provider-circuit`/provider safety и относятся к reliability-worker.

- Нормативный стартовый LATEST восстановлен exact `capsule_runtime_v4.py`: `20260821T015504Z-3ef1e77567`, archive SHA-256 `5ea494a30a3654e5f0c32f56ad723050e61f7a6e76bc0bcdad91d056c3983e3f`. Запомненный run-start Git blob SHA `LATEST.json`: `12f53eb58606568331f83609549e8bab8ca802bd`.
- Найден новый backward-compatibility fail-open в persisted coding-subagent state. Старый predicate блокировал только `done+not-ok` и `non-done+ok=true`, поэтому malformed/partially migrated записи `failed` без нормального `result.ok=false`, `pending+stale result`, неизвестный `status` могли автоматически запустить задачу заново.
- Исправлено: добавлен явный `hasPersistedStateConflict()`. Разрешённые согласованные состояния теперь проверяются по статусу: `done` требует `ok=true`; `failed` требует `ok=false`; `pending` не должен иметь result; неизвестный status конфликтный; `running/uncertain + ok=true` конфликтны. Конфликт остаётся fail-closed до явного `retryUncertain=true`.
- Коммит продукта: `0842350db2e6bf7dc4bd03d13cc9c19a10d50410`; расширенный regression: `075602972f1b41ecaf61ed44319a2681760ffd3b`. Тест теперь блокирует 8 конфликтных/неполных форм и отдельно доказывает, что чистые `failed+ok=false`, `pending` и `done+ok=true` не ломаются.
- Hosted-machine воспроизведение до исправления/после исправления: `QWEN_SUBAGENT_PERSISTED_STATE_GAP_REPRO_PASS fail_open_cases=4 hardened_blocks=4 valid_states_preserved=5`.
- Найден и исправлен второй Core-дефект restart/system-prompt: `checkpointMessages()` при истории >24 сообщений сохранял только первый элемент и хвост, поэтому второй системный блок (например, `Instructions from: PROJECT.md`) исчезал после долгой OpenCode-сессии и restart.
- Исправление резервирует checkpoint-ёмкость сначала для всех системных сообщений в исходном порядке, затем для самых свежих обычных ходов. Продуктовый фикс прошёл через `e1b70fba...` и восстановление исходных safety-комментариев `6714ae53c8a906883023520f9d5a4ff12f287f58`; постоянный regression `scripts/session-checkpoint-system-retention-test.js` добавлен `820911cb764cb26edcc3924a40b9e986c620cc52` и включён в `npm test` коммитом `dc12e229fc023dafa25da7d9c171873e71ba09b4`.
- Hosted-machine воспроизведение: старый алгоритм на 25 сообщениях оставлял только 1/2 системных блоков; новый сохраняет 2/2, общий checkpoint остаётся 24 сообщения и сохраняет самый свежий обычный ход: `QWEN_CHECKPOINT_MULTI_SYSTEM_LONG_REPRO_PASS before_systems=1 after_systems=2 bounded_messages=24 newest_turn=1`.
- Следующий точный Core-дефект уже воспроизведён, но пока не исправлен: message-count/char trimming может отрезать `assistant.tool_calls` на старой границе, оставив более новый `role=tool` без соответствующего assistant call. Маркер: `QWEN_CHECKPOINT_TOOL_PAIR_SPLIT_REPRO_PASS orphan_tool_result=1 assistant_call_dropped=1`. Следующий проход должен сделать checkpoint trimming tool-pair aware (не сохранять orphan tool result и не терять pending call на границе), затем проверить restart через настоящий `session-store`.
- Полный exact-tree `npm test` всё ещё **не заявлен**: приватное дерево целиком не материализовано на hosted-машине. Внешний CI, живой Qwen, Cloudflare, production и секреты не использовались.

## Предыдущий накопленный канон

`qwen-workspace`: PR #5, ветка `fix/u01-cache-coherence`, head `ce51b26c227b08032301a8574fee4fe2ee9330a3` по последней проверке.

### Уже доказанные инварианты Core

- Non-stream и streaming accepted `assistant.tool_calls` сохраняются до выдачи клиенту; локальный persist failure fail-closed и не загрязняет provider/account health.
- Подтверждённый `role=tool` сохраняется до следующего upstream-запроса; restart не теряет выполненный result.
- Короткое продолжение при pending tool-call останавливается `409 QWEN_PENDING_TOOL_RESULT`; несколько tool calls отслеживаются независимо по id.
- Persisted subagents после возможного side effect переходят в `uncertain`; legacy `failed + result.uncertain=true` также блокирует replay.
- Противоречивые persisted status/result пары блокируются как `QWEN_SUBAGENT_PERSISTED_STATE_CONFLICT`, а чистый `done + ok=true` resume не запускает Qwen заново.
- Read-only `final.incomplete` остаётся retryable; incomplete после потенциального side effect fail-closed.
- `stopOnError=false` не пересекает uncertain shared-workspace boundary даже при secondary persistence failure.
- `onEvent` изолирован; OpenCode session checkpoint crash-safe; Qwen thread хранится вместе с account owner.
- Tool-loop продолжает после tool result, возвращает malformed JSON/executor errors модели как tool result, не исполняет незакрытый `<tool_call>`, хранит все calls одного model-turn и явно завершает `QWEN_AGENT_ROUND_LIMIT`.
- System prompt modes: `engineer` с базовым prompt; `owner` без конкурирующей инженерной персоны, приватный prompt владельца не переписывается.

### Постоянная память до этого прохода

- LATEST до начала этого прохода: `20260821T015504Z-3ef1e77567`, source ref `9dc80f6c30ae524bbbc96b126bf2e9c90ea819a0`, archive SHA-256 `5ea494a30a3654e5f0c32f56ad723050e61f7a6e76bc0bcdad91d056c3983e3f`; pointer blob `12f53eb58606568331f83609549e8bab8ca802bd`.
- Более свежий immutable checkpoint предыдущего запуска `20260821T020001Z-5d1c311199`, source ref `3b8206eefbf319957c12a0ef46ed31fdf74801f8`, archive SHA-256 `b0bcb1d816c21fb5f82adc1dac045e066b978c924117321361f1c0edbe1e9c0d` был оставлен immutable без force-update LATEST из-за уже использованного CAS-parent.

### Границы работы

Узкую механику cooldown/account selection не перехватывать у reliability-worker без пересекающегося Core-дефекта. Обычные Node/Python/offline/tool-loop/restart/browser проверки выполнять на ChatGPT-hosted машине. GitHub Actions/CircleCI/Cloudflare ради обычной проверки не запускать. Живой Qwen не повторять, пока не восстановлена судьба старой разрешённой live-попытки. Production, deploy, реальные аккаунты и секреты не трогать.

### Следующее

1. В начале следующего запуска восстановить нормативный LATEST/PREVIOUS по протоколу v2 и сверить свежий PR #6 head, не перетирая работу reliability-worker.
2. Исправить уже воспроизведённую границу checkpoint trimming: `assistant.tool_calls + role=tool` должны сохраняться/отбрасываться как согласованная история; orphan tool-result в checkpoint запрещён. Проверить pending multi-call и completed tool-result после restart.
3. Затем материализовать достаточный exact private tree на hosted-машине и выполнить новые persisted-state/system-checkpoint regressions плюс соседние session/subagent тесты; если получится всё дерево — полный `npm test`, без внешнего CI/provider traffic.
4. После полного offline green — Windows/live только по прежним ограничениям и без дублирования provider traffic.
