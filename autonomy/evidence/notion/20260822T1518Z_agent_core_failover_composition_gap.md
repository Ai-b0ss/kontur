# Notion Agent↔Core protected-failover composition gap

Date: 2026-08-22
Mode: read-only integration review of exact current sources; no Notion/provider traffic.

## Exact inputs

Agent PR #8 head at review: `eaa7e812cb502649fb5291143070b33bfc94380e`.

Frozen product preimages on that head:
- `payload/account_pool.py` blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`;
- `payload/server.py` blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/reservation_aware_lease.py` blob `c77b4d5214911def1729243516aec73e43f8d425`.

Core V41 candidate:
`autonomy/evidence/notion/20260822T1155Z_v41_accountlease_failover_optout_exact_candidate.patch`.

Agent materializers reviewed:
- `tools/apply_account_pool_dynamic_reservation.py` blob `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- `tools/apply_startup_status_cleanup.py` blob `2ed85ece7d3323b1619ec0963d3021c1623d0e0a`;
- `tools/materialize_agent_wiring.py` blob `87e62344acf93a0298aac8a7c3139216336162d1`.

## Proven integration gap

Core V41 adds caller-controlled `AccountLease.run(..., allow_failover=False)` so a protected post-intent operation cannot implicitly switch account and repeat provider work.

Agent materialization changes the ordinary Responses path from a direct `AccountLease` context to `DynamicReservationLeaseSession`, and changes the first completion call from `lease.run(...)` to `lease.run_selected(...)`.

Current `DynamicReservationLeaseSession` does **not** expose or forward `allow_failover`. Its `_run()` always calls the underlying `lease.run(...)` with the legacy arguments. Therefore, after Agent materialization, simply applying V41 to `AccountLease.run` is insufficient: the protected Core flag cannot reach the underlying lease for the materialized first Responses call (and any later dynamic-session call).

This is a real safety composition boundary, not a cosmetic API mismatch. A Core Stage-B candidate tested only against the frozen old `server.py` can prove `allow_failover=False` at three old `lease.run` callsites while the later Agent-materialized server has replaced at least the first of those callsites with `run_selected`, silently restoring default failover unless the wrapper propagates the flag.

## Exact-transform ordering conflict

Both lanes currently transform the same frozen preimages:
- Agent `apply_account_pool_dynamic_reservation.py` hard-requires account-pool blob `11cea792...`;
- Agent `apply_startup_status_cleanup.py` hard-requires server blob `f02cef6a...`;
- Core V41 changes `account_pool.py`;
- Core Stage-B orchestration is being designed against the same old `server.py` callsites.

So independently landing either lane first can invalidate the other lane's exact-source materializer or its callsite proof. Final integration must be tested on the **composed materialized pair**, not by inheriting two separate preimage PASS claims.

## Safe composition rule

1. Preserve Agent defaults: ordinary Agent rotation remains `allow_failover=True`.
2. Add an explicit `allow_failover` surface to `DynamicReservationLeaseSession.run_selected/run/_run` and forward `False` to the real `AccountLease.run` only when Core requests protected mode. Default-True calls should retain the current call shape so existing fake/test leases are not unnecessarily broken.
3. After strict durable provider-intent publication, Core must set `allow_failover=False` on every deliberate planner step **through the materialized dynamic-session API**, including the first `run_selected`, correction rounds, and compaction path where applicable.
4. Reservation-driven reselection that occurs before provider entry remains allowed: `_LeaseAccountBecameReserved` is a local routing signal and is handled outside AccountLease failover. Protected mode must suppress provider-error failover, not safe pre-provider reservation reselection.
5. Compose account-pool changes deterministically: Agent dynamic-reservation transform and Core V41 must become one reproducible transform/order with a new post-composition blob expectation. Do not let V41 land first and then continue claiming the old Agent materializer can still consume `11cea792...`.
6. Re-run the full Agent materialized pair + Core Stage-B negative matrix on the composed bytes before Windows/Circle.

Candidate wrapper patch staged at:
`autonomy/v3/candidates/NOTION_AGENT_CORE_ALLOW_FAILOVER_COMPOSITION_20260822.patch`.

## Required regression before acceptance

At minimum prove on the composed source:
- default Agent dynamic session still allows the existing legitimate failover path;
- protected `run_selected(..., allow_failover=False)` forwards the flag to AccountLease;
- protected later `run(..., allow_failover=False)` also forwards it;
- late foreground reservation before provider entry can still reselect safely;
- ambiguous transport after durable intent performs one deliberate provider step, zero account switch, no outer implicit retry, unresolved intent preserved;
- the same invariant holds for planner correction and compaction;
- exact Agent materializer preimages/hashes are updated to the composed order rather than bypassed.

No product branch was changed by this review.