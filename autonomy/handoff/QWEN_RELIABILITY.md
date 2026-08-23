# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-23 09:49 UTC.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Fresh exact product head: `4551eff038e987062c78e4806734f30de5eebe92`.
- Latest product commit `4551eff...` is Core-owned test-only RED: `scripts/subagent-capability-option-type-test.js`. QWEN_CORE owns the minimal capability-type fix; Reliability must not write `subagent-agent-runner` or duplicate the stale Linux diagnostic.
- Current controller/owner policy in `kontur#9` supersedes the old Circle freeze/unconnected wording: Qwen Circle connectivity is PROVEN by reconnect commit `5c7a2aeb1b71ac1d956c691c126457ab0c6fae14`, `ci/circleci: reconnect-probe=success`, workflow `2bd97d07-0bee-46d3-9a61-5081d23d39df`, job `737804cd-6649-4fb6-a889-871123d8499d`.
- Old `MANUAL-QWEN-FRESH-GATE-20260823T1116MSK` was tied to stale product `d6e843...` and is invalid after head drift. Do not interpret its PR#22 result as current product evidence and do not launch Windows from it.

## Reliability evidence that remains valid

### Account/cooldown — 8/8 exact targeted PASS

Previously executed byte-exact targeted cluster remains valid where the owned blobs are unchanged:
1. `account-store-noncanonical-filename-test.js`;
2. `account-store-filename-identity-test.js`;
3. `account-store-persistence-test.js`;
4. `account-store-interrupted-replacement-recovery-test.js`;
5. `account-store-mutation-atomicity-test.js`;
6. `account-store-cooldown-test.js`;
7. `account-cooldown-wall-clock-jump-test.js`;
8. `account-success-cooldown-race-test.js`.

Current `src/account-store.js` blob on `4551eff...` = `7f60373a4335a82253ac3bfbc047283079de1d77`, unchanged from the locked-tree Circle product SHA `8bd64b18551c1874b7f605908f4c70875250d2d8` and from the prior Reliability boundary.

### Provider circuit — focused targeted cluster already exact PASS

Previously executed provider-circuit checks remain applicable because current `src/provider-circuit.js` blob = `014b681c8032c86401801c6f0a6405f0b2149192`, unchanged.

### Exact provider-safety environment gap is closed as an executor/dependency question

The prior disposable Circle run on product SHA `8bd64b18551c1874b7f605908f4c70875250d2d8` proved:
- locked `npm ci` succeeded with the real dependency tree;
- exact `node scripts/provider-safety-test.js` returned `PROVIDER_SAFE_ROTATION_PASS`;
- no provider/live/runtime/account traffic was used.

Fresh read on `4551eff...` proves the directly-loaded provider-safety closure used by that test is byte-identical to the executed SHA:
- `scripts/provider-safety-test.js` = `b593a77fe73b9041081c2cc6de90195ffe074952`;
- `src/qwen-client.js` = `04ed2eb19dde860331d2722be9fe91c804d919b4`;
- `src/account-store.js` = `7f60373a4335a82253ac3bfbc047283079de1d77`;
- `src/provider-circuit.js` = `014b681c8032c86401801c6f0a6405f0b2149192`;
- `src/config.js` = `e6bfdf206c0ee60bb7faecf398add28500f3993d`;
- `src/ssxmod-manager.js` = `5b99aa8d027d6ea9d643efc10b975f4ea1691d41`;
- `src/util.js` = `d2421cf641c22af718227447372106df35cb7a0f`;
- `src/cookie-generator.js` = `3d1228c4a29e7116c56b536a6a417b79136d9b43`;
- `package-lock.json` = `b38e85ce68a6f2e65e70bfd564c37b1eb82bdd3b` (real axios 1.19.0 locked tree).

Important boundary: this closes the former “can exact provider-safety execute with real dependencies?” gap. It is NOT a substitute for the required fresh-current-head targeted/full Linux run. Historical full-suite PASS/FAIL on another product SHA is not current-head evidence.

## Current blocker / ownership

Fresh `kontur#9` controller sync at 12:36 MSK and exact PR read agree: `4551eff...` is intentionally RED in QWEN_CORE. `taskSettings()` still coercively accepts malformed explicit `terminal/files/webSearch/thinking`; the new regression expects `QWEN_SUBAGENT_SETTING_INVALID` and is intentionally not wired into ordinary `npm test` until the Core fix is green.

Reliability does not modify that Core-owned surface and must not spend a disposable Circle run on a head already expected to drift from a known Core RED.

## Current Circle policy

- Connectivity: PROVEN; never re-run reconnect just to prove connection.
- Offline Linux targeted/full Circle runs are allowed on disposable branches created from the exact current PR#6 product head, changing only `.circleci/config.yml`, with zero provider/live/runtime/account/secrets.
- Pending/existing diagnostic runs are never duplicated.
- Native Windows full is allowed only after exact-current-product Linux full `npm test` PASS on the same product bytes.
- No `RUNTIME_STATE_KEY` or Cloudflare key is needed for these offline gates.

## Next exact order

1. Fresh-read PR #6 and claims.
2. Let QWEN_CORE close the current capability-type RED, run its targeted regression + adjacent tests, and wire the regression into ordinary `npm test` after green.
3. On the resulting stable common SHA, re-read Reliability-owned blob identity. If unchanged, do not reopen closed account/circuit debugging; run one current-head Reliability targeted cluster with the real locked dependency tree.
4. Require QWEN_CORE targeted green on that SAME product SHA.
5. Then create one disposable config-only Circle proof from that exact SHA and run full Linux `npm test`.
6. Linux FAIL: classify the first real root cause only; no Windows.
7. Linux PASS: one native Windows Server 2022 full offline suite on the same product bytes.
8. Linux + Windows PASS: owner-doctor harness, then later runtime/live soak under the separate live gate.

## v4 / CAS

Force-write remains forbidden. Last verified Reliability pointers carried from the previous handoff:
- `LATEST`: `20260822T115554Z-8763a42805`, archive SHA-256 `3ebdba2e34121ab6a368bbde3f3d928c9fcdbfa88fad7fdda74834d13063467d`;
- `PREVIOUS`: `20260822T105753Z-02993b42b7`, archive SHA-256 `7e5dc59f9ba7bd5672259a811bfc50a24b324df2bd93c2b8770b8196ad607da8`.

No new capsule is claimed in this update: a normative `restore -> checkpoint -> pack -> verify -> restore -> CAS` cycle was not executed. Durable state is this handoff + issue #9 + exact product/control commits.

## Запреты

- Kontur/AI Mirrors product code не трогать.
- QWEN_CORE-owned session/subagent/agent surface не писать параллельно.
- Не запускать live Qwen/real accounts ради offline Reliability proof.
- Не direct-main/merge/production, не раскрывать secrets, не force-write/CAS bypass.
- Не заявлять current-head full PASS по историческому SHA, даже когда owned bytes совпадают.
