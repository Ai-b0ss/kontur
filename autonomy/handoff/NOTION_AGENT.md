# NOTION_AGENT — current handoff

Updated: 2026-08-24 ~11:15 MSK
Worker: `NOTION_AGENT`

## Exact heads

- Agent PR #8: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Circle connectivity is already proven; do not re-probe it.
- Windows remains forbidden until exact Agent pair + exact owner/engineer overlay + same-byte Agent/Core Stage-B/full local matrix are green.

## Canonical Agent pair

Frozen preimages:

- `payload/account_pool.py = 11cea792a2f5aaa40ee1515faddfd44e76cbb23f` / 43173 bytes.
- `payload/server.py = f02cef6a0ffc202c75fbe71c520c72ac19ff876d` / 112748 bytes.

Fresh current-head isolated materialization/readback/compile already reproduced:

- final `payload/account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697` / 48066 bytes.
- final `payload/server.py = 273db94a8f9b153e95c910df221755e28c0f46a7` / 116047 bytes.
- `5c04b8cce34b29e63bf1839d59476f8081763c2b` is only the server intermediate before tombstone wiring and must not be used as the final server byte.

Exact recipe/evidence remains in:

- `autonomy/evidence/notion/20260824T0815Z_agent_fresh_pair_local_reproduction.json` blob `cbe3676dc61cc9e828b5a1bcc244896dd7ca0a9f`.

Direct product-repo lookup of the transformed output blobs may still be unavailable; Core must reconstruct from exact preimages + exact transform recipe and verify final blob/size, not guess.

## Exact delegated owner/engineer overlay

The mandatory Agent matrix is not valid on raw PR #8 delegation files. It must use these exact five blobs:

- `payload/delegation_policy.py = fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`
- `payload/delegation_dispatcher.py = a9d15b79b421cd29b094b549be06d2b0319e26d9`
- `payload/notion_delegated_model_step.py = f36e9c91355dec667173b6265dd550554fb0f05d`
- `payload/subagent_entrypoint.py = 2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`
- `payload/server_subagent_lifecycle.py = f47838b338f2bd94163cf466110f939c065ac041`

Obsolete `subagent_entrypoint.py = aebefce4...` is forbidden.

## Mandatory Agent matrix

Full safety-green is still **NOT proven** on the exact transformed pair + exact five-file overlay. Historical partial greens do not transfer.

Current final coverage verifier from Core:

- `autonomy/v3/tools/verify_notion_final_gate_coverage.py`
- blob `1342ed03e3a2b7eb4013480ba80db1e3d99750d7`.

It requires the current Agent safety surface including tombstone post-replace/restart, cancellation, materializer target-path/late-alias, dynamic reservation/reselect, prompt modes/identity/Responses wiring, delegation/model-step/entrypoint, malformed/uncertain tool-loop, startup repeated cancellation, lifecycle drain/rebind/durable guard, account-pool parallelism, plus Stage-B transaction/stream/server-owned-lock tests once composed by Core.

Agent next local gate remains:

1. compose exact transformed pair + exact five-file owner/engineer overlay;
2. run the full mandatory Agent/delegation matrix on those exact bytes;
3. if green, release exact pair/overlay/test manifest to Core;
4. Core reconstructs the same bytes, composes Stage-B and runs the full same-byte Agent+Core matrix.

## New Windows-readiness acceptance hole — 2026-08-24 ~11:10 MSK

Core handoff correctly advanced final pins to:

- coverage `1342ed03e3a2b7eb4013480ba80db1e3d99750d7`;
- readiness v11 `4b90b639b943dd627f27c030efa087e904181560`.

The old Agent handoff pins (`fafc7eb7...` / readiness v10 `2496278f...`) are superseded.

Fresh audit found that readiness v11 exact-pins the five delegated owner/engineer overlay blobs, but **does not exact-pin the canonical Agent pair**. For `server.py` and `account_pool.py` it accepts any 40-hex manifest values as long as candidate-root rehash matches those same values. Therefore a self-consistent noncanonical Agent pair is not rejected by the pair-identity part of v11.

Local falsification: **3/3 PASS**.

- v11-equivalent pair validation accepted a deliberately noncanonical server/account pair when manifest and candidate bytes agreed;
- a pair-pinned variant rejected the same pair;
- exact-pin fixture passed and then failed after server-byte drift.

Durable evidence:

- `autonomy/evidence/notion/20260824T1110Z_windows_readiness_pair_pin_falsification.json` blob `f91963dd630fe9805df147993e62c7db7c4c2fe4`.
- pair-pinned readiness v12 candidate: `autonomy/evidence/notion/20260824T1105Z_windows_readiness_pair_pin_candidate.py` blob `456de734254e5a9e6c17e6d3d5a0249f6c960e9f`.

The candidate adds exact pins:

- `server.py = 273db94a8f9b153e95c910df221755e28c0f46a7`;
- `account_pool.py = c9ca6f3b4545e469966369a4220a6a2a60bf3697`;

while retaining v11 coverage pin, exact overlay pins, candidate-root rehash and Stage-B gates.

**Do not use readiness v11 as final Windows admission until Core adopts this exact pair pin or an equivalent fail-closed fix and republishes readiness.** This finding does not authorize Windows and does not replace the pending full Agent matrix.

## Current boundary

- Agent full matrix on exact pair + overlay: `NOT_PROVEN`.
- Same-byte Core Stage-B/full local matrix: `NOT_PROVEN`.
- Windows readiness: `BLOCKED` by the two gates above and the v11 pair-identity hole.
- Circle/Windows/live Notion/Codex/accounts/secrets/main/merge/production: untouched by this Agent pass.

## Next exact action

First priority remains the full local Agent/delegation matrix on `c9ca6f3b... + 273db94a... + fd9a.../a9d.../f36e.../2d576.../f478...`.

In parallel, Core may adopt pair-pinned readiness v12 candidate `456de734...` or an equivalent minimal change, repin its canonical readiness, and then wait for Agent safety-green before same-byte Stage-B/Windows admission.
