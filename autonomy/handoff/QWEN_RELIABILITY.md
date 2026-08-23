# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-23 00:51 UTC.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh PR head: `77e29f8fd1f4bfa6f3305925cbe8e4972e308ee0`.
- Fresh compare `747beb79d9f7f423c27e4b19c60949da83206b0b -> 77e29f8...`: ровно два новых Core-коммита; менялись только `scripts/session-store-record-schema-recovery-test.js` и `src/session-store.js`.
- Reliability provider/account source bytes не менялись этим продвижением.

QWEN_CORE reasoning/thinking leak уже закрыт: root fix `42dbc2df...`, regression подключён к штатному `npm test` в `747beb79...`. Reliability не трогает Core-owned `session/subagent/system-prompt/chat-adapter` без прямого пересечения.

## Уже доказано Reliability

### Account/cooldown

Noncanonical filename defect закрыт product commit `e21baa6c29edfc2b592db01106fcd9c32f752a21`: `load()` принимает managed account file только если имя уже равно `${safeId(stem)}.json`.

На exact materialized GitHub blob bytes прошёл account/cooldown cluster 8/8:
1. `account-store-noncanonical-filename-test.js`;
2. `account-store-filename-identity-test.js`;
3. `account-store-persistence-test.js`;
4. `account-store-interrupted-replacement-recovery-test.js`;
5. `account-store-mutation-atomicity-test.js`;
6. `account-store-cooldown-test.js`;
7. `account-cooldown-wall-clock-jump-test.js`;
8. `account-success-cooldown-race-test.js`.

Stale mutation-atomicity expectation был исправлен только в тесте (`af1bc26a...`). После green новый noncanonical regression подключён в ordinary `npm test` (`5e5cdf4a...`).

### Provider-circuit

На exact product/test blobs PASS 7/8 targeted provider cluster:
1. `provider-circuit-monotonic-test.js`;
2. `provider-circuit-wall-clock-jump-test.js`;
3. `provider-circuit-trip-wall-clock-jump-test.js`;
4. `provider-circuit-missing-state-fail-closed-test.js`;
5. `provider-circuit-missing-state-retrip-restart-test.js`;
6. `provider-circuit-persistence-test.js`;
7. `provider-circuit-clear-durability-test.js`.

## Единственный текущий Reliability proof gap

Остаётся exact execution `scripts/provider-safety-test.js` на locked dependency tree.

Fresh exact facts on `77e29f8...`:
- `scripts/provider-safety-test.js`: blob `b593a77fe73b9041081c2cc6de90195ffe074952`;
- `src/qwen-client.js`: blob `04ed2eb19dde860331d2722be9fe91c804d919b4`;
- `src/account-store.js`: blob `7f60373a4335a82253ac3bfbc047283079de1d77`;
- `src/provider-circuit.js`: blob `014b681c8032c86401801c6f0a6405f0b2149192`;
- `package-lock.json`: blob `b38e85ce68a6f2e65e70bfd564c37b1eb82bdd3b`;
- lock resolves `axios` exactly to `1.19.0`, tarball `https://registry.npmjs.org/axios/-/axios-1.19.0.tgz`, integrity `sha512-ht/iuYZXEjFxLH/Hkezgd7m6JKlHHXEUSneaDz8uZe1Gj5QZtCnpyDsckvAiEnT89OEbCLmnte4R4sn7P0EKFw==`.

Exact execution manifest is now frozen in control evidence:
`autonomy/evidence/qwen/20260823T0051Z_provider_safety_exact_executor_manifest.json` (control commit `e28ef9f1c02c270574a62b952a787f57b5d3b00c`).

## Executor boundary checked this pulse

- Hosted container: Node 22.16.0 / npm 10.9.2 present, but registry/GitHub DNS remains unavailable; `npm view axios@1.19.0` timed out. npm cache contains no axios/follow-redirects/form-data/proxy dependencies.
- Existing connected Replit App `PortlyEdibleMonads`: two independent read-only Agent queries timed out. App was not modified and is not accepted as an exact executor.
- Manual axios stub, manually reconstructed npm package, semantic model or CDN-assembled module tree remains forbidden as exact proof.
- No GitHub Actions execution was started.

Therefore current status is still `EXACT_PROVIDER_SAFETY_EXECUTION_PENDING`, not PASS.

## Circle policy — owner override

Issue #9 has fresh `[OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23]`.
Until explicit owner release:
- Circle runs/jobs/branch triggers = 0;
- do not move disposable gate branches;
- do not use Circle as execution fallback;
- old Circle results are historical only.

If all non-Circle prerequisites become green and only native gate remains, report `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE`; do not self-trigger.

Old gate `246dcfc...` based on old product bytes is permanently stale for final evidence.

## v4 / CAS

Normative runtime fresh-read: `autonomy/v3/tools/capsule_runtime_v4.py`, blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.
Current QWEN_RELIABILITY pointers fresh-read:
- `LATEST`: capsule `20260822T115554Z-8763a42805`, archive SHA-256 `3ebdba2e34121ab6a368bbde3f3d928c9fcdbfa88fad7fdda74834d13063467d`, pointer blob `659fa97eca2345c6ca401b4788ec1d5f6e43f650`;
- `PREVIOUS`: capsule `20260822T105753Z-02993b42b7`, archive SHA-256 `7e5dc59f9ba7bd5672259a811bfc50a24b324df2bd93c2b8770b8196ad607da8`.

No new capsule was published in this pulse: the hosted filesystem still does not have a byte-identical local normative runtime + exact restored workspace for mandatory `restore -> checkpoint -> pack -> verify -> restore -> CAS`. No force-write or pseudo-v4 reconstruction.

## Следующий порядок

1. Fresh-read PR #6 first; if the provider/account blobs above remain unchanged, do not repeat closed account/provider-circuit work.
2. Use the first already-authorized surface that can materialize the exact locked npm tree and run `node scripts/provider-safety-test.js`. Expected marker: `PROVIDER_SAFE_ROTATION_PASS`. No live provider traffic is needed by this test.
3. On exact PASS, run fresh targeted account/failover/replay cluster on one stable SHA plus exactly one bounded Windows/path/rename/file-lock/process/env red-team.
4. Fresh-read QWEN_CORE and require its targeted set green on the same product SHA.
5. Then full exact-tree Linux `npm test` on that SHA.
6. If only Circle remains, stop at `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE` until owner unfreezes Circle.
7. After explicit owner release only: one native Windows Server 2022 locked full suite on the same product bytes. No provider/live/secrets/production.
8. Any FAIL: first reproduced root cause -> minimal fix -> targeted repeat -> full repeat. Do not expand audit without a serious reproducible counterexample.

## Запреты

- AI Mirrors/Kontur product code не трогать.
- Не использовать владельца как тестировщика.
- Не запускать live Qwen/real accounts ради этого доказательства.
- Не force-write control/product branches.
- Не заявлять exact PASS по semantic/shim/reconstructed dependency execution.
