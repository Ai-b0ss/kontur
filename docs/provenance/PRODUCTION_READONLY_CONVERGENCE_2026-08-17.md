# Kontur production read-only convergence proof — 2026-08-17

## Verdict

The stale-public-generation race observed immediately after production release run `32030041504` is no longer an open verification blocker.

After the verifier was hardened to wait for exact fresh root convergence and to require MIME + exact SHA for approved egg assets, the dedicated read-only workflow repeatedly returned:

`PRODUCTION_READONLY_EXACT_PASS`

with:

- no Cloudflare API writes;
- no D1 writes;
- no Worker deploy;
- `attempts=1`;
- identical production root / egg 01 / egg 08 hashes across consecutive PR verification builds.

This proves that the current public production origin had converged and stayed stable for the measured frontend generation during this series of checks.

It does **not** authorize another production deploy/reset and does not replace the full clean-checkout CI handoff gate.

## Stable measured public bytes

Repeated exact values recorded by `github-actions[bot]` in control issue `Ai-b0ss/kontur#9`:

| Resource | SHA-256 |
|---|---|
| production root `index.html` | `175b2900bbf05cf4426dce272043b2f3dee591d96054881d1d95f8fd1dccbead` |
| `/quiz/egg-stage-01.webp` | `ac5a7a4205b3cf55b8cea477b49794b48ded19cf084973fd87a642f56277b199` |
| `/quiz/egg-stage-08.webp` | `6a0da2124b06d7c6440cd236024c017e36776007c0a1f0d903b74c977802bdc7` |

Each cited successful report recorded `attempts=1`.

Examples from the repeated series:

- issue comment `5316821976`, verification merge SHA `2c8065933a2d5c20cd53a93f98f2a4832e71f1ca`;
- issue comment `5316825723`, verification merge SHA `d27b42725b196244d3666f3409c23848abf4d7f7`;
- issue comment `5316838140`, verification merge SHA `a5096d6293a4ceac359cb4fea51857798b5345df`;
- issue comment `5316842509`, verification merge SHA `e4d1448f4b472a7567f4bf11c5d75dcf25bb9498`;
- issue comment `5316949215`, verification merge SHA `b4c03025a1cc6eb710fcd4bee106543fe6e64c2b`;
- issue comment `5316956999`, verification merge SHA `ed712f57399d2045c4f7962350868bdfb9620fb2`;
- issue comment `5316970500`, verification merge SHA `68e557e6d7b6634665b135cde24a3114a0d261fe`.

## Important SHA semantics

The `commit=...` value printed by this workflow under a `pull_request` event is `GITHUB_SHA`, i.e. GitHub's synthetic/test **PR merge commit SHA** for that run.

It is not necessarily the branch head SHA.

Therefore:

- the repeated reports prove the exact build represented by each PR merge SHA matched the measured production frontend bytes;
- they do not by themselves prove a later branch head passed the full CI;
- branch-head handoff claims must use the separate exact-head CI verdict/report.

## Why this closes the original red tail

The failed post-release evidence from run `32030041504` had shown:

1. `wrangler deploy` completed;
2. the immediate public root still returned an older generation;
3. `/quiz/egg-stage-01.webp` returned SPA fallback HTML rather than WebP;
4. exact asset SHA verification therefore failed.

The durable verifier now first waits for remote root bytes to equal the fresh local `dist/index.html` SHA. Only after that convergence does it fetch egg 01/08 and require:

- HTTP success;
- `Content-Type: image/webp`;
- remote SHA-256 exactly equal to the local built asset.

The repeated `attempts=1` read-only successes show that this corrected gate now sees the intended production generation immediately for the measured series.

## Safety consequence

Do **not** replay the destructive production release workflow merely to obtain another verification run.

The production DB was already reset/migrated during run `32030041504`, with rollback evidence captured before reset. Current verification can and should remain read-only.

The direct package deploy path is also intentionally fail-closed; production changes, if ever newly authorized by the owner, must use the guarded production workflow.

## Remaining independent gates

This document closes only the production public-asset propagation incident.

Still separate/open:

1. full clean-checkout CI on the exact final handoff head;
2. runtime/source reachability + Rollup emitted-module evidence review;
3. historical preview `5dabce57` provenance, especially `hostname -> immutable Cloudflare Version ID -> Worker identity`;
4. human product smoke when the owner chooses to perform it;
5. merge to `main`, which requires separate explicit owner permission.
