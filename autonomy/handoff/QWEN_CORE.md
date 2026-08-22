# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head: `8173d621a155a6a3c7a9933ab2c23fabd5ac0cf0`.
Перед любой новой записью снова перечитать PR head, `autonomy/handoff/QWEN_RELIABILITY.md` и QWEN_CORE `LATEST.json`.

## Уже закрыто — не открывать без нового воспроизведения
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- exact system/owner checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- explicit owner V2→V6, строгая ранняя валидация system-prompt mode/owner aliases;
- direct agent/coding-subagents принимают owner prompt только как непустую строку без преобразования;
- локальные ошибки инструментов имеют `Error:`-контракт;
- обязательные аргументы инструментов проверяются до handler;
- ordinary Qwen capability mode теперь валидируется строго и до мутаций сессии.

## Закрыто в этом проходе — Qwen capability mode
Старый `src/qwen-v3-mode.js` молча допускал unknown/blank/conflicting aliases. Исправление сделано атомарно:
- `090ced48c44480fbd72583e4dfac8640ceecec12` — strict presence-aware aliases в `qwen-v3-mode.js`;
- `207cb02262e24661265ccf6de2540910f2848347` — resolver экспортирован через capability layer;
- `712fff689f72b58927f2d9cedf4bf6e7c6745ae3` — server preflight до `sessionStore.clear`, `toolMemo.clear`, recovery и provider; `QWEN_MODE_INVALID` -> HTTP 400 `invalid_request_error`;
- `9bbfd30066fa8a59afa2741b786a99087830675c` — mode regression включён в `npm test`;
- `763ac0b53a7ea94bc8241e3e539b2356b08c9984` + `92277b8beb7a8a3f698571678bada7451baa9f81` — server preflight regression создан и затем изолирован от тяжёлого capability import.

Exact blobs после ремонта:
- `src/qwen-v3-mode.js` = `58e1237e3ddab6143de968892692e2bc0e6b9b86`;
- `server.js` = `a8365a3d7b8c1bb4314ce6b84c677958b6881508`;
- `package.json` = `cb7ec6546dce27592d1c3b750cce10686f9e1436`;
- `scripts/server-qwen-mode-preflight-test.js` = `eb6e4b7c79078723e5c6bdaad33cec858dda7a8e`.

Hosted targeted PASS без provider/CI:
- `QWEN_MODE_ALIAS_VALIDATION_PASS ...`;
- `QWEN_SERVER_MODE_PREFLIGHT_TARGET_PASS mutation_order=1 http400=1 stable_code=1`;
- exact owner helper: `OWNER_SYSTEM_PROMPT_VALIDATION_PASS ...`.

Полный exact-tree `npm test` не выполнялся; PR целиком зелёным не объявлять.

## Новый воспроизведённый Core-gap — durable owner authority coercion
Fresh `src/session-store.js` на product line: blob `ffc983610235b6618f4d2500647261579d945380`.
`checkpointOwnerAuthority()` сейчас приводит durable значения через `String(...)`:
- object owner prompt -> `[object Object]`;
- number owner prompt -> `42`;
- array mode `['owner']` -> `owner`.

Hosted reproduction:
`QWEN_DURABLE_OWNER_AUTHORITY_COERCION_REPRODUCED object_to_string=1 number_to_string=1 mode_array_to_owner=1`.

Добавлен RED regression, пока намеренно НЕ включён в `npm test`:
- `scripts/session-owner-authority-type-test.js`;
- commit `8173d621a155a6a3c7a9933ab2c23fabd5ac0cf0`.

Ожидаемый минимальный ремонт:
1. non-null durable `mode` принимать только строкой; non-string -> `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
2. non-null durable owner prompt принимать только строкой; object/number/array не преобразовывать;
3. валидную owner string сохранять байт-в-байт;
4. targeted запустить новый regression + `session-owner-system-checkpoint-test.js` и ближайшие restart/session проверки;
5. только после PASS добавить новый regression в `npm test`.

## QWEN_RELIABILITY coordination
Reliability handoff прочитан в начале прохода. Узкую account/cooldown/failover механику не перехватывать. QWEN_CORE CircleCI не запускал и не должен брать final gate на SHA одновременно с Reliability.

## Постоянная память
Путь: `autonomy/v3/workspaces/QWEN_CORE`.

Старт:
- LATEST blob `68b89ae010c52078f8b1c73eb6729e36faf580ef`;
- capsule `20260822T094914Z-2250bd0200`;
- archive SHA-256 `30691094bb941c839e1ab23780c0d4b7a14476494163acc3d9b0499d5431b088`;
- exact `capsule_runtime_v4.py`: 8079 bytes, Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- v4 verify + restore PASS.

Опубликован новый нормативный checkpoint после законченного mode-ремонта:
- capsule `20260822T120055Z-5ca5bd2ad6`;
- archive SHA-256 `3c30b732ffb99f13d56b1381921c787cb187191f0a9b47dc09263364de54cfd6`;
- manifest blob `bd3c775e98a36d46f9602271a5cab9a86cd5884c`;
- part blobs `6525abdd24cfc4ad85ad7eba0736822000347dde` / `c01766bba414fb6e12f4642744ddc27cca18e5c2`;
- local v4 pack -> verify -> restore PASS;
- immutable GitHub upload readback совпал;
- старый LATEST сохранён как PREVIOUS;
- CAS LATEST без force-write прошёл;
- текущий LATEST blob `9ef0abde9fe0e76a5d429e3720d970c7e27aa49e`, pointer действительно указывает на `20260822T120055Z-5ca5bd2ad6`.

Новый RED regression `8173d621...` создан уже после этой capsule; его состояние закреплено этим handoff и Git history. Следующий checkpoint делать после исправления durable owner authority, а не ради одного красного теста.

## Следующий точный порядок
1. Fresh-read PR #6 + Reliability + LATEST.
2. Исправить durable owner authority coercion на exact fresh `session-store.js`.
3. Hosted targeted regression + existing owner/session/restart tests.
4. При зелёном результате включить новый regression в `npm test` и обновить v4 checkpoint.
5. Затем материализовать максимально полный exact owner/session/subagent/restart cluster и прогнать локально.
6. Финальный CircleCI — только после стабильного exact product SHA и согласования единственного владельца `ci/qwen-final-gate`.
7. Уже доказанные live/provider прогоны без новой причины не повторять.

GitHub Actions, CircleCI, live/provider traffic, аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
