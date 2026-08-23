# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-23 06:49 UTC.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh PR head: `484d8cf8b910c9e7333ba9ac4285f9f05ba32fb6`.
- Compare от предыдущей доказательной Reliability-границы `a56418b862372ef1150a66cf613033677a2545e2` до fresh head = 5 commits; изменены только `package.json`, `src/subagent-dispatcher.js` и Core-owned regressions `scripts/subagent-skill-type-validation-test.js` / `scripts/session-orphan-tool-result-restart-test.js`. Reliability provider/account bytes не менялись.

Fresh `QWEN_CORE.md` синхронизирован по границе ответственности: Core-owned session/subagent/system-prompt/chat-adapter участок Reliability не трогает без прямого пересечения. Fresh Core head совпадает с PR head `484d8cf8...` и содержит новый доказанный RED в session-store boundary: incremental tool results могут потерять durable pending pair. Это отдельный Core blocker для общего full-suite, Reliability его не чинит.

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

Fresh exact facts на `484d8cf8...` сохраняются, так как Reliability bytes не менялись от `a56418b...`:
- `src/qwen-client.js` blob = `04ed2eb19dde860331d2722be9fe91c804d919b4`;
- `src/account-store.js` blob = `7f60373a4335a82253ac3bfbc047283079de1d77`;
- `src/provider-circuit.js` blob = `014b681c8032c86401801c6f0a6405f0b2149192`;
- `package-lock.json` blob = `b38e85ce68a6f2e65e70bfd564c37b1eb82bdd3b`;
- `scripts/provider-safety-test.js` blob = `b593a77fe73b9041081c2cc6de90195ffe074952`;
- expected marker = `PROVIDER_SAFE_ROTATION_PASS`;
- locked tree resolves `axios` exactly to `1.19.0`; manual stub/reconstructed dependency tree не принимаются как exact proof.

Fresh executor recheck this pulse:
- hosted container: прежняя установленная граница сохраняется — прямой npm/GitHub transport недоступен, локального locked tree/axios нет; повторять те же DNS/registry probes без изменения среды не нужно;
- connected Replit `PortlyEdibleMonads`: fresh строго read-only запрос на наличие exact checkout + locked tree и запуск `provider-safety-test.js` снова завершился timeout; app не менялся и не принят как exact executor;
- GitHub connector даёт exact private source bytes, но не монтирует готовый executable npm tree в hosted filesystem;
- no stub/reconstructed/manual dependency assembly counted as exact PASS.

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

No new capsule published this pulse: mandatory exact `restore -> checkpoint -> pack -> verify -> restore -> CAS` was not completed. No pseudo-v4 reconstruction.

## Следующий порядок

1. Fresh-read PR #6 first. If provider/account blobs remain unchanged, do not repeat closed account/provider-circuit work.
2. Use the first already-authorized exact executor that can materialize the locked npm tree and run `node scripts/provider-safety-test.js`. Expected marker: `PROVIDER_SAFE_ROTATION_PASS`. No provider traffic is needed.
3. Do not spend more pulses probing the same hosted container DNS/registry or the same timed-out Replit path unless environment evidence changes.
4. On exact Reliability PASS, run fresh targeted account/failover/replay cluster on one stable SHA plus exactly one bounded Windows/path/rename/file-lock/process/env red-team.
5. Fresh-read QWEN_CORE and require its targeted set green on the same product SHA. Fresh Core currently has its own RED `session-orphan-tool-result-restart-test.js`; Reliability does not touch that area.
6. Only after Core + Reliability targeted green on one stable SHA: full exact-tree Linux `npm test` on that SHA.
7. While Circle freeze remains, stop at `READY_FOR_CIRCLE_AFTER_OWNER_RELEASE` if Circle is the only remaining gate.
8. After explicit owner release only: one native Windows Server 2022 locked full suite on the same product bytes, no provider/live/secrets/production.
9. Any FAIL: first reproduced root cause -> minimal fix -> targeted repeat -> full repeat. Do not expand audit without a serious reproducible counterexample.

## Запреты

- AI Mirrors/Kontur product code не трогать.
- Не использовать владельца как тестировщика.
- Не запускать live Qwen/real accounts ради этого доказательства.
- Не force-write control/product branches.
- Не заявлять exact PASS по semantic/shim/reconstructed dependency execution.
