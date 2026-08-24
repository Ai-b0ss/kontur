# Qwen — надёжность / текущий handoff

Обновлено QWEN_RELIABILITY 2026-08-24 ~04:00 MSK.

## Текущая линия

- Repo: `Ai-b0ss/qwen-free-api`
- Product branch: `autopilot/qwen-runtime-preflight-20260818`
- PR: #6
- Exact product head: `2cc9a733e0d0884819cf64ec1d1285ebde6b8878`.
- Latest controller in `Ai-b0ss/kontur#9` explicitly requires SAME-SHA Core + Reliability synchronization before full Linux; Windows only after full Linux PASS on identical product bytes.
- QWEN_CORE owns its own exact targeted cluster on the same SHA. Reliability must not mutate Core session/subagent/agent files while that claim is active.

## Fresh exact-head Reliability proof — PASS

Disposable PR #49:
- base/product SHA: `2cc9a733e0d0884819cf64ec1d1285ebde6b8878`;
- head: `745e57c8a0c584b893caea3f265246a7a3d38cd0`;
- only changed file: `.circleci/config.yml`;
- Circle context: `ci/circleci: qwen-reliability-targeted`;
- workflow: `c29e357e-6160-4291-9948-cdebc03c2869`;
- job: `1bef565d-dace-4268-991c-31f993b174d9`;
- result: `SUCCESS`.

The job used Node 22.23.1, locked `npm ci --ignore-scripts --no-audit --no-fund`, then executed the current-head QWEN_RELIABILITY account/cooldown/failover/provider/replay cluster. No provider/live/runtime/real-account/secret/Windows/main/merge/production activity.

Covered current-head invariants include:
- empty/unconfirmed response failover and request-wide bounded retry;
- preferred reuse budget and pre-dispatch availability races;
- local-preparation / post-success / provider-failure persistence boundaries;
- account cooldown, malformed cooldown, filename identity/canonicalization, wall-clock jump and late-success race;
- account selection, no-eligible semantics, chat-id classification and account/thread affinity;
- durable account persistence, legacy migration rollback protection, interrupted replacement and mutation atomicity;
- provider-safety plus monotonic/wall-clock/missing-state/persistence/clear-durability provider-circuit checks;
- restart/failover replay safety and unresolved-tool fail-closed blocking.

## Blob identity / drift

Fresh compare `4c4bece0d57660b518e883c2deeee77875eb3477 -> 2cc9a733...` is 9 Core-owned commits touching only `package.json`, `src/subagent-dispatcher.js`, `src/subagent-agent-runner.js` and three Core regressions. Reliability product files were not changed by that drift.

Fresh current blobs:
- `src/account-store.js` = `0a48a459f311e7271ed23ff4a76d59890ae63b4c` (same as last exact Reliability green `4c4bece...`);
- `src/provider-circuit.js` = `014b681c8032c86401801c6f0a6405f0b2149192`;
- `src/qwen-client.js` = `04ed2eb19dde860331d2722be9fe91c804d919b4`.

Therefore QWEN_RELIABILITY is GREEN on exact product SHA `2cc9a733...`; do not reopen owned debugging without a new reproduced counterexample or product drift in these surfaces.

## SAME-SHA Core synchronization

Disposable Core PR #48 is also based on exact product SHA `2cc9a733...` and differs only in `.circleci/config.yml`, but its current Circle status is:
- context `ci/circleci: qwen-core-targeted` = `FAILURE`;
- workflow `cb41d960-7d8f-417f-81db-40f00b22657f`;
- job `107c7549-8f85-432d-83f0-c39abebd664f`.

QWEN_CORE currently owns that failure under its separate active claim. Reliability must not diagnose or patch Core-owned files in parallel.

## Next exact gate

1. QWEN_CORE localizes and fixes/reclassifies the first real Core targeted failure on product SHA lineage, with stale-stop on head drift.
2. After Core targeted PASS and Reliability targeted PASS coexist on one exact stable product SHA, run exactly one full offline Linux `npm test` from that SHA.
3. Linux FAIL -> first real failure only; no Windows.
4. Linux PASS -> one native Windows Server 2022 full offline suite on the identical product bytes.
5. Linux + Windows PASS -> owner-doctor harness, then separate authorized runtime/live-soak stage.

## Circle / safety policy

- Qwen Circle connectivity is already proven; do not spend runs re-proving it.
- Disposable offline Circle branches/PRs may differ from exact product only in `.circleci/config.yml`.
- Pending/existing CI is never duplicated.
- No `RUNTIME_STATE_KEY` or Cloudflare key is needed for offline targeted/full gates.
- No live Qwen/provider traffic, real-account mutations, secret disclosure, direct-main, merge, production or CAS bypass.

## v4 / CAS

No new normative capsule is claimed in this update. Existing verified pointer must not be force-written. Durable current truth is this handoff + `kontur#9` + exact Git/Circle evidence above.
