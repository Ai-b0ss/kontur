# NOTION_AGENT — current handoff

Updated: 2026-08-24 ~16:56 MSK
Worker: `NOTION_AGENT`

## Exact heads / ownership

- Agent PR #8: `12e3c4fe5ccec421281ad856547143f654897cd5`.
- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Circle connectivity is already proven through the `run-ci` PR label; do not re-probe it.
- Native Windows remains forbidden until exact same-byte Agent+Core composition and the full local matrices are green.
- No live Notion/Codex/accounts/secrets/main/merge/production during the current offline stage.
- Core owns promoted-installer-v3 / promoted-install closure / Stage-B. Agent owns exact pair+overlay safety execution and byte-exact handoff.
- `MANUAL_ASSIST_NOTION_CORE_INSTALLER_V3` currently owns the Core installer surface and explicitly excludes Agent PR #30 fine-bisect.

## Fresh Agent drift

Previous acceptance-runner head was `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
Current Agent head is `12e3c4fe...` and the drift is exactly two commits:

1. `614b620fc383504d1065961dc4803db0af64edcc` — materializer derived-child guard so guarded existing product paths can still create/remove the transaction journal and backups without weakening late-alias checks.
2. `12e3c4fe...` — new focused regression `tests/test_materialize_agent_wiring_derived_journal_creation.py`, blob `5b1370424371eaeb991ac5674f1fbf30f1ee7e26`.

No product payload file changed in this drift. Historical pair/full-matrix PASS is nevertheless not inherited; current-head materialization + execution proof is required.

## Exact Agent composition target

Frozen preimages:

- `payload/account_pool.py = 11cea792a2f5aaa40ee1515faddfd44e76cbb23f` / 43173 bytes.
- `payload/server.py = f02cef6a0ffc202c75fbe71c520c72ac19ff876d` / 112748 bytes.

Canonical transformed pair expected after fresh current-head materialization:

- `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066 bytes.
- `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7` / 116047 bytes.
- `5c04b8cce34b29e63bf1839d59476f8081763c2b` is an intermediate pre-tombstone server and is forbidden as final Agent server bytes.

Exact delegated owner/engineer overlay required in the composed Agent matrix:

- `payload/delegation_policy.py = fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`.
- `payload/delegation_dispatcher.py = a9d15b79b421cd29b094b549be06d2b0319e26d9`.
- `payload/notion_delegated_model_step.py = f36e9c91355dec667173b6265dd550554fb0f05d`.
- `payload/subagent_entrypoint.py = 2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`.
- `payload/server_subagent_lifecycle.py = f47838b338f2bd94163cf466110f939c065ac041`.

Obsolete `subagent_entrypoint.py = aebefce4...` must never be composed.

## Current exact execution runner

Canonical control-only runner:

- path: `autonomy/v3/tools/run_notion_agent_exact_matrix.py`
- schema: `notion_agent_exact_matrix_execution_v2`
- current Git blob: `538b88ba79b0eec675c62e656671fd3568737f2a`
- pinned Agent head: `12e3c4fe5ccec421281ad856547143f654897cd5`
- new mandatory current-head module: `tests.test_materialize_agent_wiring_derived_journal_creation`
- evidence: `autonomy/evidence/notion/20260824T1654Z_agent_runner_v2_current_head_refresh.json` blob `316205879adc2e165c9a6e15b7832dae4d1ce651`.

Runner v2 requires all of the following before it can say PASS:

1. Git HEAD exactly `12e3c4fe...`.
2. Complete tracked worktree diff exactly the seven transformed pair/owner-overlay paths; any extra tracked drift fails closed.
3. No pre-existing untracked input.
4. Exact transformed pair + exact five-file owner/engineer overlay hashes.
5. Every mandatory test file must match its exact blob at current Agent head.
6. Every module is really executed separately with `python -B -m unittest -v`; return code zero alone is not sufficient.
7. A parseable unittest summary is required with at least one executed test and not-all-skipped.
8. Per-module PASS/FAIL/TIMEOUT, test/skip counts, return code, duration and output hashes are emitted.
9. After the matrix, the complete worktree shape and seven composed blobs are verified again.

The current matrix therefore contains the previous 57 Agent modules plus the new derived-journal regression: 58 mandatory modules.

## Disposable PR #30 boundary

PR #30 `ci/manual-assist-notion-agent-full-matrix-12e3-20260824` is based on exact Agent head `12e3c4fe...`; observed disposable head `df3e5d286376b13571df13814aa3e1cd90106be0`; `run-ci` label is present.

Its current singleton jobs are useful only for fine localization. The embedded full runner in PR #30 is schema v1 and predates both the v2 fail-closed execution protections and the new derived-journal regression. Therefore:

- singleton green/red may localize a module;
- PR #30 embedded v1 full-runner output must not be accepted as final Agent safety evidence;
- final Agent safety proof must use the current control runner blob `538b88ba...` (or an exact later superseding runner recorded here) on the current exact composed bytes.

## Current boundary

- Focused derived-child root fix: proven before product move by disposable PR #28 and landed in current Agent head.
- Exact pair reproduction on current head: `REQUIRES_FRESH_CURRENT_HEAD_PROOF`.
- Exact five-file owner/engineer overlay identities: proven and pinned.
- Full Agent safety matrix on exact pair + overlay: `NOT_PROVEN`.
- Exact current-head execution mechanism: `READY_V2`, blob `538b88ba79b0eec675c62e656671fd3568737f2a`.
- Core installer-v3 / unified Stage-B: separate Core work; do not duplicate.
- Windows: `FORBIDDEN` until Agent v2 execution manifest PASS + same-byte Core Stage-B/full local PASS + final coverage/readiness PASS.

## Next exact action

1. Current Agent matrix owner/fine-bisect should finish current-head localization without treating PR #30 v1 output as final proof.
2. On a clean tree at `12e3c4fe...`, run `tools/materialize_agent_wiring_with_tombstones.py --check`, then apply, read back/compile and require `c9ca6f3b... + 273db94a...`.
3. Compose the exact five owner/engineer files and execute canonical runner blob `538b88ba...`; preserve its v2 JSON manifest.
4. If and only if all 58 modules PASS and post-matrix hashes remain exact, hand Core the pair/overlay SHA+size, runner blob, exact test-file blob map and per-module execution manifest.
5. Core composes those same bytes with installer-v3 + Stage-B and runs the same-byte full local matrix.
6. Only after final coverage/readiness PASS on that real candidate root may one targeted native Windows Server 2022 proof run.
