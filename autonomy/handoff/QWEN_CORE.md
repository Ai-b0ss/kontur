# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh observed product head после Core-прохода: `92277b8beb7a8a3f698571678bada7451baa9f81`.
Перед новой записью снова перечитать fresh PR head и `autonomy/handoff/QWEN_RELIABILITY.md`: reliability-worker работает параллельно.

## Уже закрыто — не открывать заново без нового воспроизведения
- tool-result continuation/restart + pending-tool replay guard;
- streaming tool checkpoint до выдачи клиенту;
- assistant/system/project persistence;
- duplicate `tool_call.id` semantics;
- per-session serialization;
- stale-backup recovery fail-closed;
- message-based system prompt exact checkpoint + `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- local checkpoint failure не штрафует provider account;
- explicit owner V2→V6 и строгая ранняя валидация system-prompt mode/owner aliases;
- direct agent и coding-subagents принимают owner prompt только как непустую строку без преобразования;
- мягкие ошибки локальных инструментов используют `Error:`-контракт;
- обязательные аргументы инструментов валидируются перед handler;
- обычный Qwen capability mode теперь тоже валидируется строго и до мутаций сессии.

## Закрыто в этом проходе — Qwen capability mode
Старый `src/qwen-v3-mode.js` молча принимал неоднозначные aliases: неизвестный explicit mode мог уйти в fallback, пустой snake-case маскировался camel-case, а конфликт `fast`/`thinking` выбирал первое значение.

Исправлено атомарно:
1. `090ced48c44480fbd72583e4dfac8640ceecec12` — strict presence-aware alias validation в `src/qwen-v3-mode.js`;
2. `207cb02262e24661265ccf6de2540910f2848347` — тот же resolver экспортирован через capability layer для server preflight;
3. `712fff689f72b58927f2d9cedf4bf6e7c6745ae3` — `server.js` проверяет Qwen mode до `sessionStore.clear`, `toolMemo.clear`, checkpoint recovery и первого provider call; `QWEN_MODE_INVALID` получает HTTP 400 / `invalid_request_error`;
4. `763ac0b53a7ea94bc8241e3e539b2356b08c9984` + `92277b8beb7a8a3f698571678bada7451baa9f81` — постоянный server regression, изолированный от тяжёлого capability import;
5. `9bbfd30066fa8a59afa2741b786a99087830675c` — оба mode-regression подключены в обычный `npm test`.

Fresh exact blobs:
- `src/qwen-v3-mode.js` = `58e1237e3ddab6143de968892692e2bc0e6b9b86`;
- `server.js` = `a8365a3d7b8c1bb4314ce6b84c677958b6881508`;
- `package.json` = `cb7ec6546dce27592d1c3b750cce10686f9e1436`;
- `scripts/server-qwen-mode-preflight-test.js` = `eb6e4b7c79078723e5c6bdaad33cec858dda7a8e`.

Hosted targeted PASS без provider/CI:
- `QWEN_MODE_ALIAS_VALIDATION_PASS ...`;
- `QWEN_SERVER_MODE_PREFLIGHT_TARGET_PASS mutation_order=1 http400=1 stable_code=1`;
- exact owner helper по-прежнему: `OWNER_SYSTEM_PROMPT_VALIDATION_PASS ...`.

Полный exact-tree `npm test` не выполнялся; весь PR зелёным не объявлять.

## Следующий Core-кандидат — сначала воспроизвести
Fresh `src/session-store.js` blob на head `92277b8...`: `ffc983610235b6618f4d2500647261579d945380`.
`checkpointOwnerAuthority()` сейчас для non-null owner authority делает `String(ownerSystemPrompt)`. Поэтому потенциально повреждённое долговечное значение нестрокового типа (`{}`/число) может превратиться в `[object Object]`/`42` вместо fail-closed.

Это пока не объявлено закрытым дефектом. Следующий проход:
1. exact hosted reproduction на текущем `session-store`;
2. если подтверждено — non-string durable owner authority отклонять через локальный `QWEN_SYSTEM_CHECKPOINT_REJECTED`, не переписывая значение;
3. добавить/расширить session-owner checkpoint regression;
4. затем собрать exact owner/session/subagent/restart cluster и прогнать targeted suite.

## QWEN_RELIABILITY coordination
В начале прохода fresh reliability handoff прочитан. Узкую account/cooldown/failover механику не перехватывать. QWEN_CORE не запускал CircleCI и не должен триггерить final gate на SHA, который одновременно берёт Reliability.

## Постоянная память
Путь worker memory: `autonomy/v3/workspaces/QWEN_CORE`.

Стартовый pointer этого прохода:
- `LATEST.json` blob `68b89ae010c52078f8b1c73eb6729e36faf580ef`;
- capsule `20260822T094914Z-2250bd0200`;
- archive SHA-256 `30691094bb941c839e1ab23780c0d4b7a14476494163acc3d9b0499d5431b088`;
- exact `capsule_runtime_v4.py` локально материализован: 8079 bytes, Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- входная capsule: v4 verify + restore PASS.

Новый нормативный v4 checkpoint:
- capsule `20260822T120055Z-5ca5bd2ad6`;
- archive SHA-256 `3c30b732ffb99f13d56b1381921c787cb187191f0a9b47dc09263364de54cfd6`;
- manifest blob `bd3c775e98a36d46f9602271a5cab9a86cd5884c`;
- part blobs `6525abdd24cfc4ad85ad7eba0736822000347dde` / `c01766bba414fb6e12f4642744ddc27cca18e5c2`;
- local v4 pack -> verify -> restore PASS;
- immutable GitHub upload перечитан: blobs совпали;
- старый LATEST сохранён как PREVIOUS;
- LATEST перечитан перед записью и всё ещё имел исходный blob `68b89ae...`;
- CAS LATEST прошёл без force-write, новый pointer blob `9ef0abde9fe0e76a5d429e3720d970c7e27aa49e`.

## Следующий точный порядок
1. Fresh-read PR #6 + QWEN_RELIABILITY + LATEST.
2. Reproduce durable owner-authority type corruption на exact `session-store`.
3. При подтверждении — минимальный fail-closed fix + hosted targeted regression.
4. Материализовать exact owner/session/subagent/restart cluster и прогнать локально.
5. Только когда Core и Reliability targeted-гейты зелёные и exact product SHA стабилен, согласовать единственного владельца disposable `ci/qwen-final-gate`.
6. Уже доказанные live/provider прогоны без новой причины не повторять.

GitHub Actions, CircleCI, live/provider traffic, аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
