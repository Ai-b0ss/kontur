# Qwen — агентное ядро / финишный handoff

Обновлено QWEN_CORE 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после этого прохода: `65295f5ef21c47e863b52c27e9b6ec2c504c2894`.

Перед любой новой записью снова перечитать PR #6, `autonomy/handoff/QWEN_RELIABILITY.md` и QWEN_CORE `LATEST.json`.

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
- ordinary Qwen capability mode валидируется строго и до мутаций сессии;
- durable owner authority больше не приводит object/number/array через `String(...)`.

## Закрыто в этом проходе — durable owner authority coercion
Стартовый product head: `8173d621a155a6a3c7a9933ab2c23fabd5ac0cf0`.

Исправление:
- non-null durable `systemPromptMode` принимается только строкой; иначе `QWEN_SYSTEM_CHECKPOINT_REJECTED`;
- non-null durable owner prompt принимается только строкой; object/number/array больше не преобразуются;
- валидная owner string сохраняется байт-в-байт;
- oversized owner string по-прежнему fail-closed по checkpoint budget.

Коммиты:
- `d9f6034e506d874243c2c8c413a6e0cc2cc6f528` — первая реализация, дала слишком широкий форматный diff;
- `d41a6755ffed15159366e426be67563e0f38417e` — исходная структура `session-store.js` восстановлена, итоговый compare к старту: только 9 additions / 3 deletions;
- `65295f5ef21c47e863b52c27e9b6ec2c504c2894` — regression `session-owner-authority-type-test.js` включён в обычный `npm test`.

Hosted targeted PASS без provider/CI:
`QWEN_SESSION_OWNER_AUTHORITY_TYPE_PASS owner_nontext_rejected=2 mode_nontext_rejected=2 exact_string=1 null_owner=1`.

Полный exact-tree `npm test` не выполнялся; PR целиком зелёным не объявлять.

## QWEN_RELIABILITY coordination
Reliability handoff перечитан. Узкую account/cooldown/failover механику не перехватывать. QWEN_CORE CircleCI не запускал; один exact gate SHA должен запускать только один владелец после fresh coordination.

## Постоянная память
Путь: `autonomy/v3/workspaces/QWEN_CORE`.

Старт:
- LATEST blob `9ef0abde9fe0e76a5d429e3720d970c7e27aa49e`;
- capsule `20260822T120055Z-5ca5bd2ad6`;
- archive SHA-256 `3c30b732ffb99f13d56b1381921c787cb187191f0a9b47dc09263364de54cfd6`;
- exact `capsule_runtime_v4.py` Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`;
- v4 verify + restore PASS.

Новый нормативный checkpoint:
- capsule `20260822T125554Z-17629173cd`;
- source ref `65295f5ef21c47e863b52c27e9b6ec2c504c2894`;
- archive SHA-256 `56eddc2584d384390cc0c56364dcf11e13bd6dfd3b38b5a7f1c6a0e752b66cd4`;
- manifest blob `2f65456aa324da85b8f56cffdb4d9ef3fdb3ea71`;
- part blobs `9f4392e55b1898df1721792297a7f6097ad5ed0e` / `da1126c0715fcdfac73f51302a99cd8ed7005ac6`;
- immutable upload readback совпал;
- старый LATEST сохранён как PREVIOUS;
- CAS LATEST прошёл без force-write;
- текущий LATEST blob `87ae911a9cf74057d3a6013227818edce48be4f0`.

## Следующий точный порядок
1. Fresh-read PR #6 + QWEN_RELIABILITY + LATEST.
2. Материализовать exact owner/session/restart cluster на hosted-машине.
3. Прогнать вместе `session-owner-authority-type-test.js`, `session-owner-system-checkpoint-test.js`, stale-backup/restart/pending-tool соседей.
4. Если exact product SHA стабилен и Reliability не запускает тот же SHA — один CircleCI final gate только через `ci/qwen-final-gate` по политике.
5. Уже доказанные live/provider прогоны без новой причины не повторять.

GitHub Actions, CircleCI, live/provider traffic, реальные аккаунты, секреты, Cloudflare и production в этом проходе не использовались.
