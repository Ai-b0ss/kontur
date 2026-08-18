# AUTOPILOT CONTROL v2

Authority order: current owner requirements > reproducible current-source evidence > current lane state > historical evidence > audit log.

## Execution model
- A ChatGPT Task invocation is a SHORT PULSE. Assume 4–12 minutes. Elapsed time and loop count are never success criteria.
- A pulse must finish one atomic engineering result: localize one exact failure; implement one evidence-backed fix plus targeted regression; launch one durable external proof and persist its identity; or harvest/classify one external proof.
- Work expected to exceed ~90 seconds belongs to an external executor. Persist executor/run identity and release the mutable claim instead of waiting.

## State and evidence
- `Ai-b0ss/kontur#9` is AUDIT LOG / provenance only. It is not current machine state.
- Current machine state is `autopilot/v2/lanes/*.json` on branch `autopilot/control-v2-20260819`.
- Every evidence claim must bind: exact SHA, proof surface, oracle, run/artifact identity, result, and invalidation dependencies.
- An executor-only change does not invalidate unchanged product evidence. Re-run expensive/live proof only when a named dependency changed or a mandatory row has never been proved.
- CI conclusion is not product semantics. `steps=null`, harness failure, inverted diagnostic jobs and product failure are distinct classes.

## Claims / WIP
- One mutable writer per lane.
- Claim lease maximum 15 minutes. No long TTL. A pulse ending or entering WAIT_EXTERNAL releases the mutable claim.
- One external proof per lane unless explicitly independent and non-overlapping.
- No duplicate run while an equivalent external run is unresolved.
- A retry requires `new_information_expected`; otherwise pivot.

## Provider safety
- Qwen and Notion each have one provider-live lease. No same-provider fan-out.
- Rate/quota may cool an account and permit eligible failover.
- WAF/CAPTCHA/trust/explicit restriction/ambiguous post-send state must not probe sibling accounts; stop or open provider-pressure circuit.
- Never rotate to bypass provider restrictions.

## Writes and branches
- Never write default/main or production merely for proof.
- Before repo mutation: re-read current branch HEAD and relevant blob SHA; abort/replan on drift.
- Keep unrelated work out of product branches. Diff must match the work packet.
- A proven product defect may have at most one extra test-only diagnostic commit before product patch or explicit reclassification.

## Secrets
- No secret in argv/log/hash/fingerprint/artifact.
- Use stdin/passphrase-fd or equivalent non-argv channel; `set +x`; restrictive temp permissions; always-cleanup.
- Secret-bearing self-hosted runners must run with a scrubbed child environment and immutable trusted workflow/ref.

## DONE
- DONE is row-by-row acceptance, not nearest-gate green.
- Source/string tests can prove SOURCE_INVARIANT only; runtime/visual behavior needs the appropriate oracle.
- AI_MIRRORS is frozen CORE_DONE unless a new post-control mandatory regression appears.
- PHONE_MODE starts only after true QWEN_CORE_DONE + NOTION_CORE_DONE.
