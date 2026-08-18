# AUTOPILOT CONTROL v2.2

Authority order: current explicit owner requirements > reproducible current-source evidence > versioned acceptance manifest > current lane state > historical evidence > audit log.

## Execution model
- A ChatGPT Task invocation is a SHORT PULSE. Assume it may end at any time; elapsed time and loop count are never success criteria.
- A pulse should complete one atomic engineering result: localize one exact failure; implement one evidence-backed fix plus targeted regression; launch one durable external proof and persist its identity; or harvest/classify one external proof.
- Work expected to exceed ~90 seconds belongs to a durable external executor. Persist executor/run identity and release the mutable claim instead of waiting.
- Scheduler allocates by READY critical-path value, not historical project ownership or fairness. A DONE/frozen lane donates capacity immediately.

## Authority and mutation contracts
- `Ai-b0ss/kontur#9` is AUDIT LOG / provenance only. It is never current machine state and old comments never outrank current state/authority.
- Canonical authority references are registered in `autopilot/v2/authority/registry.json`. Acceptance manifests are a versioned executable interpretation of those sources, not an independent source of product requirements.
- Every PRODUCT mutation requires an `active_claim` that names: `acceptance_row`, non-empty `authority_refs`, exact `expected_head`, `allowed_paths`, `forbidden_surfaces`, `hypothesis`, and `new_information_expected`, plus a <=15m lease.
- Every `authority_ref` in a claim must exist in the registry and the acceptance row must exist in the lane's current manifest. No authority reference => no product write.
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
- One mutable writer per lane. Claim lease maximum 15 minutes.
- A pulse ending or entering WAIT_EXTERNAL releases the mutable claim.
- One unresolved external proof per lane unless the proofs are explicitly independent and non-overlapping.
- No duplicate run while an equivalent external proof is unresolved.
- Every retry must state `new_information_expected`; identical failure fingerprint with no changed variable => no retry, pivot.
- A claim pins expected product head and state revision. Before every mutation re-read branch HEAD and relevant blob SHA; abort/replan on drift.

## Provider safety
- Exactly ONE global provider-live lease exists across Autopilot, stored in `autopilot/v2/lanes/global.json`. Lane-local live leases are not authority to call a provider.
- Rate/quota may cool an account and permit eligible failover when that semantics is explicitly accepted for the product.
- An ordinary CAPTCHA/challenge that is bound to one account/session is ACCOUNT-LOCAL temporary unavailability: cool/defer that exact account and continue with another eligible account within the bounded failover budget. This is required for unattended operation; no human CAPTCHA click is required to keep unrelated eligible accounts working.
- Explicit provider-wide WAF/block, trust/explicit restriction, or ambiguous post-send state are GLOBAL STOP/CIRCUIT conditions: do not probe sibling accounts.
- Never rotate to bypass provider restrictions. Classifiers and tests must distinguish account-local CAPTCHA from explicit provider restriction rather than collapsing them into one category. Offline failure-injection does not require the global live lease.

## Writes and branches
- Never write default/main or production merely for proof.
- Keep unrelated work out of product branches. Diff must fit `allowed_paths` and must not touch `forbidden_surfaces`.
- A proven product defect may have at most one extra test-only diagnostic commit before product patch or explicit reclassification.
- Archaeological patch towers are temporary evidence machinery, not promoted architecture. After root cause is green on the strongest required oracle, materialize a clean canonical candidate and prove equivalence before promotion.

## Secrets and executors
- No secret in argv/log/hash/fingerprint/artifact.
- Use stdin/passphrase-fd or equivalent non-argv channel; disable trace; restrictive temp permissions; always cleanup/unset.
- Secret-bearing self-hosted runners must run with a scrubbed child environment and immutable trusted workflow/ref. Prefer a simpler direct executor when it removes the bridge without weakening isolation.
- Long jobs belong to durable external executors; ChatGPT stores run identity and pivots. Waiting is not work.

## DONE
- DONE is row-by-row acceptance, not nearest-gate green.
- Source/string tests can prove SOURCE_INVARIANT only; runtime/visual behavior needs the appropriate oracle.
- `CORE_DONE` must include exact acceptance version and evidence refs for every mandatory row.
- AI_MIRRORS remains frozen CORE_DONE unless a new post-control mandatory regression appears.
- PHONE_MODE begins only after true QWEN_CORE_DONE + NOTION_CORE_DONE.

## Deterministic guards
- `autopilot/v2/tools/validate_control_state.py` is the fail-fast structural check for lane/manifest/claim consistency.
- Any structural validation error blocks new mutable work until reconciled.
- Repeated reasoning loops should become deterministic tools when feasible; prefer machine checks for authority binding, secret leakage, branch scope, exact-head evidence and external-run harvesting.
