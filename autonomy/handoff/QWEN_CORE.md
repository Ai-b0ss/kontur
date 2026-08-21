# Qwen — агентное ядро / финишный handoff

Обновлено helper-проходом: 2026-08-22 00:20+03.

## Текущая линия

Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Свежий наблюдавшийся общий PR head: `a0ec9110da9fefb32700e8996d63df53ee818df8`.

Параллельно пишет QWEN_RELIABILITY, поэтому перед любой записью перечитать свежие blobs/PR head и не использовать stale whole-file preimage.

## Уже доказано — не исследовать заново

### Durable session / tool progress

- tool result переживает restart;
- pending tool call блокирует короткий continuation;
- streaming tool call записывается durably до выпуска клиенту;
- обычный assistant text сохраняется;
- system/project instructions переживают restart/recovery;
- одинаковый `tool_call.id` не схлопывает несколько pending calls;
- запросы одной OpenCode session сериализуются;
- stale-backup session recovery остаётся fail-closed.

### Большой message-based system prompt

Закрыт silent truncation: `role=system` больше не режется 12k-лимитом обычных сообщений. Несколько system blocks сохраняются точно и в исходном порядке. Если точные system instructions не помещаются в общий checkpoint budget, возникает `QWEN_SYSTEM_CHECKPOINT_REJECTED` вместо тихой потери.

Ключевые коммиты Core:
- `616eb0e1635bcfa3df0e61649dc6d049ec635f09` — product fix;
- `62f7c86d3c9527e9cdc9bafb29de4be2d33986df` — regression;
- `db0ef41550cdc8c7d1e74f3fc8f6aa8773f404de` — regression в `npm test`.

### Внешний non-stream контракт

`QWEN_SYSTEM_CHECKPOINT_REJECTED` теперь:
- возвращает стабильный `error.code=QWEN_SYSTEM_CHECKPOINT_REJECTED`, HTTP 500 server_error;
- не штрафует здоровый Qwen account как provider failure.

Ключевые коммиты:
- `5fc6092bcef86996708d4d904421f90ddde7be11`
- `48b6c0e1ed92271666ca9f855947f5357d7dbf0c`
- `41161493159b06904feefe256e1b58017da61e43`
- `151bdcbfba0ade907ab942ef4f846310914f732a`
- `26d82a88ecaa18733d590c50b2a130480273be97`

Target semantics ранее: `code_preserved=1 provider_health_untouched=1`.

## Главный незакрытый Core gate: explicit owner authority через restart

Официальный lossless generic path поддерживает:
`system_prompt_mode=owner` + `owner_system_prompt` / `ownerSystemPrompt`.

Этот exact private owner prompt отделяется от обычных `messages` перед отправкой в Qwen, но текущий durable session record отдельно его не хранит. Поэтому последовательность:

`explicit owner prompt -> accepted response -> process restart -> short continue without resending prompt`

может ослабить authority после restart.

### Единственный актуальный кандидат

`autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABILITY_V2_20260822.patch`

Канонический pointer/краткий контракт:
`autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABLE_SESSION_SPEC_20260821.md`

V1 удалён и не использовать.

V2 уже включает более простой message-system pre-provider gate, поэтому `QWEN_CORE_SYSTEM_CHECKPOINT_PREFLIGHT_20260821.patch` отдельно второй раз НЕ накладывать, если применён V2.

### Целевой контракт V2

- durable record отдельно хранит `systemPromptMode` и exact `ownerSystemPrompt`;
- short continuation без новой authority наследует durable mode/prompt;
- явный `owner` mode без повторной передачи текста тоже наследует сохранённый exact owner text;
- новый explicit owner field или новый incoming system authority побеждает stale durable owner;
- явный `engineer` не resurrect-ит старый owner prompt и очищает его при успешном durable commit;
- explicit owner prompt не синтезируется в generic `role=system`, поэтому не смешивается с OpenCode MCP/project rules;
- oversized explicit owner authority => `QWEN_SYSTEM_CHECKPOINT_REJECTED` до request governor / Qwen I/O;
- одна prompt metadata используется во всех пяти persistence paths: primary non-stream, non-stream retry, streaming tool checkpoint, streaming assistant-text checkpoint, final streaming persistence;
- message-based system checkpoint тоже preflight-ится до provider traffic.

### Обязательные targeted checks после применения

Сначала применить V2 на свежие exact blobs, затем:

`node scripts/session-explicit-owner-authority-test.js`
`node scripts/server-explicit-owner-rehydrate-test.js`
`node scripts/server-system-checkpoint-rejected-test.js`
`node --check server.js`
`node --check src/session-store.js`

Ожидаемые ключевые свойства:
- `restart_continue=1`
- `owner_flag_inherits=1`
- `current_authority_wins=1`
- `oversized_provider_calls=0`
- restart exact owner prompt byte-for-byte;
- engineer transition clears stale owner authority.

После targeted PASS подключить два новых V2 regressions в свежий exact `npm test` отдельной минимальной правкой и прогнать ближайший session/restart cluster:
- `session-owner-system-checkpoint-test.js`
- `session-recovery-system-preservation-test.js`
- `session-store-restart-test.js`
- `session-stale-backup-recovery-test.js`
- `session-checkpoint-system-retention-test.js`
- `session-tool-result-progress-test.js`
- новые explicit-owner regressions.

## Постоянная память

Последняя нормативная Core capsule до helper-прохода:
- capsule `20260821T210110Z-1c313d18a6`;
- source_ref `26d82a88ecaa18733d590c50b2a130480273be97`;
- archive SHA-256 `88901b922862e33b4880ce780b12dc59a8cdc4ad1fc5e081a1816d3f2362b5d3`.

Она была verify/restore PASS нормативным `capsule_runtime_v4.py`; LATEST опубликован через CAS. Helper-коммиты после source_ref существуют в общей PR-линии, поэтому capsule — recovery checkpoint, а не текущий product head.

## После explicit-owner gate

1. Если exact private tree доступен — прогнать session/restart cluster и затем полный `npm test`.
2. Не тратить циклы на comment-only восстановление `server.js`, пока нет функционального нарушения.
3. Если suite green — переходить к финальным restart/recovery/failover/live E2E gates, а не продолжать бесконечный поиск косметики.
4. Live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare не запускать без отдельной необходимости/разрешённого режима.

## Граница доказанного

Full exact-tree `npm test` на текущем общем PR head пока НЕ заявлен. Hosted targeted semantics не равны финальному E2E. Не повышать статус до DONE до цельного regression + требуемых restart/live gates.