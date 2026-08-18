# AUTOPILOT CONTROL v2.2

## CURRENT OPERATING MODE — PROCESS_STABILIZATION
- Until this mode is explicitly lifted by the owner, all product repositories and product branches for KONTUR/QWEN/NOTION/AI_MIRRORS are READ-ONLY to ChatGPT Tasks.
- The active job is to improve the development system itself: scheduling, state/evidence/authority modeling, claims/leases, CI/executor architecture, deterministic tooling, handoffs, safety and reproducibility.
- Product defects may be investigated and packaged as exact READY work packets, but Tasks must NOT modify product source, product tests, product workflows, product branches, provider behavior, staging or production.
- Existing external runs may be harvested read-only; do not launch new product/live-provider runs during PROCESS_STABILIZATION.
- `USER_NEEDED=NO` remains the default for reversible control-plane improvements under `autopilot/v2/**`.
- This section overrides any later generic permission in this file to perform PRODUCT mutations. Product-write claims are disabled while this mode is active.

Authority order: current explicit owner requirements > reproducible current-source evidence > versioned acceptance manifest > current lane state > historical evidence > audit log.

## Execution model
- A ChatGPT Task invocation is a SHORT PULSE. Assume it may end at any time; elapsed time and loop count are never success criteria.
- A pulse should complete one atomic process result: localize one control/executor/evidence failure; improve one deterministic control tool; reconcile one stale state/evidence item; or harvest/classify one already-existing external proof.
- Work expected to exceed ~90 seconds belongs to a durable external executor only when it is process/control-plane work and does not launch product/provider activity. Persist executor/run identity instead of waiting.
- Scheduler allocates by READY critical-path value, not historical project ownership or fairness. A DONE/frozen lane donates capacity immediately.

## Authority and mutation contracts
- `Ai-b0ss/kontur#9` is AUDIT LOG / provenance only. It is never current machine state and old comments never outrank current state/authority.
- Canonical authority references are registered in `autopilot/v2/authority/registry.json`. Acceptance manifests are a versioned executable interpretation of those sources, not an independent source of product requirements.
- Outside PROCESS_STABILIZATION, every PRODUCT mutation requires an `active_claim` that names: `acceptance_row`, non-empty `authority_refs`, exact `expected_head`, `allowed_paths`, `forbidden_surfaces`, `hypothesis`, and `new_information_expected`, plus a <=15m lease.
- During PROCESS_STABILIZATION no PRODUCT mutation claim is valid, even if structurally complete.
- A requirement inferred only from a test, old handoff, evidence checklist, CI label, or prior agent opinion may create an investigation packet, but may not create product behavior.
- If source/evidence disproves a historical claim, reclassify the claim/evidence; do not preserve the old architecture out of inertia.

## Current state, acceptance and evidence
- Current machine state is `autopilot/v2/lanes/*.json` on branch `autopilot/control-v2-20260819`.
- Mandatory product requirements live in `autopilot/v2/acceptance/<acceptance_version>.json`. A lane may not claim CORE_DONE unless every mandatory row is PASS with row-bound evidence.
- Every NEW evidence claim must name an acceptance row id and bind: exact product SHA, proof surface, oracle, run/artifact identity, result, and invalidation dependencies.
- Free-text `proven`/`verify_pending` are navigation notes only. They do not close acceptance rows.
- Legacy evidence may be inherited only where named dependencies are unchanged. An executor-only change does not invalidate unchanged product evidence.
- CI conclusion is not product semantics. `steps=null`, harness failure, inverted diagnostic jobs and product failure are distinct classes: PRODUCT / SOURCE / HARNESS / EXECUTOR / EVIDENCE.
- Invalidation is narrow: reopen only rows whose named dependencies/proof surfaces changed.

## Claims / WIP / retries
- During PROCESS_STABILIZATION there are no product mutable claims.
- Control-plane writes use normal GitHub blob-SHA/CAS protection and must stay under `autopilot/v2/**`.
- No duplicate run while an equivalent external proof is unresolved.
- Every retry must state `new_information_expected`; identical failure fingerprint with no changed variable => no retry, pivot.
- Before every control-plane mutation re-read the relevant blob SHA; abort/replan on drift.

## Provider safety
- No live provider traffic is allowed from ChatGPT Tasks during PROCESS_STABILIZATION.
- The single global provider-live lease in `autopilot/v2/lanes/global.json` remains reserved for a later implementation/acceptance phase; it is not authority to call a provider now.
- Never rotate to bypass provider restrictions.

## Writes and branches
- Allowed Task writes in PROCESS_STABILIZATION: `autopilot/v2/**` on the dedicated control branch only.
- Forbidden: product source, product tests, product workflows, product branches, staging, production, default/main, destructive data writes.
- Product findings become evidence plus READY work packets, not product commits.
- Archaeological patch towers may be analyzed and a clean migration plan prepared, but not rewritten during this mode.

## Secrets and executors
- No secret in argv/log/hash/fingerprint/artifact.
- Use stdin/passphrase-fd or equivalent non-argv channel; disable trace; restrictive temp permissions; always cleanup/unset.
- Secret-bearing self-hosted runners must run with a scrubbed child environment and immutable trusted workflow/ref.
- Waiting is not work; existing external results should be harvested rather than polled.

## DONE
- DONE is row-by-row acceptance, not nearest-gate green.
- Source/string tests can prove SOURCE_INVARIANT only; runtime/visual behavior needs the appropriate oracle.
- `CORE_DONE` must include exact acceptance version and evidence refs for every mandatory row.
- PROCESS_STABILIZATION itself is done only when the control plane is reproducible, authority-safe, short-pulse tolerant, deterministic where possible, and no longer causes accidental product churn.

## Deterministic guards
- `autopilot/v2/tools/validate_control_state.py` is the fail-fast structural check for lane/manifest/claim consistency.
- Any structural validation error blocks control-plane mutation until reconciled.
- Repeated reasoning loops should become deterministic tools when feasible; prefer machine checks for authority binding, secret leakage, branch scope, exact-head evidence and external-run harvesting.
