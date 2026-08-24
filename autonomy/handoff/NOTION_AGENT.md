# NOTION_AGENT — current handoff

Updated: 2026-08-24 ~12:50 MSK
Worker: `NOTION_AGENT`

## Exact current heads / policy

- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Circle connectivity is already proven; do not re-probe it.
- Native Windows remains forbidden until exact same-byte Agent+Core composition and full local matrix are green.
- Do not touch live Notion/Codex/accounts/secrets/main/merge/production during the current offline composition stage.

## Exact Agent composition input

Frozen preimages:

- `payload/account_pool.py = 11cea792a2f5aaa40ee1515faddfd44e76cbb23f` / 43173 bytes.
- `payload/server.py = f02cef6a0ffc202c75fbe71c520c72ac19ff876d` / 112748 bytes.

Fresh current-head isolated materialization/readback/compile target:

- final `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066 bytes.
- final `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7` / 116047 bytes.
- `5c04b8cce34b29e63bf1839d59476f8081763c2b` is only the intermediate server before tombstone wiring and is forbidden as the final Agent server byte.

Exact delegated owner/engineer overlay required for the Agent matrix:

- `payload/delegation_policy.py = fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`.
- `payload/delegation_dispatcher.py = a9d15b79b421cd29b094b549be06d2b0319e26d9`.
- `payload/notion_delegated_model_step.py = f36e9c91355dec667173b6265dd550554fb0f05d`.
- `payload/subagent_entrypoint.py = 2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`.
- `payload/server_subagent_lifecycle.py = f47838b338f2bd94163cf466110f939c065ac041`.

Obsolete `subagent_entrypoint.py = aebefce4...` must not be composed.

## Core-side blocker/pins that supersede older Agent notes

Fresh Core handoff is authoritative for the promoted-installer closure gap:

- current Core coverage verifier before this Agent candidate: `8254f36b14fb240c7d6466c7241d2d735ea310d9`;
- Windows readiness schema v12 blob `0b53153f2ea424d989692bfe0f8a7b6faa36c897`;
- readiness requires `promoted_install_payload_closure=PASS` and re-hashes exact composed `integrated_upgrade.py`.

Core owns installer-v3 / promoted-install closure / Stage-B composition. Agent must not duplicate that mutation surface.

## Agent full-matrix coverage candidate — 2026-08-24 ~12:50 MSK

Independent local-only work hardened the current coverage verifier without touching Core refs.

Current Core coverage blob `8254f36b...` can return PASS while these 12 current Agent negative-path regressions are absent:

- `tests.test_account_pool_reselect_release_abort_contract`
- `tests.test_account_pool_reselect_release_abort_semantics`
- `tests.test_delegated_failover_session`
- `tests.test_materialize_agent_wiring_backup_snapshot`
- `tests.test_materialize_agent_wiring_durability_order`
- `tests.test_materialize_agent_wiring_entry_recovery`
- `tests.test_materialize_agent_wiring_finalize_guard`
- `tests.test_materialize_agent_wiring_hardlink`
- `tests.test_materialize_agent_wiring_journal_exclusive`
- `tests.test_materialize_agent_wiring_journal_path_safety`
- `tests.test_materialize_agent_wiring_late_recovery_guard`
- `tests.test_materialize_agent_wiring_safe`

A strengthened no-ref-movement candidate is now stored as Git blob:

- `verify_notion_final_gate_coverage` candidate = `506e377fd22d44449495398e20768316ba12221d` / 6285 bytes.

Synthetic falsification performed locally:

- full required suite fixture -> `PASS`;
- same fixture with exactly the 12 modules above removed -> `NOT_READY` and all 12 names reported missing.

Durable evidence:

- `autonomy/evidence/notion/20260824T1248Z_agent_full_matrix_coverage_candidate.json`.
- control commit that created evidence: `6be2f6f0b0765486bda4f9e71ec6da1db47e8bb5`.

This candidate is not yet a Core pin and must not authorize Windows by itself. Core may take `506e377f...` or an equivalent reviewed superset only after its independent installer-v3 work is composed.

## Current boundary

- Exact Agent pair reproduction: proven locally on current head.
- Exact five-file owner/engineer overlay identities: proven.
- Full Agent safety matrix on exact pair + overlay: `NOT_PROVEN`.
- Strengthened Agent full-matrix coverage candidate: `READY_FOR_CORE_REVIEW`, blob `506e377f...`.
- Core promoted-installer-v3 / unified Stage-B: `IN_PROGRESS / NOT_PROVEN` per fresh Core handoff.
- Windows: `FORBIDDEN` until both sides are same-byte local green and final coverage/readiness include all required Agent + Core regressions.

## Next exact action

1. Compose `c9ca6f3b... + 273db94a... + fd9a.../a9d.../f36e.../2d576.../f478...` locally.
2. Run the complete Agent suite including the 12 pinned negative-path modules, tombstone post-replace/restart/cancellation, prompt/routing/dynamic-reservation/tool-loop/lifecycle checks.
3. If green, release exact pair/overlay blob SHA + sizes + exact executed module manifest to Core.
4. Core composes the same bytes with installer-v3 + Stage-B and runs the same-byte Agent+Core matrix, using `506e377f...` or an equivalent reviewed coverage superset.
5. Only after strengthened coverage + readiness PASS on that same-byte candidate may one targeted Windows Server 2022 proof run.
