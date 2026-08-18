# AUTOPILOT CONTROL v2.1

Authority order: current owner requirements > reproducible current-source evidence > versioned acceptance manifest > current lane state > historical evidence > audit log.

## Execution model
- A ChatGPT Task invocation is a SHORT PULSE. Assume 4–12 minutes. Elapsed time and loop count are never success criteria.
- A pulse must finish one atomic engineering result: localize one exact failure; implement one evidence-backed fix plus targeted regression; launch one durable external proof and persist its identity; or harvest/classify one external proof.
- Work expected to exceed ~90 seconds belongs to an external executor. Persist executor/run identity and release the mutable claim instead of waiting.
- Scheduler allocates by READY critical-path value, not by historical project ownership or fairness.

## Current state, acceptance and evidence
- `Ai-b0ss/kontur#9` is AUDIT LOG / provenance only. It is not current machine state.
- Current machine state is `autopilot/v2/lanes/*.json` on branch `autopilot/control-v2-20260819`.
- Mandatory product requirements live in `autopilot/v2/acceptance/<acceptance_version>.json`. A lane may not claim CORE_DONE unless every mandatory row in its manifest is PASS.
- Every NEW evidence claim must name an acceptance row id and bind: exact SHA, proof surface, oracle, run/artifact identity, result, and invalidation dependencies. Legacy free-text evidence may be inherited until the lane is next materially rewritten, but it cannot newly close an acceptance row without that binding.
- An executor-only change does not invalidate unchanged product evidence. Re-run expensive/live proof only when a named dependency changed or a mandatory row has never been proved.
- CI conclusion is not product semantics. `steps=null`, harness failure, inverted diagnostic jobs and product failure are distinct classes.
- Invalidation is narrow: change only reopens acceptance rows whose named dependencies/proof surfaces changed.

## Claims / WIP
- One mutable writer per lane.
- Claim lease maximum 15 minutes. No long TTL. A pulse ending or entering WAIT_EXTERNAL releases the mutable claim.
- One external proof per lane unless explicitly independent and non-overlapping.
- No duplicate run while an equivalent external run is unresolved.
- A retry requires `new_information_expected`; otherwise pivot.
- A claim must pin expected product head. Before every mutation re-read branch HEAD and relevant blob SHA; abort/replan on drift.

## Provider safety
- Qwen and Notion each have one provider-live lease. No same-provider fan-out.
- Rate/quota may cool an account and permit eligible failover.
- WAF/CAPTCHA/trust/explicit restriction/ambiguous post-send state must not probe sibling accounts; stop or open provider-pressure circuit.
- Never rotate to bypass provider restrictions.

## Writes and branches
- Never write default/main or production merely for proof.
- Keep unrelated work out of product branches. Diff must match the work packet.
- A proven product defect may have at most one extra test-only diagnostic commit before product patch or explicit reclassification.
- Archaeological patch towers are temporary evidence machinery, not promoted architecture. After the root cause is green on the strongest required oracle, materialize a clean canonical candidate and prove equivalence before promotion.

## Secrets and executors
- No secret in argv/log/hash/fingerprint/artifact.
- Use stdin/passphrase-fd or equivalent non-argv channel; `set +x`; restrictive temp permissions; always-cleanup.
- Secret-bearing self-hosted runners must run with a scrubbed child environment and immutable trusted workflow/ref.
- Long jobs belong to durable external executors; ChatGPT stores run identity and pivots. Waiting is not work.

## DONE
- DONE is row-by-row acceptance, not nearest-gate green.
- Source/string tests can prove SOURCE_INVARIANT only; runtime/visual behavior needs the appropriate oracle.
- `CORE_DONE` must include the exact acceptance version and evidence refs for all mandatory rows.
- AI_MIRRORS is frozen CORE_DONE unless a new post-control mandatory regression appears.
- PHONE_MODE starts only after true QWEN_CORE_DONE + NOTION_CORE_DONE.

## Deterministic guard
- `autopilot/v2/tools/validate_control_state.py` is the fail-fast structural check for lane/manifest/claim consistency. Run it whenever an executor has the control branch checkout; any validation error blocks new mutable work until reconciled.
