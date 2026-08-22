# KONTUR_CORE_DONE independent revalidation — 2026-08-22

## 1. Scope and verdict boundary

This revalidation applies to draft PR #12, branch `fix/kontur-core-visual-continuity-20260818`. The runtime/product and hardened acceptance baseline is `287b9aa294dbec0af077cdcf96e8e5b864f32c03`. The closing documentation commit is intentionally a docs-only descendant; its exact SHA is bound after commit by the final clean Circle run, exact Cloudflare staging build, issue #9 canonical record and owner-package `MANIFEST.json`.

`KONTUR_CORE_DONE` here means all mandatory requirements from the exact 13.08 sources, accepted 14.08 evidence, later owner corrections and later audits. It does not mean “tests and build are green”. The closing matrix is `KONTUR_FINAL_REQUIREMENT_MATRIX_2026-08-22.md`.

## 2. Authority chronology and conflict resolution

| Time | Authority | Binding effect |
|---|---|---|
| 13.08 | Exact primary transcript and FINAL_TZ | Product funnel, quiz, motion, art-review artifacts and original safe preview contract |
| 14.08 | Accepted preview and result-taxonomy evidence | A–E accepted; five backend roles/six visual results; Kotosov stays client-local presentation subtype |
| 17.08 | Owner live-review delta | Fix hook copy, integrated egg/progress, q8 same-scene hatch/reveal, canonical cross-surface art and responsive behavior |
| 18.08 | Owner corrections/audits | Exhaustive matrix required; human visual gate delegated; §16 files remain required; production/main remain forbidden |
| 18–22.08 | PR repairs and independent browser red-team | Explicit response visual index, q8 dual gate, persistent hatch scene, canonical Home/drop family, reveal/layout fixes, exact staging economy and painted-master-art gates through `729a868c…` |
| 22.08 | Current owner directive / issue contract `5376688685` | Revalidate the entire universe, use real browser and fresh staging, build secret-safe package, red-team the DONE claim |

Conflicts are resolved in that order. In particular:

- the delegated art choice supersedes only the human approval dependency, not the §16 artifact obligation;
- isolated staging supersedes the old v84 undeployed-version preview mechanism, not the prohibition on production writes;
- Kotosov remains a `vibe` presentation subtype; the short-lived backend/D1 persistence experiment was reverted before the current lineage;
- comments `5375796176` and `5375815442` prove a clean build but their early DONE verdict is superseded by this revalidation.

## 3. Strict provenance and inherited evidence

### Proven old DONE anchor

Old exact DONE anchor: `50b4426e930544dae761b57457fe3eb1b4d93b3e`.

- exact-head full CI: run `32109387124`, job `95625379525`;
- non-destructive staging: run `32109380995`, isolated Worker `kontur-igor-staging`, staging D1 `22786b4b-99cc-4ca5-a18b-932e8781021b`;
- reproducible old handoff: 323 files, zero secret hits, SHA-256 `6F39B397C403987061EBEE21EEF83BE4E5C0993CE8628A9E05BC651AFEF57CE3`;
- source records: issue #9 comments `5324738454`, `5324773670`, `5324781197`, `5324831937`.

### `50b4426…` → current product baseline

GitHub compare proves 92 commits ahead, zero behind, and only these 28 paths differ:

- CI/runtime metadata: `.github/workflows/kontur-browser-acceptance.yml`, `.github/workflows/kontur-staging-nondestructive.yml`, `.node-version`, `pnpm-lock.yaml`, `apps/miniapp/package.json`, `tools/cloudflare/workers-build-staging.sh`, `tools/cloudflare/live-release-staging-smoke.mjs`;
- handoff/docs: `README.md`, `HANDOFF.md`, and the 18.08 evidence files;
- visual product: `CanonicalBirdVisual.tsx`, `LocalBirdVisual.tsx`, `QuizEgg.tsx`, `kontur-core-corrections.css`, `q8-hatch-timeline.ts`, `LocalKontur.tsx`;
- Mini App regressions/browser harness: the new/changed files under `apps/miniapp/test/` listed in GitHub compare.

The compare contains no current source change in:

- `apps/worker/src/**`, Worker tests or D1 migrations;
- `packages/core/**`, `packages/contracts/**`, `packages/db/**`;
- `apps/bot/**` or the Telegram webhook/auth implementation;
- the API/economy/idempotency contracts used by the current product.

Therefore old Worker/API/core/D1/bot proof is inheritable by strict unchanged-path provenance. It is also rerun in the final Circle job, so the closing verdict does not depend on inheritance alone.

### `32034e8…` → `5ec223a…`

Exactly three product files changed:

| File | Final blob at `5ec223a…` |
|---|---|
| `apps/miniapp/src/screens/LocalKontur.tsx` | `15677499334ef43bfef94380e557461aab9e40eb` |
| `apps/miniapp/test/local-kontur.test.ts` | `b4719b4ae96b8290435aaa8c9c9e329d4116185c` |
| `apps/miniapp/test/hatch-reveal-persistence.test.ts` | `86aad3c96a892836eb8a3c87fb98fdd5e5380708` |

### `5ec223a…` → `287b9aa2…`

Nine bounded commits changed ten paths. The initial `aafa42b…` harness made the real UI inspectable but its successful automation was provisional: manual PNG review found stale reveal surfaces and a tint-only first Home paint. The later commits closed those defects, corrected staging authentication/economy assumptions, and strengthened the acceptance gates:

- `8c48ccf…`: hide stale hook/question surfaces, bind the reveal panel, and bootstrap staging auth safely;
- `85e6355…`: use a fade-only reveal entrance that never leaves the safe viewport;
- `55a630f…`: fund the live staging egg through five real `/worm` grants and verify self/pair idempotency;
- `904166c…`: reveal the palette tint only after the canonical image decodes and paints;
- `729a868c…`: keep the small-phone reveal copy below the entire outer ring and reject tint silhouettes/rendered overlap by pixel and geometry assertions.
- `dff64aa7…`: wait for stable question paint before mandatory q1/q4/q8 captures and capture the complete canonical coloring drop; its browser gate passed, but a transient timeout on the first staging webhook correctly prevented a full PASS;
- `d2e40ef5…`: retain identical request/update IDs while applying bounded retry only to network/429/5xx staging transport failures; runtime product bytes remain identical to `729a868c…`.
- `2d84a05f…`: first attempt to reserve drop height; falsification correctly failed because the intrinsic `1067×1271` master still painted as `252×300.17` inside a nominal `252×252` grid frame and overlapped the title.
- `3dbd1647…`: remove the CSS Grid automatic minimum on canonical images (`min-width/min-height: 0`), so every master aspect ratio is contained by `object-fit`; fresh Chromium measured `252×252` with 35 px before the title.
- `287b9aa2…`: stabilize mandatory q4/q8 evidence until all four staggered options are fully opaque/enabled and re-anchor the reload capture after the pixel-detail locator check.

The final handoff commit changes documentation/evidence only; the exact path list is recorded in the package manifest.

## 4. Fresh exact-head verification

The initial clean build supplied by the owner remains valid build evidence for `5ec223a…`: Circle context `ci/circleci: kontur-final-clean-verify`, workflow `9d380f8f-d0f6-465c-9059-97d3a4588da1`, job `8ee5bd6f-21ff-41aa-845d-761c82f86bc0`, technical trigger `8638112c9aa6a0d921b052006f42708dc61f8e2e`.

Fresh acceptance then checked the product baseline without a patch overlay:

- technical trigger `0b12fc5838b673962422ea015eafed1b3564bef8`;
- context `ci/circleci: kontur-core-browser-acceptance` = SUCCESS;
- workflow `1cb18623-ee52-42a5-8a0f-ca53a994a1a8`;
- job `cb3ed7e5-ebc5-456d-ad0b-e68212d06860`;
- clean detached checkout of exact `287b9aa2…`;
- frozen Linux install with pnpm 11.22.0 and native Rollup/esbuild;
- Mini App, core, DB, bot and Worker suites;
- repository-wide TypeScript;
- production Vite build and static HTTP fetch;
- real Playwright Chromium at 320×568 and 430×1000, normal and reduced motion;
- full hook → q1…q8 → hatch → reveal → worm → Home → egg/equip → reload → replay journey;
- no console/page/request failure, viewport overflow, outer-frame/reveal overlap or safe-area contract loss;
- decoded canonical master art with a rendered-pixel detail gate on reveal, Home, reload and replay;
- eight required PNG, three required WebM and supplemental continuity captures.

The documentation-only final head is rerun through the same exact-head job. Its binding trigger/workflow/job, head and artifact hashes are in `KONTUR_EVIDENCE_INDEX_2026-08-22.md`, the external package manifest and the final issue #9 record. This avoids an impossible self-referential Git commit hash inside the commit itself.

## 5. Browser proof classification

The browser harness uses the production `dist`, not Vite dev mode. It injects the Telegram WebApp shell and a contract-faithful isolated API to make every UI state deterministic. It is behavioral proof for the Mini App, but it is not claimed as live-backend proof.

Separately, exact deployed staging exercises the real Worker/D1 with a synthetic Telegram identity. Together the two gates cover:

- deterministic visual continuity and responsive/motion behavior in real Chromium;
- real auth signature validation, questions contract, hatch, economy, ownership/equip and reload state in the deployed backend;
- safe unauthenticated 401 behavior outside Telegram.

## 6. Exact non-destructive staging

Cloudflare Git integration successfully deployed the product baseline to `kontur-igor-staging` from exact commit `287b9aa2…`, build `9ec8e6a5-38a6-485f-9e1f-cafa066b93cb`. The exact Circle staging smoke then proved asset convergence plus live isolated Worker/D1 behavior. The final docs-only head receives its own successful build and is bound in the external manifest.

The staging verifier checks:

- remote root and all critical egg/art assets converge to the exact local build/source SHA-256;
- `/api/v4/local/state` rejects an unsigned request with 401;
- signed synthetic Telegram auth creates a fresh staging-only player;
- the live endpoint returns exactly 8 questions with four options each;
- hatch persists one canonical role and preserves the fresh zero-worm wallet;
- five distinct synthetic givers grant five worms through the real `/worm` operation; self-giving grants zero and a repeated giver/receiver pair does not grant twice;
- the five-worm egg spends exactly five and returns a guaranteed-new non-plain coloration;
- equip persists through a later state fetch;
- production Worker, production D1, routes, crons, secrets and Telegram identity are untouched.

The generated staging config fails closed unless Worker name, D1 name/UUID and origin are the isolated staging identities and differ from production.

## 7. Handoff and package

The final owner package contains:

- exact source snapshot for the final commit;
- this report, closing matrix and evidence index;
- package `MANIFEST.json`, internal `SHA256SUMS.txt` and outer archive SHA-256;
- CI/staging/evidence-branch identifiers and artifact hashes;
- reproduction commands and safety boundaries;
- no `.git`, `node_modules`, `dist`, caches, `.env`, tokens, sessions, browser profiles, private dumps or keys.

The package is independently listed, hash-checked, scanned for secret-shaped values and reopened before publication.

## 8. Red-team falsification

The closing review deliberately tested the common false-DONE paths:

| Attack | Result |
|---|---|
| Evidence belongs to another commit | Exact head asserted by checkout, browser JSON, staging build and package manifest |
| Hidden patch overlay | Clean tree asserted; `patch_overlay=false`; no patch application step |
| Green source grep instead of behavior | q8/back/identity/palette/reload/replay use runtime DOM assertions in Chromium |
| Mock presented as live backend | Browser mock is explicitly classified; separate real staging Worker/D1 smoke exists |
| UI never opened | Real Chromium renders/captures every key surface; staging is also opened outside Telegram |
| Required PNG captured inside an unreadable transition | q1/q4/q8 captures wait until the question and all four staggered options are fully opaque/enabled, then record the number/paint state |
| Canonical reward art covers drop copy/action | Runtime geometry enforces bird → title → copy → equip order; rendered master detail is sampled |
| Small/large phone omitted | Both exact viewports execute geometry checks |
| Reduced motion omitted | Separate reduced-motion context completes q8/reveal |
| Old backend proof dragged through changed code | Git compare proves protected backend paths unchanged; final suites rerun anyway |
| Stale staging | Cloudflare build head and exact asset convergence bind the current candidate |
| Production used as test stand | Only isolated staging synthetic data; production writes are zero |
| Package contains local junk/secrets | Listing, exclusions, safety gate and independent secret scan pass |
| PR accidentally released | PR remains draft/open/unmerged; no `main` or production promotion |

No red-team attack leaves a mandatory matrix row unresolved.

## 9. Release boundary

The project is core-complete at the exact external release-record SHA. PR #12 remains draft. Merge, production promotion, production D1 work, production secrets and production Telegram activity remain owner-constrained and were not performed.
