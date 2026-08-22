# Qwen — надёжность / финишный handoff

Обновлено reliability-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head после этого прохода: `763ac0b53a7ea94bc8241e3e539b2356b08c9984`.
Перед новой записью обязательно fresh-read PR head, потому что параллельно работает QWEN_CORE.

## Закрыто в этом проходе — forward wall-clock jump больше не снимает provider-wide circuit раньше времени
До этого общий защитный контур провайдера (`provider-circuit.json`) проверял истечение только по persisted `until <= Date.now()`. Если часы VM/NTP прыгали вперёд во время уже работающего процесса, активный WAF/trust/provider-pressure circuit мог быть удалён раньше реального времени и соседние аккаунты снова становились доступными.

Воспроизведение до исправления:
`PROVIDER_CIRCUIT_WALL_CLOCK_JUMP_REPRO_PASS premature_release=1`.

Product fix:
- `469e8188271eb61237795e6bbf73f5f5bb406994` — добавлен регрессионный тест `scripts/provider-circuit-wall-clock-jump-test.js`;
- `498c923ce923d5bf9365a206dc8d6d22cae9a677` — `src/provider-circuit.js` получил in-process monotonic deadline на `process.hrtime.bigint()`;
- `afad16b274e6f54c466584391542e6e59ec77262` — новый тест включён в обычный `npm test`.

Новый контракт:
- persisted `until` остаётся restart-floor и формат файла не меняется;
- после успешного `trip()` монотонный deadline устанавливается/продлевается;
- при первом обычном `current()` в новом процессе активный persisted circuit получает монотонную защиту на оставшееся wall-clock время;
- circuit удаляется автоматически только когда одновременно истекли wall-clock и in-process monotonic сроки;
- `retryAfterMs()` без явного тестового `now` учитывает оба срока;
- явный глобальный `clear()` снимает и persisted, и monotonic состояние;
- per-account clear по-прежнему не открывает provider-wide circuit.

Hosted/local модель нового инварианта прошла:
`PROVIDER_CIRCUIT_MONOTONIC_MODEL_PASS wall_clock_jump_blocked=1`.

Полный exact-tree `npm test` не заявлять: внешний final gate не запускался, а доступный hosted-контейнер не имеет прямого exact checkout закрытого product repo.

## Fresh-source / параллельная работа
Стартовый PR head был `cd4696f5730d928892d1080e6c7bf12a175819f1`.
Перед product write PR сдвинулся до `090ced48c44480fbd72583e4dfac8640ceecec12`; compare показал единственное параллельное изменение в `src/qwen-v3-mode.js`, `provider-circuit.js` и `package.json` не менялись.
После reliability commits QWEN_CORE добавил ещё один отдельный тест `scripts/server-qwen-mode-preflight-test.js`; свежий head `763ac0b53a7ea94bc8241e3e539b2356b08c9984`. Reliability-изменения не затёрты.

## QWEN_CORE coordination
Core продолжает tool/system-prompt/mode линию. Reliability не трогал её файлы и не запускал final CircleCI gate. Один exact gate SHA должен запускать только один владелец после fresh coordination.

## CircleCI final gate
Политика `autonomy/ci/CIRCLECI_GATE_POLICY.md` перечитана.
- использовать только disposable `ci/qwen-final-gate`;
- не запускать product-ветку как CI-loop;
- старые SHA с недоступным результатом повторно не триггерить;
- новый gate — только после targeted local/hosted PASS, когда остаётся exact-tree/full-suite gap и после fresh координации с QWEN_CORE.

В этом проходе CircleCI не запускался: общий head продолжает двигаться QWEN_CORE, поэтому тратить редкий финальный gate сейчас преждевременно.

## Уже закрыто — не переоткрывать без нового контрпримера
- account-local/provider-wide separation;
- stale preferred/removed-account resurrection;
- account/thread affinity;
- request-wide distinct-account budget и preferred-reuse edge;
- completion/chat-create fresh pre-dispatch availability races;
- локальная подготовка/локальная persistence classification;
- cleanup-after-commit durability;
- account interrupted replacement recovery;
- stream checkpoint-before-release;
- late stream CAPTCHA/transport/empty SSE;
- pending mutating tool replay guard;
- session stale-backup fail-closed;
- durable request governor V4–V10 и unknown-outcome inflight marker no-autoclear;
- completed mutating side effect не повторяется после restart/failover;
- unresolved mutating tool call блокирует `continue` до provider dispatch;
- in-process forward wall-clock jump не сокращает account-local cooldown;
- in-process forward wall-clock jump не сокращает provider-wide circuit.

## Что делать дальше
1. Fresh-read PR #6 и QWEN_CORE before any write.
2. Не переоткрывать два wall-clock дефекта без нового контрпримера.
3. До final gate искать только новый воспроизводимый дефект в pool/candidates/cooldown/provider circuit/affinity/bounded retry/replay safety.
4. Если общий head стабилен и QWEN_CORE не запускает тот же SHA, использовать `ci/qwen-final-gate` ровно один раз для exact-tree `npm ci && npm test`.
5. Live provider/секреты/production не трогать без новой доказанной необходимости.

## Постоянная память
Worker: `QWEN_RELIABILITY`.
`autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` и `autonomy/v3/tools/capsule_runtime_v4.py` перечитаны.

Старт этого прохода:
- `LATEST` capsule `20260822T105753Z-02993b42b7`;
- pointer blob SHA `b622c3e0d18aa98493eb86d62d80ea4cfec55f46`;
- archive SHA-256 `7e5dc59f9ba7bd5672259a811bfc50a24b324df2bd93c2b8770b8196ad607da8`;
- точные manifest/part материализованы локально;
- нормативные `verify + restore` через `capsule_runtime_v4.py`: PASS.

Финиш этого прохода:
- новая capsule `20260822T115554Z-8763a42805`;
- source ref `Ai-b0ss/qwen-free-api@763ac0b53a7ea94bc8241e3e539b2356b08c9984`;
- archive SHA-256 `3ebdba2e34121ab6a368bbde3f3d928c9fcdbfa88fad7fdda74834d13063467d`;
- local `pack + verify + restore`: PASS;
- uploaded manifest Git blob `6e59a2fb74c3a3f54f1b5db1e55bdaddf7159bd9` совпал с локальным Git blob;
- uploaded part0 Git blob `ea14290e0ee3097b1d6e3e64b2e3ee47daf3f3a2` совпал с локальным Git blob;
- uploaded part1 Git blob `2187638e54cf6a2b5081ca039c8ac9cef780fa2c` совпал с локальным Git blob;
- перед CAS `LATEST` всё ещё имел стартовый blob `b622c3e0d18aa98493eb86d62d80ea4cfec55f46`;
- старый `LATEST` сохранён как `PREVIOUS`;
- новый `LATEST` опубликован без force-write и после записи перечитан, текущий blob `659fa97eca2345c6ca401b4788ec1d5f6e43f650`.

Force-write `LATEST` запрещён и в этом проходе не использовался.
