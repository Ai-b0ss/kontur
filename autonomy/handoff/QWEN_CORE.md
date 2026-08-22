# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Core V6 commit: `d58a7aa6ed7e5c8fd1b50e78d50ad4fb11af7439`.
Последний проверенный общий PR head: `f0b889804fbdd86c4ea1bf0cee5cc85d680194a2`.
`compare d58a7aa6… → f0b88980…` = ровно один commit вперёд, изменён только `src/request-governor.js`; V6 остаётся предком текущей линии и параллельным QWEN_RELIABILITY не вытеснен.
Перед следующей записью снова перечитать fresh PR head и exact blobs.

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
- `23ccc34400a1246be3ef6df63e6799fe22c9639d` — `src/qwen-v3-capabilities.js` переведён на общий строгий validator;
- `d58a7aa6ed7e5c8fd1b50e78d50ad4fb11af7439` — `server.js` переведён на тот же validator; validation выполняется внутри error boundary, но до initial-session `clear`, restore, durable rehydrate и provider I/O; добавлен стабильный HTTP 400 `QWEN_OWNER_SYSTEM_PROMPT_INVALID`.

Проверено на ChatGPT hosted машине без provider/CI:
- exact `src/owner-system-prompt.js` blob `2b4266f4700410bb97a2b40f83a29c6ad4d833c1`;
- exact `scripts/owner-system-prompt-test.js` blob `7233fd3c5af419cc8bb569b358485319eb9b9cad`;
- `node scripts/owner-system-prompt-test.js` -> `OWNER_SYSTEM_PROMPT_VALIDATION_PASS malformed=1 alias_conflict=1 identical_alias=1 bounded_error=1`;
- diff `23ccc344… -> d58a7aa6…` затрагивает только `server.js`, 21 additions / 12 deletions. Функциональные hunks соответствуют V6. Есть один побочный comment-only mojibake diff в старом верхнем комментарии; функциональный код не затронут. Не переписывать большой `server.js` только ради этой косметики без byte-safe способа.

Полный `server-explicit-owner-rehydrate-test.js` и полный `npm test` на exact tree в этом проходе не запускались: exact private tree целиком на hosted машину не материализован. Не объявлять весь PR зелёным по одному targeted PASS.

## Следующий точный шаг
1. Перечитать fresh PR head и подтвердить, что `d58a7aa6…` остаётся предком текущей линии.
2. На hosted машине материализовать максимально полный exact owner/session cluster и выполнить минимум:
   - `node scripts/server-explicit-owner-rehydrate-test.js`
   - `node scripts/session-explicit-owner-authority-test.js`
   - `node scripts/session-explicit-owner-recovery-test.js`
   - `node scripts/server-system-checkpoint-rejected-test.js`
   - `node --check server.js`
   - `node --check src/qwen-v3-capabilities.js`
   - `node --check src/owner-system-prompt.js`
3. Если cluster green — переходить к следующему воспроизводимому Core-дефекту в restart/tool-result/OpenCode/subagents/skills. Не открывать заново уже доказанные инварианты без нового воспроизведения.
4. Финальный большой рубеж: после офлайн exact-tree проверки — один доказанный live многошаговый `read_file → tool result → следующий Qwen turn → bash → tool result → final`, затем restart/failover; старые provider-прогоны не дублировать.

## Постоянная память
Старт этого прохода:
- LATEST blob SHA `2b569616905f3f7becca542c5e628d6c8128de32`;
- capsule `20260821T235937Z-a7790a150d`;
- archive SHA-256 `bf058145225d1884929dac6c404d889d1fc7de4f4613a267d895e23ecbd413ba`;
- exact `capsule_runtime_v4.py` blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- exact v4 verify + restore: PASS.

После работы опубликован новый нормативный v4 checkpoint:
- capsule `20260822T005305Z-0f5e9b4388`;
- archive SHA-256 `61ba2e546e9748827ad41c4ff0ee6d64c25946e9398e5119a3e2fd625b98f4ef`;
- 2 parts; uploaded part Git blobs `8ff944193bf2d79e6506f91963b1d716dfbe610a` и `5a63e7cf315017aa39ee4ece3784a00652150be3` точно совпали с локальными `git hash-object`;
- manifest Git blob `c48a370a4a500374bd22005e7a39044dad719bdb` точно совпал с локальным;
- exact v4 verify после упаковки: PASS;
- перед CAS LATEST всё ещё имел исходный blob `2b569616…`, поэтому старый LATEST сохранён как PREVIOUS, новый опубликован без force-write;
- текущий LATEST blob `a19e0ff35d548058c9fac980dc70bb6e1b8582ea` и указывает на новую capsule.

Live Qwen/provider traffic, GitHub Actions/CircleCI/Cloudflare и production не использовались.
