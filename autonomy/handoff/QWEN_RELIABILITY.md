# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-23 04:50 UTC.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh PR head: `b45ddac908e7b5a6926cb04bc58994a177cc0af9`.
- Fresh compare `5fdcbb3a10ccfc1413baa3b0a25b155e23b36258 -> b45ddac...`: ровно 1 Core-коммит `test: fail closed on non-string coding batch ids`; добавлен только `scripts/subagent-batch-id-type-test.js`.
- Reliability provider/account source bytes этим продвижением не менялись.

Fresh `QWEN_CORE.md` синхронизирован: Core-owned session/subagent/system-prompt/chat-adapter участок Reliability не трогает без прямого пересечения.

## Уже доказано Reliability

### Account/cooldown — 8/8 exact targeted PASS

На byte-exact materialized GitHub blobs прошли:
1. `account-store-noncanonical-filename-test.js`;
2. `account-store-filename-identity-test.js`;
3. `account-store-persistence-test.js`;
4. `account-store-interrupted-replacement-recovery-test.js`;
5. `account-store-mutation-atomicity-test.js`;
6. `account-store-cooldown-test.js`;
7. `account-cooldown-wall-clock-jump-test.js`;
8. `account-success-cooldown-race-test.js`.

Noncanonical filename root fix = `e21baa6c29edfc2b592db01106fcd9c32f752a21`; regression подключён в ordinary `npm test` после green.

### Provider-circuit — 7/8 exact targeted PASS

PASS:
1. `provider-circuit-monotonic-test.js`;
2. `provider-circuit-wall-clock-jump-test.js`;
3. `provider-circuit-trip-wall-clock-jump-test.js`;
4. `provider-circuit-missing-state-fail-closed-test.js`;
5. `provider-circuit-missing-state-retrip-restart-test.js`;
6. `provider-circuit-persistence-test.js`;
7. `provider-circuit-clear-durability-test.js`.

## Единственный текущий Reliability proof gap

Остаётся exact execution `scripts/provider-safety-test.js` на настоящем locked dependency tree.

Fresh exact facts on `b45ddac...`:
- `scripts/provider-safety-test.js` остаётся тем же по содержанию, ожидаемый marker `PROVIDER_SAFE_ROTATION_PASS`;
- `src/qwen-client.js` blob = `04ed2eb19dde860331d2722be9fe91c804d919b4`;
- `src/account-store.js` blob = `7f60373a4335a82253ac3bfbc047283079de1d77`;
- `src/provider-circuit.js` blob = `014b681c8032c86401801c6f0a6405f0b2149192`;
- package lock по последнему проверенному Reliability boundary разрешает `axios` ровно `1.19.0`; ручной stub/reconstructed tree не принимаются как exact proof.

Exact executor recheck this pulse:
- hosted container: Node/npm есть, но прямой DNS к npm/GitHub всё ещё не работает; реального locked axios tree локально нет;
- connected Replit `PortlyEdibleMonads`: fresh строго read-only вопрос только о Node/npm/DNS снова завершился timeout; app не менялся и не принят как exact executor;
- current product head `b45ddac...` имеет GitHub Actions workflow runs = `[]`; отсутствие runs не является PASS;
- публичный web подтверждает существование npm `axios 1.19.0` и точный tarball/integrity, но без безопасной материализации полного locked tree это не заменяет exact npm execution.

Status remains `EXACT_PROVIDER_SAFETY_EXECUTION_PENDING`, not PASS.

## Circle policy — owner override

`kontur#9` fresh-read confirms `[OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23]` still active and no later explicit owner release was found. Until explicit owner release:
- Circle runs/jobs/branch triggers = 0;
- do not move disposable gate branches;
- do not use Circle as execution fallback;
- old Circle results are historical only.

If all non-Circle prerequisites become green and only native gate remains, report `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`; do not self-trigger.

Old gate `246dcfc...` based on stale product bytes is permanently non-final.

## v4 / CAS

Force-write remains forbidden. Last verified Reliability pointers remain:
- `LATEST`: `20260822T115554Z-8763a42805`, archive SHA-256 `3ebdba2e34121ab6a368bbde3f3d928c9fcdbfa88fad7fdda74834d13063467d`;
- `PREVIOUS`: `20260822T105753Z-02993b42b7`, archive SHA-256 `7e5dc59f9ba7bd5672259a811bfc50a24b324df2bd93c2b8770b8196ad607da8`.

No new capsule published this pulse: mandatory exact `restore -> checkpoint -> pack -> verify -> restore -> CAS` could not be completed byte-identically. No pseudo-v4 reconstruction.

## Следующий порядок

1. Fresh-read PR #6 first. If provider/account blobs remain unchanged, do not repeat closed account/provider-circuit work.
2. Use the first already-authorized exact executor that can materialize the locked npm tree and run `node scripts/provider-safety-test.js`. Expected marker: `PROVIDER_SAFE_ROTATION_PASS`. No provider traffic is needed.
3. On exact PASS, run fresh targeted account/failover/replay cluster on one stable SHA plus exactly one bounded Windows/path/rename/file-lock/process/env red-team.
4. Fresh-read QWEN_CORE and require its targeted set green on the same product SHA.
5. Then full exact-tree Linux `npm test` on that SHA.
6. While Circle freeze remains, stop at `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE` if Circle is the only remaining gate.
7. After explicit owner release only: one native Windows Server 2022 locked full suite on the same product bytes, no provider/live/secrets/production.
8. Any FAIL: first reproduced root cause -> minimal fix -> targeted repeat -> full repeat. Do not expand audit without a serious reproducible counterexample.

## Запреты

- AI Mirrors/Kontur product code не трогать.
- Не использовать владельца как тестировщика.
- Не запускать live Qwen/real accounts ради этого доказательства.
- Не force-write control/product branches.
- Не заявлять exact PASS по semantic/shim/reconstructed dependency execution.
