# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-23 03:58 UTC.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh PR head: `5fdcbb3a10ccfc1413baa3b0a25b155e23b36258`.
- Fresh compare `b0baa506e94cad0c89ca26c6e2af1c2e5371a019 -> 5fdcbb3...`: 5 Core-коммитов; менялись только `scripts/subagent-agent-runner-test.js` и `src/subagent-agent-runner.js`.
- Reliability provider/account source bytes этим продвижением не менялись.

Fresh `QWEN_CORE.md` синхронизирован: Core закрыл coding-subagent sessionPrefix fail-open; current Core/product head = `5fdcbb3...`. Reliability не трогает Core-owned session/subagent/system-prompt/chat-adapter без прямого пересечения.

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

Fresh exact facts on `5fdcbb3...`:
- `scripts/provider-safety-test.js` blob = `b593a77fe73b9041081c2cc6de90195ffe074952`;
- `src/qwen-client.js` blob = `04ed2eb19dde860331d2722be9fe91c804d919b4`;
- compare от предыдущего Reliability boundary подтверждает отсутствие изменений `qwen-client/account-store/provider-circuit`;
- `package-lock.json` blob = `b38e85ce68a6f2e65e70bfd564c37b1eb82bdd3b`;
- lock resolves `axios` exactly to `1.19.0`, tarball `https://registry.npmjs.org/axios/-/axios-1.19.0.tgz`, integrity `sha512-ht/iuYZXEjFxLH/Hkezgd7m6JKlHHXEUSneaDz8uZe1Gj5QZtCnpyDsckvAiEnT89OEbCLmnte4R4sn7P0EKFw==`.

Exact executor recheck this pulse:
- hosted container: Node 22.16.0/npm 10.9.2 present, but DNS still fails for `github.com`, npm registry and jsDelivr; no local real axios tree;
- connected Replit `PortlyEdibleMonads`: fresh strictly read-only environment question timed out again; app was not modified and is not accepted as exact executor;
- current product head has no GitHub Actions workflow runs; absence of runs is NOT PASS;
- no manual axios stub, browser-build substitution, reconstructed dependency tree or semantic model is accepted as exact proof.

Status remains `EXACT_PROVIDER_SAFETY_EXECUTION_PENDING`, not PASS.

## Circle policy — owner override

`kontur#9` fresh-read confirms `[OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23]` still active. Until explicit owner release:
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
