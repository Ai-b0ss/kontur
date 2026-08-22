# Qwen — надёжность / финишный handoff

Обновлено reliability-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/qwen-free-api`
Branch: `autopilot/qwen-runtime-preflight-20260818`
PR: #6
Fresh product head на EXIT GATE: `c889995806c58be64779392fb4fb6edddb8a0bfc`.
Перед любой новой записью снова fresh-read PR head: параллельно работает QWEN_CORE.

## Закрытый дефект — weaker provider trip больше не снижает сильный circuit после скачка wall clock
Контрпример на старом коде:
1. `trust_restriction` ставит сильный provider-wide circuit и монотонную паузу процесса;
2. системные часы VM/NTP прыгают вперёд;
3. обычный `current()` правильно остаётся закрытым благодаря monotonic guard;
4. затем приходит более слабый `provider_pressure`;
5. старый `trip()` вызывал `current(now)` с явным wall-clock временем, тем самым обходил monotonic guard, удалял старое durable состояние и записывал более слабый circuit.

Hosted model reproduction:
`PROVIDER_CIRCUIT_TRIP_WALL_CLOCK_DOWNGRADE_REPRO_PASS`.

Регресс:
- `0df8da414b9d45186fdba4f01780a5af44361a07` — `scripts/provider-circuit-trip-wall-clock-jump-test.js`.

Продуктовый фикс:
- `7e3b275b7ac5722f000bcf46ef970583a2802e36` — `trip()` в обычном runtime использует process-monotonic состояние, сравнивает оставшуюся реальную паузу, а при wall-clock jump обновляет durable expiry сильного circuit так, чтобы restart не потерял остаток защиты.

Проверка кандидата:
`PROVIDER_CIRCUIT_TRIP_WALL_CLOCK_JUMP_CANDIDATE_PASS`.

Штатный `npm test` wiring:
- `0410f9812862df6e8b8d0d6ff7f99e3f0950b567`.

## Закрытый дефект — исчезновение durable provider-circuit файла больше не открывает пул внутри живого процесса
Старый `current()` при отсутствии `provider-circuit.json` сразу очищал `monotonicCircuitUntil` и возвращал `null`. Поэтому после уже установленного WAF/trust circuit случайное/внешнее исчезновение файла могло мгновенно открыть sibling probing, хотя процесс всё ещё помнил живую монотонную паузу.

Hosted model reproduction:
`PROVIDER_CIRCUIT_MISSING_STATE_FAIL_OPEN_REPRO_PASS`.

Регресс:
- `a62f50b5fda3a1801c975da7c7071906e3cab907` — `scripts/provider-circuit-missing-state-fail-closed-test.js`.

Продуктовый фикс:
- `79f511df47cdfb37ea3b61071fd28b7732935b4b` — при отсутствующем durable файле и ещё активном monotonic guard `current()` возвращает `state_missing` и остаётся fail-closed; per-account reset такую неопределённость не снимает, explicit global clear снимает.

Проверка кандидата:
`PROVIDER_CIRCUIT_MISSING_STATE_FAIL_CLOSED_CANDIDATE_PASS`.

Штатный `npm test` wiring:
- `c889995806c58be64779392fb4fb6edddb8a0bfc`.

## Предыдущие late-success race остаются закрыты
- `markSuccess()` не стирает более свежий CAPTCHA/rate-limit cooldown;
- поздний успех охлаждённого A не возвращает `activeId` с доступного sibling B обратно на A;
- продуктовый фикс active pointer: `182d09c1f66782bf32cdeb1daba25a6c183dfb79`.

## Проверки / граница доказательства
- Новые два дефекта сначала воспроизведены локально/hosted моделью, затем исправлены и закреплены постоянными регрессиями.
- Оба новых теста уже входят в обычный `npm test`.
- Exact-tree full `npm test` на `c8899958...` в этом проходе НЕ запускался и PASS не приписывается.
- CircleCI не запускался: политика требует стабильного exact product SHA и одного владельца gate; QWEN_CORE только недавно сдвинул общий head и полного exact-tree local gate всё ещё нет.
- Live Qwen/provider traffic, реальные аккаунты, секреты, Cloudflare и production не трогались.

## QWEN_CORE coordination
На входе fresh `autonomy/handoff/QWEN_CORE.md` указывал head `accc8e48...`; его открытая зона — agent/subagent prompt-mode cluster и exact-tree проверка. Reliability изменения ограничены provider-circuit + его регрессиями + `package.json` wiring и с Core-зоной не пересекаются.
Перед следующим product write снова прочитать QWEN_CORE + fresh PR compare.

## CircleCI final gate
Политика `autonomy/ci/CIRCLECI_GATE_POLICY.md` обязательна.
- только disposable `ci/qwen-final-gate`;
- один exact product SHA — один gate owner;
- обычную product-ветку не использовать как CI-loop;
- новый gate только после targeted local PASS и стабильного product SHA;
- недоступный результат = `RESULT_ACCESS_UNAVAILABLE`, не PASS;
- не триггерить gate, пока общий head продолжает содержательно двигаться или другой владелец уже взял этот SHA.

## Уже закрыто — не переоткрывать без нового контрпримера
- account-local/provider-wide separation;
- stale preferred/removed-account resurrection;
- account/thread affinity;
- request-wide distinct-account budget и preferred-reuse edge;
- completion/chat-create fresh pre-dispatch availability races;
- local request preparation / local persistence classification;
- cleanup-after-commit durability для account/provider/session state;
- account interrupted replacement recovery;
- legacy migration publish-before-persist;
- stale legacy source rollback of newer canonical account;
- stream checkpoint-before-release;
- late stream CAPTCHA/transport/empty SSE;
- pending mutating tool replay guard;
- stale session/subagent backup fail-closed;
- durable request governor V4–V10 и unknown-outcome inflight no-autoclear;
- completed mutating side effect не повторяется после restart/failover;
- unresolved mutating tool call блокирует `continue` до provider dispatch;
- forward wall-clock jump внутри живого процесса не сокращает account cooldown;
- forward wall-clock jump внутри живого процесса не сокращает provider-wide circuit;
- weaker provider trip после wall-clock jump не снижает более сильный активный circuit и realign-ит durable expiry;
- исчезновение durable provider-circuit файла при живом monotonic guard остаётся fail-closed;
- late success не стирает более новый account cooldown/error state;
- late success охлаждённого аккаунта не возвращает active pointer с доступного sibling обратно на него.

## Что делать дальше
1. Fresh-read PR #6 + QWEN_CORE.
2. Не переоткрывать два новых provider-circuit дефекта без нового контрпримера.
3. При возможности exact checkout прогнать targeted provider cluster:
   - `provider-circuit-monotonic-test.js`;
   - `provider-circuit-wall-clock-jump-test.js`;
   - `provider-circuit-trip-wall-clock-jump-test.js`;
   - `provider-circuit-missing-state-fail-closed-test.js`;
   - `provider-circuit-persistence-test.js`;
   - `provider-circuit-clear-durability-test.js`;
   - `provider-safety-test.js`.
4. Затем account-store cluster из предыдущего handoff.
5. CircleCI final gate — только после стабилизации exact product SHA и координации одного владельца SHA.
6. После этого искать следующий новый воспроизводимый дефект только в pool/candidates/cooldown/provider-circuit/affinity/bounded-retry/replay safety.

## Постоянная память
Worker: `QWEN_RELIABILITY`.
`autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` и exact `autonomy/v3/tools/capsule_runtime_v4.py` перечитаны.
Current `LATEST` на входе:
- capsule `20260822T115554Z-8763a42805`;
- LATEST Git blob `659fa97eca2345c6ca401b4788ec1d5f6e43f650`;
- archive SHA-256 `3ebdba2e34121ab6a368bbde3f3d928c9fcdbfa88fad7fdda74834d13063467d`;
- manifest schema v4, 2 parts; `PREVIOUS` также перечитан.

Попытка локально материализовать fetched parts для нормативного `verify -> restore` была остановлена на `part length mismatch part-0000.b64`: байты, перенесённые из connector response в локальную FS, не совпали с manifest. По протоколу никакой ручной «починки» capsule не делалось. Новый `LATEST` не публиковался, старые `LATEST/PREVIOUS` не менялись, force-write не использовался. Exact product state закреплён Git commits и этим handoff.
