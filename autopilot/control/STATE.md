# AUTOPILOT v4.1 control plane

This branch is the machine control surface for the completion phase. It exists so workers do **not** reconstruct scheduler truth from long GitHub issue threads.

## Sources of truth

1. `state.json` — authoritative current scheduler state.
2. `state.schema.json` — structural contract for `state.json`.
3. `kontur#30` — human acceptance requirements only.
4. `kontur#31` — compact audit/event log only. Comments are **not** scheduler state.

The body or comments of #30/#31 may be stale. A worker must not infer current packet ownership, SHA, gate state or executor state from them when `state.json` is readable.

## Transaction protocol

All scheduler mutations use GitHub Contents optimistic concurrency:

1. fetch `autopilot/control/state.json` on branch `autopilot/v4-control-plane`;
2. retain its current blob SHA;
3. compute the smallest state transition;
4. call `update_file` with that exact blob SHA;
5. if GitHub rejects because the SHA is stale, **do not overwrite** — refetch, reconcile and retry once;
6. only after a successful state commit may a worker append a concise audit event to #31.

This makes the file blob SHA the compare-and-swap token. There is no text-only advisory lease.

## Lease rules

A packet has one `owner_slot` and a monotonically increasing `lease_epoch`. A worker may mutate product/proof infrastructure for a packet only if the fetched state names that worker as owner. Reassignment requires a successful CAS state update first.

Read-only packets can run concurrently. Product mutation still obeys `max_mutable_product_wip`.

## Event rules

Issue comments are observability only. A worker never scans the full issue to discover state. Important evidence is written into the packet's compact `evidence` array in `state.json`; #31 receives only a short human-readable mirror after CAS success.

## Blocker classes

- `PRODUCT_BLOCKER`: reproduced release/product defect.
- `PROOF_FAILURE`: required proof actually executed and failed.
- `INFRA_NO_START`: executor/pipeline never ran.
- `EXECUTOR_CONTROL_BLOCKED`: job is prepared but no legitimate trigger/control path is available.
- `AUTH_EXPIRED`: provider credentials/session are actually rejected as expired/invalid.
- `ACCOUNT_CAPABILITY_RESTRICTED`: the tested account is valid but the requested provider feature/AI entitlement is unavailable for that account. This is **account health**, not a system/product blocker. Mark that account ineligible and test the next legitimately available eligible account if the provider contract permits normal failover. Do not rotate accounts to evade an explicit trust/safety/abuse denial.
- `PROVIDER_TRUST_DENIAL`: explicit trust/safety/abuse denial; do not bypass by sibling-account rotation.
- `RATE_LIMIT`: provider/account temporary capacity condition; apply existing cooldown/failover policy.
- `EXTERNAL_CAPABILITY_BLOCKED`: required external capability unavailable to all legitimate current executors.

## Provider preflight

Before F51, Qwen and Notion each need an actual-provider preflight close to the F51 run. For Notion, distinguish session expiry from account-specific AI restriction. A valid account whose AI entitlement is unavailable is removed/cooldown-marked from the current provider pool and is not counted as a failure of Desktop/F51 itself.

## Execution topology

- Public, reusable CI / protocol / scheduler / release tooling: `Ai-b0ss/free-fabric-ci` on public GitHub Actions.
- Private product/provider-native proof: Circle/private executor holding the encrypted runtime channel.
- Cursor capacity is unavailable until 2026-09-18 and must not be treated as an executor option before then.
- Never move private product bytes or provider credentials into public CI solely to gain runner capacity.

## Stop rules

- Frozen RC stays untouched unless a blocking/high product defect is reproduced.
- `EXECUTOR_CONTROL_BLOCKED` gets one bounded diagnosis/switch attempt, then becomes an explicit blocked packet; other workers move to disjoint READY work.
- A blocked packet must not consume repeated hourly no-op attempts.
- Five V4 automations remain enabled until the user explicitly disables them.
