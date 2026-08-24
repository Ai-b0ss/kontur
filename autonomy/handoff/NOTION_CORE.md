# NOTION_CORE — current handoff

Updated: 2026-08-24 ~11:3x MSK
Worker: `NOTION_CORE`

## Exact heads / policy

- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Circle connectivity is already proven; do not re-probe it.
- Native Windows remains forbidden until exact same-byte Agent+Core candidate and full local matrix are green.
- No live Notion/Codex/accounts/secrets/main/merge/production before engineering gates.

## Exact Agent composition input

Fresh Agent pair remains:

- `payload/account_pool.py` = `c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066 bytes;
- final `payload/server.py` = `273db94a8f9b153e95c910df221755e28c0f46a7` / 116047 bytes.

Corrected delegated owner/engineer overlay:

- `payload/delegation_policy.py` = `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `payload/delegation_dispatcher.py` = `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `payload/notion_delegated_model_step.py` = `f36e9c91355dec667173b6265dd550554fb0f05d`;
- `payload/subagent_entrypoint.py` = `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`;
- `payload/server_subagent_lifecycle.py` = `f47838b338f2bd94163cf466110f939c065ac041`.

Agent full mandatory matrix on exact pair+overlay is still not transferred as green. Historical Agent PASS is not sufficient.

## Stage A / Stage B already proven locally

Stage A V32 fail-closed floor is locally green on exact source.

Current durable Stage-B pieces:

- store candidate on `conversation_segments.py` exact preimage `553bd349...`: blob `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`;
- transaction helper: `autonomy/evidence/notion/20260824T0403Z_stageb_transaction_helper.py`, blob `b3fe792b99daad678e3c773db291576bdf179167`;
- transaction helper exact regression: blob `478fa18a2917861917ade1a444735757e6d75198`, targeted 12/12 plus store+helper integration 11/11;
- stream failure projection candidate: `a094a4b5484384037fb02c07d345b73531a46091`, regression `8d5fadf31aeff034d09e9943b25249402a2207b0`, 10/10;
- server-owned lock boundary candidate: `2f92c2abe56e2d4be39c4930a63dd876aca52294`, regression `b280001743064a86b61306c160820d9b88329672`, 6/6.

These are component proofs, not one unified same-byte Stage-B PASS yet.

## NEW blocking gap — promoted installer payload closure

Fresh revalidation on exact current heads found that the Core promoted installer cannot yet prove/deploy the local module closure required by the materialized Agent server.

Exact Core `integrated_upgrade.py` blob `0f4393e656307e3b17dfab105464de551f12a05d` currently writes only `PAYLOAD_NAMES` into `<project_root>/bridge/<name>`:

`server.py, account_pool.py, diagnostics.py, auth_contract.py, migration_contract.py, stable_identity.py, stable_runtime_state.py, thread_state_registry.py, transport_evidence.py, conversation_segments.py`.

It separately exact-verifies only `notion_images.py` and `turn_affinity.py` as static bridge dependencies.

But exact Agent server preimage `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` directly imports local modules not covered by that installer set:

- `prompt_modes.py`;
- `server_subagent_lifecycle.py`.

The exact Agent server materializer also adds top-level `reservation_aware_lease.py`.

Further, current `payload/server_subagent_lifecycle.py` blob `96b07cf8e8069586b33b516a1d66e38b6439a4f9` imports package-local modules such as `payload.delegation_dispatcher`, `payload.delegation_policy`, `payload.notion_delegation_adapter`, `payload.notion_subagent_runtime`, `payload.server_subagent_runtime`, `payload.subagent_entrypoint`, and `payload.subagent_tombstone_store`. Current `PAYLOAD_NAMES` does not install that package graph.

Therefore a same-byte source-tree matrix alone is insufficient: the promoted runtime could pass source tests and then fail import/lose Agent functionality after installation. This is a current reproducible acceptance blocker, not a historical NCM issue.

Durable evidence:

- `autonomy/evidence/notion/20260824T1125Z_promoted_install_payload_closure_gate.json`;
- regression candidate `autonomy/evidence/notion/20260824T1115Z_test_promoted_install_payload_closure.py`, blob `46a9ff0661d8e4d87433614d1fd0bcf351239152`.

Required product-side boundary: before lifecycle/source mutation the installer must know the complete local import closure, deploy or exact-hash-verify it under import-correct target paths, and include every managed target in durable backup/journal/rollback/installed-marker verification. Do not paper over this with ambient `PYTHONPATH` assumptions.

## Final local coverage / Windows admission

The final gate was hardened so this installer gap cannot be forgotten.

- coverage verifier is now blob `8254f36b14fb240c7d6466c7241d2d735ea310d9` and requires `tests.test_promoted_install_payload_closure` to exist and be executed;
- Windows readiness is now schema `notion_windows_ready_candidate_v12`, blob `0b53153f2ea424d989692bfe0f8a7b6faa36c897`;
- readiness v12 requires `promoted_install_payload_closure=PASS`;
- readiness v12 also binds and re-hashes the exact composed `integrated_upgrade.py`, so an installer fix cannot drift independently of the local matrix manifest.

Local negative controls passed: missing closure regression is rejected by coverage; missing closure gate is rejected by readiness; one-byte/manifest drift in `integrated_upgrade.py` is rejected.

No Windows run has been started.

## Next exact order

1. Agent independently finishes full mandatory matrix on exact pair + five-file owner/engineer overlay; Core does not duplicate that owned work.
2. Core fixes the promoted install payload-closure contract on exact `integrated_upgrade.py`, with targeted regression proving incomplete closure fails before lifecycle/source mutation and complete closure is journaled/backed-up/rolled-back/verified.
3. Compose the same exact Agent bytes + Stage-B store/transaction/stream/lock + installer closure fix into one candidate.
4. Run full same-byte Agent+Core matrix including `tests.test_stageb_transaction_helper` and `tests.test_promoted_install_payload_closure`.
5. Coverage `8254f36b...` PASS -> readiness v12 `0b53153f... --candidate-root` PASS.
6. Only then run one targeted native Windows Server 2022 proof on those exact bytes.
7. Targeted Windows PASS -> promoted Ubuntu+Windows/exact-source/security gate -> owner-doctor -> isolated runtime restore -> real Codex-only bridge→Notion/tool/rotation/restart/soak acceptance.

PR #7/#8 refs were not moved in this run; Circle/Windows/live Notion/Codex were not used.
