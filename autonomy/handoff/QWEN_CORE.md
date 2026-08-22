# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Свежий Core product head после V6-интеграции: `d58a7aa6ed7e5c8fd1b50e78d50ad4fb11af7439`.
Перед следующей записью перечитать fresh PR head и exact blobs: параллельно пишет QWEN_RELIABILITY.

## Уже закрыто — не исследовать заново
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выпуска клиенту;
- assistant/system/project persistence;
- duplicate tool_call.id semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- message-based system prompt exact checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- explicit owner V2→V5: durable detached owner authority, sticky restart, stale-backup authority block, invalid mode HTTP 400, project-only recovery block, owner checkpoint bound;
- malformed/ambiguous detached owner authority V6 теперь интегрирован в product.

## V6 — сделано в этом проходе
До исправления `server.js` и V3 capability path трактовали неверный тип `owner_system_prompt`/`ownerSystemPrompt` как отсутствие поля; при durable owner state это могло восстановить старый private prompt. Два конфликтующих alias также могли молча выбрать snake_case.

Существующие helper-контракты уже были в product:
- `0c9ab74d1c9b0cb88ae013043674bb72e42b91df` — `server-explicit-owner-rehydrate-test.js` содержит malformed/conflict RED-сценарии;
- `df2453e3d232f94f91e3e39f5d251dc0683817c3` — строгий общий `src/owner-system-prompt.js`;
- `4be61e2f392fb38ecfafbddeb0ba1cc8d3cd316b` — standalone validator regression.

В этом проходе:
- `23ccc34400a1246be3ef6df63e6799fe22c9639d` — `src/qwen-v3-capabilities.js` переведён на общий строгий validator; diff строго +require / -старый локальный helper;
- `d58a7aa6ed7e5c8fd1b50e78d50ad4fb11af7439` — `server.js` переведён на тот же validator; validation выполняется внутри error boundary, но до initial-session `clear`, restore, durable rehydrate и provider I/O; добавлен стабильный HTTP 400 `QWEN_OWNER_SYSTEM_PROMPT_INVALID`.

Проверено на ChatGPT hosted машине без provider/CI:
- точные Git blobs `src/owner-system-prompt.js` = `2b4266f4700410bb97a2b40f83a29c6ad4d833c1` и `scripts/owner-system-prompt-test.js` = `7233fd3c5af419cc8bb569b358485319eb9b9cad` материализованы локально;
- `node scripts/owner-system-prompt-test.js` -> `OWNER_SYSTEM_PROMPT_VALIDATION_PASS malformed=1 alias_conflict=1 identical_alias=1 bounded_error=1`;
- diff `23ccc344… -> d58a7aa6…` затрагивает только `server.js`, 21 additions / 12 deletions. Функциональные hunks соответствуют V6. Есть один побочный comment-only mojibake diff в старом верхнем комментарии; функциональный код не затронут. Не делать ещё одну замену большого `server.js` только ради косметики без byte-safe способа.

Полный `server-explicit-owner-rehydrate-test.js` и полный `npm test` на exact tree в этом проходе не запускались: exact private tree целиком на hosted машину не материализован. Не объявлять весь PR зелёным по одному targeted PASS.

## Следующий точный шаг
1. Перечитать fresh PR head и убедиться, что `d58a7aa6…` остаётся предком текущей линии и V6 не вытеснен параллельным writer.
2. На hosted машине материализовать максимально полный exact owner/session cluster и выполнить минимум:
   - `node scripts/server-explicit-owner-rehydrate-test.js`
   - `node scripts/session-explicit-owner-authority-test.js`
   - `node scripts/session-explicit-owner-recovery-test.js`
   - `node scripts/server-system-checkpoint-rejected-test.js`
   - `node --check server.js`
   - `node --check src/qwen-v3-capabilities.js`
   - `node --check src/owner-system-prompt.js`
3. Если targeted cluster green — переходить к следующему воспроизводимому Core-дефекту в restart/tool-result/OpenCode/subagents/skills. Не открывать заново уже доказанные инварианты без нового воспроизведения.
4. Финальный большой рубеж остаётся прежним: после офлайн exact-tree проверки — один доказанный live многошаговый `read_file → tool result → следующий Qwen turn → bash → tool result → final`, затем restart/failover; старые provider-прогоны не дублировать.

## Постоянная память
Старт этого прохода:
- LATEST blob SHA: `2b569616905f3f7becca542c5e628d6c8128de32`;
- capsule `20260821T235937Z-a7790a150d`;
- archive SHA-256 `bf058145225d1884929dac6c404d889d1fc7de4f4613a267d895e23ecbd413ba`;
- exact `capsule_runtime_v4.py` Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- exact v4 verify + restore: PASS.

После существенной работы нужен новый v4 checkpoint с CAS по стартовому LATEST blob SHA. Live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare и production не использовать без отдельной доказанной необходимости.
