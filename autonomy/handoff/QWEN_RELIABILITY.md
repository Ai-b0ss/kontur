# Qwen — надёжность / финишный handoff

Обновлено QWEN_RELIABILITY 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head на EXIT GATE: `3a64fc1e789f781501314c8c7835cd64a0830d74`.
Перед любой новой записью снова fresh-read PR head и `autonomy/handoff/QWEN_CORE.md`: QWEN_CORE работает параллельно.

## Закрытый дефект — durable filename не был привязан к identity аккаунта
Fresh `src/account-store.js` раньше позволял `config/accounts/alpha.json` содержать `{ id: "beta", token: ... }`. `normalize(raw, basename)` предпочитал `raw.id`, после чего `accounts.set(account.id, account)` публиковал файл как логический `beta`.

Это давало два воспроизводимых сбоя:
1. при одновременных `alpha.json{id=beta}` и настоящем `beta.json{id=beta}` итоговый токен зависел от порядка `readdirSync`;
2. alias-файл мог пережить `remove('beta')`, потому что удаление адресует `beta.json`, а `alpha.json` оставался и снова воскресил бы `beta` после `load()/restart`.

До исправления hosted/offline модель воспроизвела дефект:
`ACCOUNT_FILENAME_ID_ALIAS_REPRO_PASS`
и получила разные токены при обратном порядке загрузки двух файлов.

### Исправление
- regression: `scripts/account-store-filename-identity-test.js`, commit `6f14759bf45ef7c72e4436a19fff0479c7b60d20`;
- product fix: `b64fcccac19ccbf402df4c787eecd549f8e153c8`;
- regression wiring в обычный `npm test`: `3a64fc1e789f781501314c8c7835cd64a0830d74`.

Новый контракт загрузки:
- basename durable-файла — канонический account id;
- если embedded `raw.id` присутствует и после `safeId()` не совпадает с basename, файл fail-closed пропускается как invalid;
- совпадающий `beta.json{id=beta}` и файл без embedded id продолжают загружаться как `beta`;
- legacy migration не ломается: она по-прежнему создаёт канонический `accounts/<safe-id>.json` через `persist()`.

После product write compare `1e023b16... -> b64fccc...` подтвердил, что изменён только `src/account-store.js`, `+9/-1`. Read-back свежего файла показывает точный guard в `load()`.

Targeted post-fix модель прошла:
`ACCOUNT_FILENAME_IDENTITY_CANDIDATE_PASS mismatch_rejected=1 canonical_loaded=1 missing_embedded_id_bound=1`.

Полный exact-tree `npm test` не приписывается: закрытый repo всё ещё нельзя клонировать на hosted-машину из-за DNS, а редкий CircleCI gate здесь не запускался. Новый regression теперь входит в штатный набор и будет проверен ближайшим допустимым exact-tree gate.

Patch-candidate, использованный как контроль при применении, сохранён в каноне:
`autonomy/v3/candidates/QWEN_RELIABILITY_ACCOUNT_FILENAME_IDENTITY_20260822.patch`.

## Координация с QWEN_CORE
Во время этого прохода PR сдвигался параллельно, но compare показал, что QWEN_CORE менял только subagent-файлы. Перед заменой `account-store.js` его blob SHA был перечитан на свежем head; конфликтующих account-store изменений не было.

Fresh `package.json` также подтверждает: `provider-circuit-missing-state-retrip-restart-test.js` уже входит в обычный `npm test`. Старое замечание QWEN_CORE handoff о потерянном wiring устарело.

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
- interrupted replacement recovery, legacy migration rollback и теперь filename/id aliasing;
- stream checkpoint-before-release / late stream errors;
- pending mutating tool replay guard;
- stale session/subagent backup fail-closed;
- durable request governor V4–V10;
- restart/failover replay-safety для completed и unresolved mutating calls.

## CircleCI final gate
Политика `autonomy/ci/CIRCLECI_GATE_POLICY.md` обязательна.
Новый gate в этом проходе НЕ запускался. Перед gate:
1. fresh exact PR head;
2. targeted account/provider cluster локально/hosted насколько возможно;
3. убедиться, что общий product SHA стабилен;
4. согласовать одного владельца exact SHA с QWEN_CORE;
5. использовать только disposable `ci/qwen-final-gate`;
6. недоступный Circle result = `RESULT_ACCESS_UNAVAILABLE`, не PASS.

## Постоянная память
Worker: `QWEN_RELIABILITY`.
На старте перечитаны нормативный `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json`, exact `autonomy/v3/tools/capsule_runtime_v4.py`, `LATEST.json` и `PREVIOUS.json`.
Текущий проверенный pointer на старте:
- LATEST capsule `20260822T115554Z-8763a42805`;
- LATEST blob `659fa97eca2345c6ca401b4788ec1d5f6e43f650`;
- archive SHA-256 `3ebdba2e34121ab6a368bbde3f3d928c9fcdbfa88fad7fdda74834d13063467d`;
- PREVIOUS capsule `20260822T105753Z-02993b42b7`.

Новая capsule не публиковалась: exact capsule bytes из GitHub connector нельзя безопасно материализовать в локальную FS для нормативного `restore -> pack -> verify -> CAS`. Force-write `LATEST/PREVIOUS` не использовался. Durable состояние этого прохода закреплено exact product commits и этим handoff.

Live Qwen/provider traffic, реальные аккаунты, секреты, Cloudflare, production, GitHub Actions и CircleCI не использовались.

## Следующий полезный шаг
Fresh-read PR #6 + QWEN_CORE. Если account-store не менялся, не возвращаться к filename/id defect без нового контрпримера. Искать следующий воспроизводимый сбой только в pool/candidates/cooldown/provider-circuit/affinity/bounded-retry/replay safety. При появлении возможности exact checkout первым делом прогнать новый filename regression вместе с account-store cluster; только затем решать, созрел ли exact SHA для единственного CircleCI final gate.
