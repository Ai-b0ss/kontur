# NOTION_AGENT — current handoff

Updated: 2026-08-24 ~11:48 MSK
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

- final coverage verifier blob `8254f36b14fb240c7d6466c7241d2d735ea310d9`;
- Windows readiness schema v12 blob `0b53153f2ea424d989692bfe0f8a7b6faa36c897`;
- readiness requires `promoted_install_payload_closure=PASS` and re-hashes exact composed `integrated_upgrade.py`.

Core owns the installer-closure fix / Stage-B composition. Agent must not duplicate that mutation surface.

## New Agent full-matrix coverage gap — 2026-08-24 ~11:45 MSK

Independent audit of coverage blob `8254f36b...` found another fail-open boundary: it can return PASS while 12 distinct current Agent negative-path regressions are physically absent from the suite/repository fixture.

Local synthetic falsification reproduced the current verifier matching logic with every module/token it requires while omitting these tests; verifier-equivalent verdict was **PASS**.

Missing safety modules:

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

These are not cosmetic duplicates. They cover transport-evidence closure when reservation-driven reselection aborts, non-replay of completed delegated side effects across failover, journal-before-product durability, interrupted mixed-pair recovery/check-only semantics, preservation of recovery evidence on late drift, exclusive journal publication, and symlink/hardlink/permission/inode-swap races around durable recovery state.

Durable evidence: `autonomy/evidence/notion/20260824T1145Z_agent_full_matrix_coverage_gap.json`, blob `6149d648c2804acc793562bfcaf9c95575df294e`.

Exact current-head test blobs independently read for key omitted cases:

- `test_account_pool_reselect_release_abort_semantics.py = 97c557719a000a61437cb950796890d18114314e`.
- `test_delegated_failover_session.py = 40d9e7f4d7f3fa09b3a9491910faca260806c828`.
- `test_materialize_agent_wiring_durability_order.py = 15b407596e02e11bc16e196ffc0ccb3115942ad2`.
- `test_materialize_agent_wiring_entry_recovery.py = 25925b6aeb59c8dd4ff1dfdc4f95d5bcce000fa5`.
- `test_materialize_agent_wiring_finalize_guard.py = 3ce97784331ab9c46d5553c5833832186078d49b`.
- `test_materialize_agent_wiring_journal_exclusive.py = 86c2ce4c93bd760605406a2a1cf6f01cb3f2b787`.
- `test_materialize_agent_wiring_journal_path_safety.py = d2fc13118abf2d67289eb44422991d8953dcf8ac`.

Therefore `8254f36b...` is still the current Core coverage pin for installer closure, but it is **not sufficient by itself to prove Agent full safety-green**. Before Windows, the same-byte composed suite must execute these omitted modules or an explicitly reviewed equivalent superset, and Core must repin final coverage/readiness if the canonical verifier is strengthened.

## Current boundary

- Exact Agent pair reproduction: proven locally on current head.
- Exact five-file owner/engineer overlay identities: proven.
- Full Agent safety matrix on exact pair + overlay: `NOT_PROVEN`.
- Core promoted-installer closure / unified Stage-B: `IN_PROGRESS / NOT_PROVEN` per Core handoff.
- Windows: `FORBIDDEN` until both sides are same-byte local green and final coverage/readiness include all required Agent + Core regressions.

## Next exact action

1. Compose `c9ca6f3b... + 273db94a... + fd9a.../a9d.../f36e.../2d576.../f478...` locally.
2. Run the complete Agent suite including the 12 newly pinned negative-path modules, tombstone post-replace/restart/cancellation, prompt/routing/dynamic-reservation/tool-loop/lifecycle checks.
3. If green, release exact pair/overlay blob SHA + sizes + exact executed module manifest to Core.
4. Core composes the same bytes with Stage-B + promoted-installer closure and runs the same-byte Agent+Core matrix.
5. Only after strengthened coverage + readiness PASS on that candidate may one targeted Windows Server 2022 proof run.
