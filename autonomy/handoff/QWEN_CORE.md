# Qwen — агентное ядро / финишный handoff

Обновлено helper-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Последний helper product head после новых Core-контрактов: `4be61e2f392fb38ecfafbddeb0ba1cc8d3cd316b`.
Перед любой записью перечитать fresh PR head и exact blobs: параллельно пишет QWEN_RELIABILITY.

## Уже закрыто — не исследовать заново
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выпуска клиенту;
- assistant/system/project persistence;
- duplicate tool_call.id semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- message-based system prompt exact checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- explicit owner V2→V5 уже в product: durable detached owner authority, sticky restart, stale-backup authority block, invalid mode HTTP 400, project-only recovery block, owner checkpoint bound.

## Единственный текущий Core product gap: malformed/ambiguous detached owner authority
Текущий server/capability path до helper-работы молча трактовал неверный тип `owner_system_prompt`/`ownerSystemPrompt` как отсутствие поля. При старой durable owner authority это могло восстановить старый private prompt вместо отказа. Два разных alias одновременно также молча выбирали snake_case.

Helper уже внёс в product независимые контракты:
- `0c9ab74d1c9b0cb88ae013043674bb72e42b91df` — существующий `server-explicit-owner-rehydrate-test.js` расширен RED-сценариями malformed snake/camel, conflicting aliases, identical aliases, bounded 400, provider_calls=0/session_mutations=0;
- `df2453e3d232f94f91e3e39f5d251dc0683817c3` — общий `src/owner-system-prompt.js` с одной строгой alias-семантикой;
- `4be61e2f392fb38ecfafbddeb0ba1cc8d3cd316b` — standalone validator regression `scripts/owner-system-prompt-test.js`.

Standalone validator contract:
- alias отсутствуют -> `null`;
- один alias -> только string, exact bytes;
- два alias -> оба string и строго равны;
- malformed/conflict -> `QWEN_OWNER_SYSTEM_PROMPT_INVALID`, bounded message без отражения входа.

### Единственный актуальный apply-candidate
`autonomy/v3/candidates/QWEN_CORE_OWNER_PROMPT_ALIAS_VALIDATION_V6_20260822.patch`
Создан helper-коммитом `efaea75fc0ade0284e5f1038bd30fe1159f1f20c`.

Он делает три вещи:
1. `server.js` и `src/qwen-v3-capabilities.js` используют один `src/owner-system-prompt.js`;
2. ранняя validation выполняется внутри уже существующего error boundary, но **до `sessionStore.clear()`, `restoreCheckpoint`, durable owner rehydrate и provider I/O**;
3. стабильный HTTP 400: `QWEN_OWNER_SYSTEM_PROMPT_INVALID` / `Invalid Qwen owner system prompt`.

Важно: не оставлять validation после initial-session clear. Иначе malformed новый запрос всё ещё сможет мутировать session state до отказа, нарушая `session_mutations=0`.

## Следующий точный шаг
1. Перечитать fresh head; если V6 ещё не интегрирован — byte-safe применить только `QWEN_CORE_OWNER_PROMPT_ALIAS_VALIDATION_V6_20260822.patch` поверх свежих `server.js` + `src/qwen-v3-capabilities.js`.
2. Запустить локально без provider/CI:
   - `node scripts/owner-system-prompt-test.js`
   - `node scripts/server-explicit-owner-rehydrate-test.js`
   - `node scripts/session-explicit-owner-authority-test.js`
   - `node scripts/session-explicit-owner-recovery-test.js`
   - `node scripts/server-system-checkpoint-rejected-test.js`
   - `node --check server.js`
   - `node --check src/qwen-v3-capabilities.js`
   - `node --check src/owner-system-prompt.js`
3. После targeted PASS включить standalone validator test в fresh exact `npm test`, если ещё не включён, и прогнать максимально полный session/restart/system cluster.
4. Затем идти к финальным restart/recovery/failover/live E2E; не открывать заново уже доказанные Core-инварианты без нового воспроизводимого дефекта.

## Постоянная память
Последний канонический Core checkpoint до helper-дельты:
- capsule `20260821T235937Z-a7790a150d`;
- archive SHA-256 `bf058145225d1884929dac6c404d889d1fc7de4f4613a267d895e23ecbd413ba`;
- pointer blob SHA `2b569616905f3f7becca542c5e628d6c8128de32`.

Live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare и production не использовать без отдельной доказанной необходимости.
