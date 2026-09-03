# AUTOPILOT v4.1 control plane

This branch is the machine control surface for the completion phase. It exists so workers do **not** reconstruct scheduler truth from long GitHub issue threads.

## Sources of truth

1. `state.json` — authoritative current scheduler state.
2. `state.schema.json` — structural contract for `state.json`.
3. Public reusable executable invariants live in `Ai-b0ss/free-fabric-ci` `autopilot/state_machine.py` / `autopilot/provider_outcomes.py`.
4. `kontur#30` — human acceptance requirements only.
5. `kontur#31` — compact audit/event log only. Comments are **not** scheduler state.

The body or comments of #30/#31 may be stale. A worker must not infer current packet ownership, SHA, gate state or executor state from them when `state.json` is readable.

## Transaction protocol

All scheduler mutations use GitHub Contents optimistic concurrency:

1. fetch `autopilot/control/state.json` on branch `autopilot/v4-control-plane` and retain its current blob SHA;
2. validate the fetched snapshot and the proposed next snapshot against scheduler invariants before writing;
3. compute the smallest state transition and increment `generation` exactly once;
4. call `update_file` with that exact blob SHA;
5. if GitHub rejects because the SHA is stale, **do not overwrite** — refetch, reconcile and retry once;
6. after a successful write, refetch canonical state and verify the expected generation/owner/state actually landed;
7. only then may a worker append a concise audit event to #31.

This makes the file blob SHA the compare-and-swap token. There is no text-only advisory lease.

## Lease and transition rules

A packet has one `owner_slot` and a monotonically increasing `lease_epoch`. A worker may mutate product/proof infrastructure for a packet only if canonical state names that worker as owner. A worker owns at most one packet. Reassignment requires a successful CAS state update first.

- `READY` packets are unowned and are the only packets directly claimable.
- `RUNNING` packets must have one owner.
- `BLOCKED` packets are not directly claimable/retryable. They remain with their current owner or are explicitly released; resuming them requires fresh unblock evidence and a state transition.
- `DONE` / `DEFERRED` packets are unowned terminal states.
- A DONE packet cannot depend on unfinished packets.
- Dependency cycles, worker/packet ownership mismatches, duplicate ownership and mutable-WIP overflow fail closed.

Read-only packets can run concurrently. Product mutation still obeys `max_mutable_product_wip`.

## Mutable branch lifecycle

Every mutable repository packet must specify a deterministic execution location: `repo`, `branch`, and either an exact `base_sha` or an unambiguous `base_ref`. If the branch does not exist, the owner creates it exactly from that recorded base. If the base is missing or ambiguous, the worker must not guess; Director fixes canonical state first.

For reusable public packets intended to become part of a shared public surface, record `integration_target`. Green CI on an isolated worker branch is necessary but not sufficient for DONE: the proven changes must be integrated into the target without force, followed by replacement GREEN CI on the integrated exact head. A packet may skip integration only when its contract explicitly declares it a standalone artifact.

## Event rules

Issue comments are observability only. A worker never scans the full issue to discover state. Important evidence is written into the packet's compact `evidence` array in `state.json`; #31 receives only a short human-readable mirror after CAS success.

## Blocker classes

- `PRODUCT_BLOCKER`: reproduced release/product defect.
- `PROOF_FAILURE`: required proof actually executed and failed.
- `INFRA_NO_START`: executor/pipeline never ran.
- `EXECUTOR_CONTROL_BLOCKED`: job is prepared but no legitimate trigger/control path is currently executing it.
- `AUTH_EXPIRED`: a particular provider credential/session is actually rejected as expired/invalid; account/session health, not automatically a product failure.
- `ACCOUNT_CAPABILITY_RESTRICTED`: the tested account is valid but the requested provider feature/AI entitlement is unavailable for that account; account health only.
- `PROVIDER_TRUST_DENIAL`: explicit trust/safety/abuse denial; do not bypass by sibling-account rotation.
- `RATE_LIMIT`: provider/account temporary capacity condition; apply normal cooldown/failover policy.
- `EXTERNAL_CAPABILITY_BLOCKED`: required external capability unavailable to all legitimate current executors/accounts.

## Provider preflight

Before F51, Qwen and Notion each need an actual-provider preflight close to the F51 run. Account outcomes are evaluated independently:

- any legitimately configured eligible account returning GREEN satisfies that provider preflight;
- `ACCOUNT_CAPABILITY_RESTRICTED`, `AUTH_EXPIRED` and `RATE_LIMIT` may use normal configured-account failover/cooldown;
- exhausting all legitimate accounts yields a pool/external blocker, not a Desktop/F51 product defect;
- explicit `PROVIDER_TRUST_DENIAL` stops account rotation immediately.

Never use account rotation to evade an explicit trust/safety/abuse restriction.

## Execution topology

- Public reusable CI / protocol / scheduler / acceptance / release / transport / traceability tooling: `Ai-b0ss/free-fabric-ci` on public GitHub Actions.
- Private product/provider-native proof: a legitimate private executor holding the encrypted runtime channel. Circle remains valid when triggerable; private self-hosted GitHub Actions is also valid when its designated runner is online.
- Cursor capacity is unavailable until 2026-09-18 and must not be treated as an executor option before then.
- Private GitHub-hosted runner quota is unavailable; self-hosted runners are tracked separately.
- Never move private product bytes or provider credentials into public CI solely to gain runner capacity.

## Liveness and stop rules

- Frozen RC stays untouched unless a blocking/high product defect is reproduced.
- `EXECUTOR_CONTROL_BLOCKED` gets one bounded genuinely new diagnosis/switch attempt, then remains explicit while other workers take disjoint READY work.
- A blocked packet must not consume repeated hourly no-op attempts.
- If automation management is available, Director checks that all five required slots are enabled. If an owning worker misses more than two expected cadences, Director first verifies/re-enables it; if it remains stale on the next scheduler cycle, Director may safely release/reassign the lease through CAS without modifying product bytes.
- Five V4 automations remain enabled until the user explicitly disables them.
