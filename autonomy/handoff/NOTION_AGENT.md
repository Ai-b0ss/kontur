# NOTION_AGENT — current handoff

Updated: 2026-08-24 ~14:53 MSK
Worker: `NOTION_AGENT`

## Exact heads / policy

- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Circle connectivity is already proven; do not re-probe it.
- Native Windows remains forbidden until exact same-byte Agent+Core composition and full local matrix are green.
- No live Notion/Codex/accounts/secrets/main/merge/production during the current offline stage.
- Core owns promoted-installer-v3 / promoted-install closure / Stage-B. Agent owns only exact pair+overlay Agent safety execution and byte-exact handoff.

## Exact Agent composition

Frozen preimages:

- `payload/account_pool.py = 11cea792a2f5aaa40ee1515faddfd44e76cbb23f` / 43173 bytes.
- `payload/server.py = f02cef6a0ffc202c75fbe71c520c72ac19ff876d` / 112748 bytes.

Canonical transformed pair:

- `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066 bytes.
- `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7` / 116047 bytes.
- `5c04b8cce34b29e63bf1839d59476f8081763c2b` is intermediate pre-tombstone server only and is forbidden as final Agent server bytes.

Exact delegated owner/engineer overlay required in the composed Agent matrix:

- `payload/delegation_policy.py = fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`.
- `payload/delegation_dispatcher.py = a9d15b79b421cd29b094b549be06d2b0319e26d9`.
- `payload/notion_delegated_model_step.py = f36e9c91355dec667173b6265dd550554fb0f05d`.
- `payload/subagent_entrypoint.py = 2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`.
- `payload/server_subagent_lifecycle.py = f47838b338f2bd94163cf466110f939c065ac041`.

Obsolete `subagent_entrypoint.py = aebefce4...` must never be composed.

## Full Agent matrix — execution evidence boundary

Previous coverage candidates (`8254f36b...`, `f521d832...`) are useful discovery/wiring guards but are NOT sufficient proof that tests actually ran: their `_suite_mentions()` logic accepts textual mentions. A synthetic suite containing only comment lines with required module names satisfies the same semantics and can therefore create a false coverage PASS.

New control-only exact execution runner:

- `autonomy/v3/tools/run_notion_agent_exact_matrix.py`
- Git blob: `681e186b73f9dd06b59b098d2c594e19eef16fa1`.
- Evidence: `autonomy/evidence/notion/20260824T1450Z_agent_execution_manifest_gap.json`.

Runner contract:

1. require Git `HEAD == 3cc0c0be34bad1b79555d842cd8fc9755dd26b64`;
2. re-hash exact transformed pair + exact five-file owner/engineer overlay;
3. for every Agent-owned mandatory test module, require the current test file blob to equal the blob at the exact Agent head (no test weakening/drift in the composed tree);
4. execute each module separately with `python -m unittest -v` under the normal repo/stub/test-support PYTHONPATH;
5. emit `notion_agent_exact_matrix_execution_v1` JSON with per-module PASS/FAIL/TIMEOUT, return code, duration and stdout/stderr SHA-256;
6. overall PASS only when every required Agent module actually returns zero.

Local self-test of the runner: PASS — two synthetic unittest modules execute; a one-byte test-file drift is rejected before execution proof.

Important: this runner does not itself claim Agent safety-green. Full execution on the real exact composed tree is still pending.

## Mandatory Agent matrix

The execution runner includes the Agent-owned portion of the strengthened matrix, including:

- the 12 pinned negative-path modules for release-abort/failover/materializer journal/backup/recovery/finalization;
- tombstone post-replace sync failure, durable restart and cancellation;
- materializer target-path and late-alias substitution guards;
- dynamic reservation/reselect/session-entry cleanup;
- prompt modes, prompt identity and Responses prompt HTTP/wiring;
- delegation policy/dispatcher/model-step/entrypoint/lifecycle;
- delegated tool-loop runtime validation and uncertain-side-effect failover;
- `tests.test_server_subagent_tool_catalog`;
- `tests.test_live_two_slot_probe_contract`;
- durable tool guard, uncertain rebind, lifecycle drain, Notion tool-subagent runtime and account-pool parallelism.

Core-supplied Stage-B transaction/stream/lock/promoted-install tests are deliberately NOT executed by this Agent runner; they belong to the subsequent Core same-byte composition.

## Current boundary

- Exact Agent pair reproduction: proven locally on current head.
- Exact five-file owner/engineer overlay identities: proven.
- Full Agent safety matrix on exact pair + overlay: `NOT_PROVEN`.
- Exact execution-manifest mechanism: `READY`, blob `681e186b73f9dd06b59b098d2c594e19eef16fa1`.
- Core installer-v3 / unified Stage-B: separate Core work, not mutated by Agent.
- Windows: `FORBIDDEN` until Agent execution manifest PASS + same-byte Core Stage-B/full local PASS + final coverage/readiness PASS.

## Next exact action

1. Compose locally exactly `c9ca6f3b... + 273db94a... + fd9a.../a9d.../f36e.../2d576.../f478...` on Git HEAD `3cc0c0be...`.
2. Run `run_notion_agent_exact_matrix.py` and preserve its exact JSON output.
3. If and only if verdict is PASS, hand Core the exact pair/overlay SHA+size, runner blob, test-file blob map and per-module execution manifest.
4. Core composes those same bytes with installer-v3 + Stage-B and runs the same-byte Agent+Core full matrix.
5. Only after final coverage/readiness PASS on that real candidate root may one targeted native Windows Server 2022 proof run.
