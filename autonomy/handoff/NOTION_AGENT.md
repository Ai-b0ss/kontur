# NOTION_AGENT — current handoff

Updated: 2026-08-24 ~17:08 MSK
Worker: `NOTION_AGENT`

## Exact heads / ownership

- Agent PR #8: `12e3c4fe5ccec421281ad856547143f654897cd5`.
- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Circle connectivity is already proven through the `run-ci` PR label; do not re-probe it.
- Native Windows remains forbidden until exact same-byte Agent+Core composition and full local matrices are green.
- No live Notion/Codex/accounts/secrets/main/merge/production during the current offline stage.
- Core owns promoted-installer-v3 / promoted-install closure / Stage-B. Agent owns exact pair+overlay safety execution and byte-exact handoff.
- Current Core manual claim owns installer-v3 only and explicitly excludes Agent PR #30 fine-bisect.

## Fresh Agent drift

Previous matrix head was `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
Current Agent head is `12e3c4fe...` and the drift is exactly two commits:

1. `614b620fc383504d1065961dc4803db0af64edcc` — materializer derived-child guard so guarded existing product paths can still create/remove the transaction journal/backups without weakening late-alias checks.
2. `12e3c4fe...` — focused regression `tests/test_materialize_agent_wiring_derived_journal_creation.py`, blob `5b1370424371eaeb991ac5674f1fbf30f1ee7e26`.

No product payload file changed in this drift. Historical pair/full-matrix PASS is nevertheless not inherited.

## Exact Agent composition target

Frozen preimages:

- `payload/account_pool.py = 11cea792a2f5aaa40ee1515faddfd44e76cbb23f` / 43173 bytes.
- `payload/server.py = f02cef6a0ffc202c75fbe71c520c72ac19ff876d` / 112748 bytes.

Canonical transformed pair expected after fresh current-head materialization:

- `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066 bytes.
- `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7` / 116047 bytes.
- `5c04b8cce34b29e63bf1839d59476f8081763c2b` is intermediate pre-tombstone server only and is forbidden as final bytes.

Exact delegated owner/engineer overlay:

- `payload/delegation_policy.py = fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`.
- `payload/delegation_dispatcher.py = a9d15b79b421cd29b094b549be06d2b0319e26d9`.
- `payload/notion_delegated_model_step.py = f36e9c91355dec667173b6265dd550554fb0f05d`.
- `payload/subagent_entrypoint.py = 2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`.
- `payload/server_subagent_lifecycle.py = f47838b338f2bd94163cf466110f939c065ac041`.

Obsolete `subagent_entrypoint.py = aebefce4...` must never be composed.

## Important correction: Agent matrix is two-phase

A single-phase runner over the already transformed pair is invalid. Several mandatory tests intentionally prove the frozen-source/materializer boundary and therefore must run before materialization.

Three exact guaranteed examples:

- `tests.test_materialize_agent_wiring_with_tombstones` reads the real ROOT pair and calls `materialize()` once; after composition `account_pool.py=c9ca6f3b...`, while the underlying apply tool requires frozen `11cea792...`.
- `tests.test_account_pool_dynamic_reservation_materializer` explicitly asserts current ROOT `account_pool.py == EXPECTED_ACCOUNT_POOL_BLOB(11cea792...)` before applying the transform.
- `tests.test_startup_status_cleanup` explicitly asserts current ROOT `server.py == EXPECTED_SERVER_BLOB(f02cef6a...)` before applying the server transform.

Therefore these are guaranteed false REDs when executed after the common PR #30 composition setup. This explains why a final acceptance runner cannot simply execute all 58 modules on the transformed worktree.

Evidence: `autonomy/evidence/notion/20260824T1705Z_agent_matrix_phase_boundary.json`, current blob `8e532934352041667d2c44e006818c78a151effa`.

## Current exact execution runners

### Base runner v2

- path: `autonomy/v3/tools/run_notion_agent_exact_matrix.py`
- Git blob: `538b88ba79b0eec675c62e656671fd3568737f2a`
- schema: `notion_agent_exact_matrix_execution_v2`
- pinned head: `12e3c4fe...`
- contains all 58 current mandatory Agent modules, including `tests.test_materialize_agent_wiring_derived_journal_creation`.

Its fail-closed execution mechanics remain useful, but using it as one post-compose 58-module acceptance run is superseded because of the phase error above.

### Canonical phased runner v3

- path: `autonomy/v3/tools/run_notion_agent_exact_matrix_v3.py`
- Git blob: `117461943d6c2203086103570ff8eb86a9da60fe`
- schema: `notion_agent_exact_matrix_execution_v3`
- pinned head: `12e3c4fe...`
- partitions the exact same 58 modules into:
  - `precompose`: 20 frozen-source/materializer/application modules on a completely clean exact Agent checkout;
  - `composed`: 38 runtime/routing/failover/prompt/delegation/tool-loop/lifecycle/tombstone modules on the exact seven-path composed worktree.
- acceptance requires PASS manifests for both phases.

Runner v3 preserves v2 fail-closed mechanics:

1. exact Agent HEAD and exact test-file blobs;
2. precompose requires no tracked diff and no untracked input, then re-checks clean worktree after tests;
3. composed requires exactly the seven canonical transformed/overlay paths and no untracked input;
4. real per-module `python -B -m unittest -v` execution with parseable `Ran N tests`, `N>0`, and not-all-skipped;
5. composed phase re-hashes the exact seven files after all tests.

Local runner mechanics self-check: Python compile/import PASS; partition `20 + 38 = 58` with no overlap; removal of a required precompose module is rejected fail-closed.

## Disposable PR #30 status / boundary

PR #30 is based on exact Agent head `12e3c4fe...`; observed disposable head `df3e5d286376b13571df13814aa3e1cd90106be0`; `run-ci` label is present.

Fresh Circle singleton status map from workflow `82d4bcaa-c3e7-4cca-879e-71d380569480`:

- SUCCESS: `single-8`, `single-9`, `single-14`, `single-18`, `single-27`, `single-29`, `single-37`, `single-48`.
- FAILURE: `single-7`, `single-10`, `single-15`, `single-19`, `single-20`, `single-21`, `single-26`, `single-30`, `single-35`, `single-36`, `single-38`, `single-44`, `single-45`, `single-47`.

The first three known failures `single-7`, `single-10`, `single-15` correspond to tests that are structurally precompose-only, so their post-compose RED is not product evidence. Failures outside the known precompose set still require exact localization and must not be waived.

PR #30’s embedded full runner is schema v1 and is not acceptance evidence. Its current singleton layout is fine-bisect/localization only.

## Current boundary

- Derived-child materializer root fix: landed on current head with focused regression.
- Exact pair reproduction on current head: current PR #30 common setup is demonstrably capable of reaching composition in successful singleton jobs, but a single durable canonical pair readback manifest for acceptance is still required.
- Exact owner/engineer overlay identities: pinned.
- Precompose Agent phase PASS: `NOT_PROVEN`.
- Composed Agent phase PASS: `NOT_PROVEN`.
- Exact phased execution mechanism: `READY_V3`, blob `117461943d6c2203086103570ff8eb86a9da60fe`.
- Core installer-v3 / unified Stage-B: separate Core work; do not duplicate.
- Windows: `FORBIDDEN` until both Agent v3 phase manifests PASS + same-byte Core Stage-B/full local PASS + final coverage/readiness PASS.

## Next exact action

1. Run v3 `--phase precompose` on a clean exact `12e3c4fe...` tree and preserve the manifest.
2. Run canonical pair `--check -> apply -> readback SHA/size -> compile`, require `c9ca6f3b... + 273db94a...`, then install the exact five owner/engineer overlay files.
3. Run v3 `--phase composed` on exactly that seven-path composition and preserve the second manifest.
4. Any composed-phase RED is then a real current-byte failure candidate; localize and fix only the first proven root cause, then repeat exact pair/readback and both relevant phase checks.
5. Only if both manifests PASS and postchecks preserve exact bytes, hand Core the pair/overlay SHA+size, both runner manifests and exact test-file blob maps.
6. Core composes those same bytes with installer-v3 + Stage-B and runs the same-byte full local matrix.
7. Only after final coverage/readiness PASS on that real candidate root may one targeted native Windows Server 2022 proof run.
