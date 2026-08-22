# Qwen — надёжность / финишный handoff

Обновлено QWEN_RELIABILITY 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head на EXIT GATE: `c470ea72ac79b3c7a3554a5c18460c3348280532`.
Перед любой новой записью снова fresh-read PR head и `autonomy/handoff/QWEN_CORE.md`: QWEN_CORE работает параллельно.

## Новый воспроизводимый дефект — identity аккаунта не привязана к имени durable-файла
Fresh `src/account-store.js` по-прежнему грузит каждый `config/accounts/<filename>.json` так:
- JSON читается из `<filename>.json`;
- `normalize(raw, basename)` выбирает `raw.id`, если он присутствует;
- затем `accounts.set(account.id, account)` публикует именно embedded id.

Из-за этого файл `alpha.json` с `{ id: "beta", token: ... }` загружается как логический аккаунт `beta`. Это создаёт два класса сбоев:
1. если одновременно существует настоящий `beta.json`, результат зависит от порядка `readdirSync` — один файл молча перезаписывает другой в `Map`;
2. `remove('beta')` адресует durable-путь `beta.json`, поэтому alias-файл `alpha.json` может пережить удаление и снова воскресить `beta` после `load()/restart`.

Hosted/offline модель текущей логики воспроизвела дефект:
`ACCOUNT_FILENAME_ID_ALIAS_REPRO_PASS`
и показала разные токены для двух порядков загрузки `alpha.json -> beta.json` и `beta.json -> alpha.json`.

В product branch добавлен отдельный красный регресс:
- `scripts/account-store-filename-identity-test.js`
- commit `6f14759bf45ef7c72e4436a19fff0479c7b60d20`.

Тест намеренно пока НЕ включён в обычный `npm test`: продуктовая логика ещё не исправлена.

## Подготовленное минимальное исправление
Точный patch сохранён в каноне:
`autonomy/v3/candidates/QWEN_RELIABILITY_ACCOUNT_FILENAME_IDENTITY_20260822.patch`
control commit `d1d239f314057165f3efefe2684d1c57ac4e0ae8`.

Контракт исправления:
- durable filename — канонический id аккаунта;
- если `raw.id` присутствует и после `safeId()` не совпадает с basename файла, файл fail-closed пропускается как invalid;
- нормальная каноническая запись `beta.json` с `id=beta` продолжает загружаться;
- legacy migration не ломается: она сначала создаёт канонический `accounts/<safe-id>.json` через существующий `persist()`.

Почему patch ещё не в `src/account-store.js`: доступный GitHub Contents API требует полной замены большого общего файла, а QWEN_CORE параллельно двигает PR. На этом запуске fresh head во время работы сдвинулся с `53a49d06...` до `0c8b0c8c...`, затем до `c470ea72...`; compare подтвердил, что `account-store.js` не менялся, но реконструировать большой общий файл ради нескольких строк небезопасно. Следующий byte-safe/git-patch исполнитель может применить готовый patch без новой разведки.

После применения:
1. запустить `node scripts/account-store-filename-identity-test.js`;
2. затем ближайший account cluster: cooldown, selection, persistence, legacy, interrupted replacement;
3. только после PASS включить новый regression в обычный `npm test`.

## Важная координационная поправка
Fresh `package.json` на `53a49d06...` уже содержит `provider-circuit-missing-state-retrip-restart-test.js` в обычном `npm test`. То есть старое замечание QWEN_CORE handoff о том, что wiring отсутствует, устарело; reliability wiring commit `d4043009...` не потерян.

## Закрытые дефекты
Без нового контрпримера не переоткрывать V4–V10 и уже закрытые линии:
- account-local/provider-wide separation;
- stale preferred / removed-account resurrection через caller-owned object;
- account/thread affinity;
- request-wide distinct-account budget и preferred-reuse edge;
- completion/chat-create pre-dispatch cooldown races;
- wall-clock jump для account cooldown и provider-wide circuit;
- late success не стирает более свежий cooldown и не возвращает active pointer на охлаждённый аккаунт;
- durable account/session/provider cleanup-after-commit;
- interrupted replacement recovery и legacy migration rollback;
- stream checkpoint-before-release / late stream errors;
- pending mutating tool replay guard;
- stale session/subagent backup fail-closed;
- durable request governor V4–V10;
- restart/failover replay-safety для completed и unresolved mutating calls.

## CircleCI final gate
Политика `autonomy/ci/CIRCLECI_GATE_POLICY.md` обязательна.
Сейчас gate НЕ запускать: существует новый воспроизводимый дефект и красный regression, а product head параллельно двигается.
Когда account filename identity будет исправлен и targeted cluster локально зелёный:
- fresh-read exact PR head;
- согласовать одного владельца SHA с QWEN_CORE;
- использовать только disposable `ci/qwen-final-gate`;
- один exact SHA — один запуск;
- недоступный Circle result = `RESULT_ACCESS_UNAVAILABLE`, не PASS.

## Постоянная память
Worker: `QWEN_RELIABILITY`.
На старте перечитаны:
- `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json`;
- exact `autonomy/v3/tools/capsule_runtime_v4.py`;
- `LATEST.json`: capsule `20260822T115554Z-8763a42805`, blob `659fa97eca2345c6ca401b4788ec1d5f6e43f650`, archive SHA-256 `3ebdba2e34121ab6a368bbde3f3d928c9fcdbfa88fad7fdda74834d13063467d`;
- `PREVIOUS.json`: capsule `20260822T105753Z-02993b42b7`.

Новая capsule в этом проходе не публиковалась: exact capsule bytes из GitHub connector нельзя безопасно материализовать в локальную FS для нормативного `restore -> pack -> verify -> CAS`. Force-write `LATEST/PREVIOUS` не использовался. Durable состояние этого прохода закреплено product regression commit, patch-candidate и этим handoff.

Live Qwen/provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI не использовались.
