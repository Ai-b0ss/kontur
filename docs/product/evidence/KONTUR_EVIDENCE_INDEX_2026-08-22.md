# KONTUR final evidence index — 2026-08-22

This index tells a new engineer where every binding proof lives. The exact release-record commit cannot embed its own SHA. The final SHA, final Circle trigger/workflow/job, final Cloudflare build and outer package hash are therefore recorded together in three non-self-referential places: issue #9 canonical closing comment, PR #12 closing comment, and the owner-package `MANIFEST.json`.

## Canonical product and source authority

| Evidence | Location / identity |
|---|---|
| Primary transcript | `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`, SHA-256 `1f519becf36a44e1761a50c359e9dca02473c81f2f24194bb3c4c704052a436f` |
| Exact FINAL_TZ | `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`, SHA-256 `7d092fa46a21de7931bf2f1a26aaea21df5926cd51c322d2b2ad420700074cbe` |
| Accepted preview gate | `docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md`, SHA-256 `a11802a8b4fab881b4b19877a086786273fd1f16b48746ac5872cd1f844ef0fb` |
| Accepted result taxonomy | `docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md`, SHA-256 `5e6bdd4ca358d19ff1d1a97d93c0b1ccacea05ddd5d8756a17d253eb3d760bbe` |
| Owner live correction | `docs/product/OWNER_LIVE_REVIEW_DELTA_2026-08-17.md` |
| Final exhaustive matrix | `docs/product/evidence/KONTUR_FINAL_REQUIREMENT_MATRIX_2026-08-22.md` |
| Revalidation/red-team report | `docs/product/evidence/KONTUR_CORE_DONE_REVALIDATION_2026-08-22.md` |

## Provenance

| Boundary | Evidence |
|---|---|
| Old full DONE | `50b4426e930544dae761b57457fe3eb1b4d93b3e`; CI `32109387124`/`95625379525`; staging `32109380995` |
| Old → current compare | GitHub compare `50b4426e930544dae761b57457fe3eb1b4d93b3e...287b9aa294dbec0af077cdcf96e8e5b864f32c03`: 92 ahead, zero behind, 28 paths |
| Final product correction | `32034e8af92923a2abe09ad00e3220f6da1ed21c...5ec223a539f2e3f97eef549fbe8306361281187b`: exactly three product files |
| Browser/staging/fix sequence | `5ec223a539f2e3f97eef549fbe8306361281187b...287b9aa294dbec0af077cdcf96e8e5b864f32c03`: 13 commits / 11 paths; runtime fixes, behavioral/pixel/layout gates, stable captures and bounded idempotent staging retry; chronology in revalidation §3 |
| Evidence/staging tooling hardening | `287b9aa294dbec0af077cdcf96e8e5b864f32c03...8487df3b067bde800dd607e65bc4ad80ea89d10c`: runtime bytes unchanged; release docs, manifest self-exclusion, collision-safe per-run Telegram/update/giver namespaces and staging regression |
| Final docs descendant | Exact changed-path list and both tree SHAs are in owner-package `MANIFEST.json` |

## CI and build proofs

| Gate | Exact proof |
|---|---|
| Owner-supplied clean Mini App build | technical trigger `8638112c9aa6a0d921b052006f42708dc61f8e2e`; Circle workflow `9d380f8f-d0f6-465c-9059-97d3a4588da1`; job `8ee5bd6f-21ff-41aa-845d-761c82f86bc0`; source `5ec223a…`; SUCCESS |
| Drop-overlap falsification | source `2d84a05f…`; Circle workflow `f8c9dd22-79af-432a-a457-65b1a95ce51d`; job `1a61a77f-7a1a-4578-af83-733d1bb38616`; correctly FAILED `canonical bird overlaps the coloring title`; diagnostic geometry preserved on `evidence/kontur-core-b8202631-drop-diagnostic4-20260822`; never used as PASS |
| First bounded-frame runtime PASS | source `3dbd1647…`; trigger `f3a184dd8fb167edee1824f796ff85a0549dd67f`; workflow `b49e20bc-f127-400a-98bd-b5cc5e8fc943`; job `1249a719-7c31-475c-822c-8196a8ffec1f`; evidence `evidence/kontur-core-3dbd1647-runtime1-20260822`; SUCCESS |
| Fresh real-browser/full-stack baseline | trigger `0b12fc5838b673962422ea015eafed1b3564bef8`; context `ci/circleci: kontur-core-browser-acceptance`; workflow `1cb18623-ee52-42a5-8a0f-ca53a994a1a8`; job `cb3ed7e5-ebc5-456d-ad0b-e68212d06860`; source `287b9aa2…`; SUCCESS; evidence `evidence/kontur-core-287b9aa2-runtime2-20260822` |
| Rejected self-hash evidence | source `cb54f253…`; trigger `3fadfdac9d3ceeee148cea2f554dedd4b01d27d3`; workflow `0cc64970-adf3-463d-93ac-4c90bab451ac`; job `4fcb03a4-2448-49a0-b13f-fdc57e9419db`; execution SUCCESS, but independent manifest verification FAILED because the publisher hashed the initially empty `SHA256SUMS.txt`; never used as package proof |
| Repeated-run staging falsification | source `cb54f253…`; trigger `6ab6f4d74de1befaaf5fa8e29396f125abc8a828`; workflow `41332b2f-0f4c-4508-b492-bbaba8dd3560`; job `73703c38-76e5-48c6-bdee-78390a336b6a`; browser/build PASS, live staging correctly FAILED at wallet 3/5 due overlapping synthetic IDs; never used as closing PASS |
| Collision-safe tooling PASS | source `8487df3b067bde800dd607e65bc4ad80ea89d10c`; trigger `9b8e86af688d7c69f710f694396f5a3ad65a9e44`; workflow `cdfda3af-92cd-4025-83ae-327a0545ae80`; job `7ba2fe6f-6e87-4885-8e8c-f7b1ecf05324`; SUCCESS; evidence `evidence/kontur-core-8487df3b-tooling1-20260822` |
| Final exact-head binding | `MANIFEST.json` fields `final_commit`, `circle.trigger`, `circle.workflow`, `circle.job`, `circle.status=success`; duplicated in issue #9/PR #12 closing comments |
| GitHub-hosted admission incident | run `32539661015` failed before any step; classified as runner admission only and not used as product evidence |

The final Circle job executes a clean detached checkout, `pnpm install --frozen-lockfile`, native Linux Rollup/esbuild checks, Mini App/core/DB/bot/Worker tests, repository-wide typecheck, production Vite build, HTTP serve, bundle budget and real-browser acceptance. No runtime patch is applied.

## Browser behavior and visual artifacts

Generated by `apps/miniapp/test/browser-acceptance.mjs` from the production `dist` in real Playwright Chromium. The browser manifest explicitly classifies its backend as a contract-faithful isolated mock; it is not substituted for the live staging gate.

### Required FINAL_TZ files

| File | Proof covered |
|---|---|
| `01-hook.png` | Default hook and headline |
| `02-hook-start-before.png` | Hook/start continuity |
| `03-quiz-q1.png` | q1 / stage 1 |
| `04-quiz-q4.png` | q4 / stage 4 |
| `05-quiz-q8.png` | q8 / stage 8 before hatch |
| `06-bird-reveal.png` | Canonical reveal |
| `07-worm-loop.png` | Worm explanation |
| `08-home.png` | Same canonical bird in Home |
| `motion-1-hook-to-q1.webm` | Hook → start → q1 |
| `motion-2-q1-q4-q8-cracks.webm` | Progressive q1 → q4 → q8 cracking |
| `motion-3-q8-to-reveal.webm` | q8 response → same-scene hatch/reveal |

### Supplemental files

`09-new-coloring-drop.png`, `10-reload-persistence.png`, `11-replay-same-bird.png`, `12-large-hook.png`, `13-large-home.png`, `14-reduced-motion-reveal.png`, and `browser-acceptance.json`.

The final artifact set and `SHA256SUMS.txt` live on the immutable evidence branch named in `MANIFEST.json`. The manifest deliberately excludes only itself and covers every evidence payload; the owner package rechecks every listed SHA-256 after download. Circle also retains the same set as job artifacts.

## Staging proofs

| Gate | Evidence |
|---|---|
| Pre-layout-red-team deploy | Cloudflare Worker `kontur-igor-staging`, commit `729a868c`, build `a8e974c1-c1aa-4b3d-b5d6-bb136e9fcb7d`, SUCCESS |
| Intermediate stable-capture deploy | Same isolated Worker/D1, commit `dff64aa7`, build `040380f2-e769-4dc6-9dbd-fe7b2923c354`, SUCCESS; Circle browser PASS, live-smoke transport timeout prevented use as closing proof |
| Hardened acceptance deploy | Same isolated Worker/D1, commit `d2e40ef5`, build `35ed08e7-388a-42de-8e1f-cdcd72fbc482`, SUCCESS |
| Product-baseline deploy | Same isolated Worker/D1, commit `287b9aa2`, build `9ec8e6a5-38a6-485f-9e1f-cafa066b93cb`, SUCCESS |
| Collision-safe repeat deploy | Same isolated Worker/D1, commit `8487df3b`, build `e7b4df49-df7a-4056-a571-e21bfdad95a3`, SUCCESS; exact asset convergence and live wallet `0 → 5 → 0` |
| Final exact-head deploy | `MANIFEST.json` and canonical GitHub closing comments record the final Cloudflare build ID/status |
| Exact generation | `tools/cloudflare/wait-for-deployed-assets.mjs` log: remote root and critical egg/art assets equal current local SHA-256 |
| Unauthorized boundary | remote `/api/v4/local/state` = HTTP 401 without signed auth |
| Live synthetic journey | `tools/cloudflare/live-release-staging-smoke.mjs` log: signed auth, 8×4 questions, self-give rejection, five distinct `/worm` grants, pair idempotency, funded hatch, five-worm guaranteed-new egg, equip and reload persistence; per-run update/giver namespaces are disjoint |
| Isolation | Worker `kontur-igor-staging`; D1 `kontur-staging` UUID `22786b4b-99cc-4ca5-a18b-932e8781021b`; production D1 UUID `91e39e7e-70fc-4551-8d3e-48235e70f985` rejected by staging generator |

Production Worker/D1/routes/crons/secrets/Telegram configuration were not changed.

## Package proofs

| File | Meaning |
|---|---|
| `README.md` | One-page owner/next-engineer entry point |
| `MANIFEST.json` | Exact final commit/tree, PR state, Circle/staging/evidence identifiers, counts and outer package facts |
| `SHA256SUMS.txt` | Internal file hashes |
| `PACKAGE_VERIFICATION.txt` | Archive listing, exclusions, hash recheck and secret-scan result |
| outer `.sha256` | Hash of the final ZIP |

## Canonical closing records

- issue #9: the last comment beginning `KONTUR_CORE_DONE CANONICAL REVALIDATION`;
- PR #12: the last comment beginning `KONTUR_CORE_DONE EVIDENCE BINDING`;
- neither record authorizes merge or production.
