# NOTION_AGENT — current handoff

Updated: 2026-08-24 ~13:43 MSK
Worker: `NOTION_AGENT`

## Exact heads / policy

- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Fresh controller 13:33 MSK authorizes two independent lanes: Agent full exact safety matrix here; Core installer-v3/Stage-B separately.
- Circle connectivity is already proven; do not re-probe it.
- Native Windows remains forbidden until exact same-byte Agent+Core composition and full local matrix are green.
- No live Notion/Codex/accounts/secrets/main/merge/production during the current offline stage.

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

## Core boundary

Core owns promoted-installer-v3 / promoted-install closure / Stage-B composition and must not be duplicated by Agent. Fresh Core handoff says installer-v3 transaction model is PASS as a model but not yet apply-ready; Windows remains forbidden.

## Full Agent matrix coverage — latest result

Previous strengthened candidate `506e377fd22d44449495398e20768316ba12221d` correctly added 12 negative-path modules but still had two false-PASS omissions among current PR#8 tests:

- `tests.test_live_two_slot_probe_contract` (`tests/test_live_two_slot_probe_contract.py` blob `7a5437e412c976ca01ef1d0710c9ce1423e0f27c`): offline proof contract for distinct two-slot account/thread ownership, fresh-thread failover, bounded project tools, path/command rejection and exactly-once local write.
- `tests.test_server_subagent_tool_catalog` (`tests/test_server_subagent_tool_catalog.py` blob `4266fbd61c6a48ee5ee0f0e17c9da1754332c2dc`): exact delegated tool catalog, malformed MCP result fail-closed behavior, tool-level error classification, and child-only transport identity.

New no-ref-movement coverage candidate:

- `verify_notion_final_gate_coverage = f521d8324002de16e1dc57b6be4b3ce0a6be21eb` / 6379 bytes.

Local synthetic falsification on the exact previous candidate bytes:

- old `506e...` with both modules omitted -> `PASS`;
- new `f521...` with both modules omitted -> `NOT_READY`, reports both missing;
- new `f521...` with complete fixture -> `PASS`;
- result: `PASS_3_OF_3`.

Durable evidence:

- `autonomy/evidence/notion/20260824T1340Z_agent_coverage_plus2_gap.json`.
- evidence commit: `b423e253fbad7e04a813e7fa8e40222f9b97143a`.

This coverage candidate is not itself a safety-green or Windows authorization. Core should take `f521...` or a reviewed superset only after same-byte Agent/Core composition.

## Mandatory Agent matrix

The complete local composed suite must execute all modules required by `f521...`, including in particular:

- the 12 negative-path modules previously pinned at 12:50 MSK;
- tombstone post-replace sync failure, durable restart and cancellation;
- materializer target-path and late-alias substitution guards;
- dynamic reservation/reselect/session-entry cleanup;
- prompt modes, prompt identity and Responses prompt HTTP/wiring;
- delegation policy/dispatcher/model-step/entrypoint/lifecycle;
- delegated tool-loop runtime validation and uncertain-side-effect failover;
- `tests.test_server_subagent_tool_catalog`;
- `tests.test_live_two_slot_probe_contract`;
- Stage-B helper/stream/lock/closure modules supplied by Core composition.

## Current boundary

- Exact Agent pair reproduction: proven locally on current head.
- Exact five-file owner/engineer overlay identities: proven.
- Full Agent safety matrix on exact pair + overlay: `NOT_PROVEN`.
- Strengthened full-matrix coverage: `READY_FOR_CORE_REVIEW`, blob `f521d8324002de16e1dc57b6be4b3ce0a6be21eb`.
- Core installer-v3 / unified Stage-B: `IN_PROGRESS / NOT_PROVEN` per fresh Core handoff.
- Windows: `FORBIDDEN` until same-byte Agent+Core full local PASS + strengthened coverage/readiness PASS.

## Next exact action

1. Compose locally `c9ca6f3b... + 273db94a... + fd9a.../a9d.../f36e.../2d576.../f478...`.
2. Run the complete Agent suite required by `f521...` on those exact bytes and emit an exact executed-module manifest.
3. If green, hand Core exact pair/overlay SHA+size and the executed-module manifest.
4. Core composes those same bytes with installer-v3 + Stage-B, runs same-byte Agent+Core full matrix, then coverage/readiness against the real candidate root.
5. Only then one targeted native Windows Server 2022 proof becomes admissible.
