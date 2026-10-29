# KONTUR final mandatory requirement matrix — 2026-08-22

This is the exhaustive closing matrix for draft PR #12. It supersedes the provisional status tables dated 2026-08-18. The product baseline is `287b9aa294dbec0af077cdcf96e8e5b864f32c03`; the release-record commit is a documentation-only descendant and is bound to its own exact-head CircleCI, Cloudflare staging, package manifest and GitHub issue record outside the self-referential Git tree.

Allowed result vocabulary in this document is deliberately limited to `PASS`, `SUPERSEDED`, and `OWNER-CONSTRAINED`. Every mandatory product requirement is closed. `OWNER-CONSTRAINED` is used only for forbidden release actions that are not required for `KONTUR_CORE_DONE`.

## Authority shorthand

| Code | Canonical authority |
|---|---|
| S13 | `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md` |
| TZ13 | `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md` |
| E14-P | `docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md` |
| E14-R | `docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md` |
| D14 | `docs/product/DECISION_LOG_2026-08-14.md` |
| O17 | `docs/product/OWNER_LIVE_REVIEW_DELTA_2026-08-17.md` |
| O18 | PR #12 owner body plus issue #9 comment `5334904498` and the delegated visual decision recorded in the 18.08 evidence set |
| A18 | `KONTUR_NIGHT_AUDIT_2026-08-18T2115Z.md`, `KONTUR_NIGHT_FALSIFICATION_2026-08-18.md`, `KONTUR_FINAL_TZ_16_18_CLASSIFICATION_2026-08-18.md` |
| O22 | Current owner revalidation directive plus issue #9 authority-bound contract `5376688685` |

## A. Authority, provenance, and inheritance

| ID | Requirement | Canonical source | Current interpretation | Affected code | Verification method | Evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| A-01 | Exact primary source from 13.08 is preserved byte-for-byte | S13, TZ13 | Both primary documents remain immutable authority inputs | `docs/product/source/*` | SHA-256 gate in clean checkout | `1f519b…436f` and `7d092f…4cbe`; `tools/handoff-safety-check.mjs` | PASS | Package repeats the hashes |
| A-02 | Accepted 14.08 evidence is preserved | E14-P, E14-R | Accepted A–E decisions are inherited unless a later owner correction replaces them | two E14 files | SHA-256 plus decision chronology | `a11802…0fb`, `5e6bdd…bbe` | PASS | No later correction revokes accepted six-result taxonomy |
| A-03 | Later owner corrections win over older wording | O17, O18, O22 | Default funnel, q8 ordering, delegated art choice, staging authority and production prohibitions use the latest direct decision | product docs and PR history | Chronological conflict table and Git history | revalidation report §2 | PASS | Older documents are not treated as automatically stronger |
| A-04 | Every later audit blocker is resolved | A18, O22 | Executable browser, §16 artifacts, exact staging, Telegram-contract smoke, handoff and red-team are mandatory | evidence/test/workflow paths | Trace every audit finding to a matrix row | this matrix plus evidence index | PASS | No audit FAIL is silently dropped |
| A-05 | Old DONE at `50b4426…` is inherited only for unchanged subsystems | O22 | Backend/API/core/DB/bot evidence may be reused only after changed-path proof | repository-wide | GitHub compare `50b4426…` → product baseline | 92 commits ahead, zero behind; complete 28-path list in revalidation report | PASS | Worker/API/core/DB/bot source and contracts did not change |
| A-06 | Changed visual continuity scope receives fresh proof | O17, A18, O22 | No inheritance for q1–q8, hatch, reveal, Home, palette, replay or responsive behavior | Mini App visual files | Real Chromium journey plus current tests | exact-head Circle gate and browser manifest | PASS | Behavior proof, not a source grep |
| A-07 | Premature issue #9 DONE comments are not canonical | O22 | Comments `5375796176` and `5375815442` are provisional build-only evidence | issue #9 | Canonical supersession comment after all gates | final GitHub record | SUPERSEDED | Their clean-build facts remain usable, their DONE verdict does not |
| A-08 | Historical preview `5dabce57` byte equality is not a CORE gate | D14, O22 | No equality claim is made; current acceptance binds exact Git source to exact isolated staging | provenance docs | Explicit non-claim plus current staging convergence | evidence index | SUPERSEDED | Historical preview remains forensic history only |

## B. Product funnel, copy, navigation, and quiz

| ID | Requirement | Canonical source | Current interpretation | Affected code | Verification method | Evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| B-01 | Default first-time path is hook → 8Q → hatch → reveal → worm → Home | S13, TZ13, O17 | Standalone hook is the default surface | `App.tsx`, `LocalKontur.tsx` | Full real-browser journey | required PNG/WebM set and browser JSON | PASS | Community source remains available separately |
| B-02 | Hook works without prior chat context | S13 | Headline and CTA explain the product without community onboarding | `LocalKontur.tsx` | Chromium default URL render | `01-hook.png` | PASS | Staging outside Telegram also fails auth safely rather than crashing |
| B-03 | Community onboarding is not the default | S13, D14 | It remains an explicit contextual branch | `LocalKontur.tsx` | Stage model/unit assertion | Mini App suite | PASS | No source deletion required |
| B-04 | Hook headline is “Какая ты птица в IT?” | TZ13, O17 | Exact accepted hook headline | `LocalKontur.tsx` | DOM and copy regression | Mini App suite; `01-hook.png` | PASS | — |
| B-05 | Hook copy is short and CTA has no system arrow | O17 | `8 вопросов…`; plain `начать` | `LocalKontur.tsx` | Exact copy regression and screenshot | `owner-copy-regression.test.ts`; `01-hook.png` | PASS | Old bravado/`↗` removed |
| B-06 | Accepted conversational q1…q8 copy is served | E14-P, O17 | Presentation copy is separate from scoring objects | `local-kontur-api.ts` | Exact 8×4 copy regression | `owner-copy-regression.test.ts`; staging questions endpoint | PASS | Formal core strings remain scoring-side data |
| B-07 | Exactly eight questions with four options each | S13, TZ13 | Submit exactly eight option indexes | Worker/core/Mini App | Unit, Worker and live staging API | Circle suites; staging smoke reports 8 and 4×8 | PASS | — |
| B-08 | Scoring weights and five backend roles stay canonical | E14-R | UI copy/art must not alter `resolveRole` | `packages/core`, Worker API | Core/Worker suites plus unchanged-path proof | 76 core tests; Worker gate | PASS | Six visual results do not create a sixth role |
| B-09 | q1…q8 map to egg stages 01…08 | TZ13, O17, A18 | Stage N is deterministic and clamped | `quiz-egg-model.ts`, `QuizEgg.tsx` | Unit and DOM `data-stage` checks | Mini App suite; `03/04/05` PNGs | PASS | Browser checks q1, q4 and q8; unit checks every N |
| B-10 | Ring, crack and top progress advance on the same response gesture | O17, A18 | `visualQuestionIndex` drives the visual target before committed index advances | `LocalKontur.tsx`, correction CSS | Timed Chromium interactions | browser manifest; answer-state tests | PASS | Old CSS-only impersonation removed |
| B-11 | q8 hatch cannot begin before the response gesture ends | O17, A18, O22 | Visible hatch requires response complete and result ready | `LocalKontur.tsx`, `q8-hatch-timeline.ts` | 170 ms negative assertion then post-gesture positive assertion | exact-head browser gate | PASS | Tests both fast replay and normal result path |
| B-12 | Back is unavailable during the locked answer transition | O22 | Back is visible before the answer, absent while responding | `LocalKontur.tsx` | DOM assertion at q4 and q8 | exact-head browser gate | PASS | Prevents navigation race |
| B-13 | Hook → q1 retains one egg object/visual language | TZ13, E14-P | No hard route cut or unrelated egg | `QuizEgg.tsx`, `LocalKontur.tsx` | Screenshot before/after and WebM | `01`, `02`, `03`; motion WebM 1 | PASS | — |
| B-14 | Hatching and reveal are one continuous mounted scene | O17, A18 | One onboarding branch and one `QuizEgg` own shell and bird | `LocalKontur.tsx`, `QuizEgg.tsx` | Runtime continuity selectors plus regression | browser gate; `hatch-reveal-persistence.test.ts` | PASS | No reveal remount/hard cut |
| B-15 | Worm explanation follows reveal and leads to Home | S13, D14 | `/worm` is the gratitude loop, then `к моей птице` | `LocalKontur.tsx` | Real-browser CTA sequence | `07-worm-loop.png`, `08-home.png` | PASS | — |
| B-16 | Replay returns to the quiz without temporary identity drift | O22 | Existing hatched identity and palette remain stable | `LocalKontur.tsx` | Complete replay to q8/hatch | `11-replay-same-bird.png`; browser JSON | PASS | — |
| B-17 | The deferred white-glove/hand concept is not mandatory | TZ13 | It was explicitly deferred and is outside the accepted implementation | no current code | Authority classification | final TZ classification | SUPERSEDED | No missing implementation is inferred |

## C. Art, identity, six characters, and palette

| ID | Requirement | Canonical source | Current interpretation | Affected code | Verification method | Evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| C-01 | Five backend roles yield six canonical visual results | E14-R, O18 | `vibe` resolves visually to owl or Kotosov | `result-taxonomy.ts` | Exhaustive taxonomy tests | Mini App/core suites | PASS | Backend schema remains five-role |
| C-02 | Magpie uses the canonical family | E14-R, BIRD direction | `designer` → magpie master | `results/magpie.webp`, renderer | Asset decode, taxonomy and board review | SHA-256 `0970a813…1717a1`; six-character board; Circle asset gate | PASS | — |
| C-03 | Woodpecker uses the canonical family | E14-R, BIRD direction | `coder` → woodpecker master | `results/woodpecker.webp`, renderer | Asset decode, taxonomy and board review | SHA-256 `2b83bdfa…a85867`; six-character board; Circle asset gate | PASS | — |
| C-04 | Jay uses the canonical family | E14-R, BIRD direction | `creative` → jay master | `results/jay.webp`, renderer | Asset decode, taxonomy and board review | SHA-256 `96d6cb22…8fc30b`; six-character board; Circle asset gate | PASS | — |
| C-05 | Crane is compact, friendly and managerial | O17, BIRD direction | `manager` → compact crane, not epic/tall heroic art | `results/crane-collectible.svg`, renderer | Board review, asset hash and staging fetch | SHA-256 `e96c549b…a84dcf`; exact staging asset; board | PASS | — |
| C-06 | Owl uses the canonical family | E14-R, BIRD direction | ordinary `vibe` → owl | `results/owl.webp`, taxonomy | Asset decode, taxonomy tests and board | SHA-256 `3953a0b8…690993`; Circle suite | PASS | — |
| C-07 | Kotosov is a presentation-only vibe subtype | E14-R | Selected only for strict unique strongest coder secondary score; tie/incomplete → owl | `results/kotosov.webp`, `result-taxonomy.ts` | Asset decode and boundary tests | SHA-256 `b073f852…5cce8f`; Mini App suite | PASS | No API/D1 role field added |
| C-08 | Hatch, reveal, Home, drop and collection use one family | O17, O22 | Same `BirdResultId` renderer across all product surfaces | `CanonicalBirdVisual.tsx`, `LocalBirdVisual.tsx`, `LocalKontur.tsx` | Runtime `data-bird-result` continuity assertions | browser JSON and screenshots | PASS | — |
| C-09 | Reveal shows the same bird as hatch | O17, O22 | Identity and tint are sampled before/after reveal | same | DOM equality | browser JSON | PASS | — |
| C-10 | Home shows the same bird as reveal | O17, O22 | No identity remapping in Home | same | DOM equality | browser JSON; `08-home.png` | PASS | — |
| C-11 | Palette is cosmetic and persists reveal → Home → reload | O17, O22 | Equip changes tint, never `BirdResultId` | renderer/local state/API | Browser equip/reload assertions plus API suite | `09`, `10`; browser JSON | PASS | — |
| C-12 | Reward drop cannot temporarily change character identity | O22 | Drop uses the current canonical identity under the new palette | `LocalKontur.tsx` | DOM identity comparison | `09-new-coloring-drop.png` | PASS | — |
| C-13 | Legacy `ResultBird` is absent from the Home path | O17, O22 | Home renders the canonical bird stage only | `LocalKontur.tsx` | Source regression plus runtime selector | Mini App suite and Home capture | PASS | Source check is supported by runtime proof |
| C-14 | Named art-direction artifact is complete | TZ13 §10/§16, A18 | Direction covers silhouette, proportions, expression, forbidden drift and cross-surface identity for all six | `BIRD_CHARACTER_DIRECTION.md` | Field-by-field comparison | named artifact plus six-character board | PASS | Human approval is separate from artifact existence |
| C-15 | Additional human visual approval is required | O18 | Owner delegated final selection/redraw; autonomous QA remains required | review process | Authority chronology | PR body/18.08 evidence | SUPERSEDED | Does not authorize production |

## D. Layout, responsive behavior, accessibility, motion, and performance

| ID | Requirement | Canonical source | Current interpretation | Affected code | Verification method | Evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| D-01 | Small-phone 320×568 is usable | TZ13, O17, O22 | Hook, quiz, hatch/reveal and Home fit without horizontal escape or ring/copy overlap | CSS and Mini App | Real Chromium at exact viewport; outer-frame geometry gate | browser JSON; required/supplemental PNGs | PASS | Interactive elements and full reveal frame checked against viewport |
| D-02 | Large-phone 430×1000 is usable | O17, O22 | Same surfaces scale without layout break | same | Real Chromium at exact viewport | `12-large-hook.png`, `13-large-home.png` | PASS | — |
| D-03 | Safe-area contract is present | O17, O22 | Top and bottom `env(safe-area-inset-*)` remain in emitted CSS | correction CSS | CSSOM assertion in both sizes | browser JSON | PASS | — |
| D-04 | No horizontal viewport overflow | O22 | Document and visible interactive controls remain inside width | emitted UI | Runtime geometry assertions | browser JSON | PASS | Both phone sizes |
| D-05 | Controls have accessible names and semantic buttons | TZ13, O22 | No visible unnamed button; main CTA/back/options remain native buttons | components/screens | Runtime accessible-name audit and DOM roles | browser JSON; Chromium locators | PASS | Scope is current funnel, not an unsupported WCAG certification |
| D-06 | Reduced motion preserves the scenario | TZ13, O17, O22 | Timing collapses but order, identity and final state do not | CSS/React motion gates | Chromium with `prefers-reduced-motion: reduce` | `14-reduced-motion-reveal.png`; browser JSON | PASS | No animation-only state transition |
| D-07 | Normal motion preserves q8 ordering | O17, A18 | Response gesture completes before visible hatch | motion state machine | Timed Chromium assertions | browser JSON and WebM 3 | PASS | — |
| D-08 | No critical console error, page error, failed request or crash | O22 | Full isolated journey must remain clean | full Mini App | Browser event listeners fail the gate | `consoleErrors: []` in browser JSON | PASS | Backend is contract-faithful mock for browser; live API is separate |
| D-09 | Production bundle remains within the current lightweight mobile budget | S13, TZ13, O22 | Emitted app is served from production build; JS ≤ 512,000 B and complete dist ≤ 5,242,880 B | Vite build/assets | Exact-head bundle-size and HTTP budget gate | JS 275,651 B; dist 2,888,113 B; final Circle logs | PASS | No dev server accepted as evidence |
| D-10 | Motion/review artifacts are generated from the production build | TZ13 §16 | Eight named PNG and three named WebM are mandatory | browser harness/workflow | File existence, nonzero size and SHA-256 | evidence branch + package index | PASS | See E-01…E-12 |
| D-11 | Reward-drop art does not cover copy or the equip action | O22 layout/UX red-team | Canonical master reserves its full painted height; order is bird → title → rarity copy → button | correction CSS, drop surface | Real Chromium geometry and rendered-detail assertions | `09-new-coloring-drop.png`; browser JSON `dropLayout` | PASS | Identity and palette are checked in the same frame |

## E. FINAL_TZ §16 named review artifacts

| ID | Requirement | Canonical source | Current interpretation | Affected code | Verification method | Evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| E-01 | `01-hook.png` | TZ13 §16 | Exact-head hook at 320×568 | full UI | Chromium screenshot | evidence branch/path manifest | PASS | — |
| E-02 | `02-hook-start-before.png` | TZ13 §16 | Same-object start transition | full UI | Chromium screenshot | evidence branch/path manifest | PASS | — |
| E-03 | `03-quiz-q1.png` | TZ13 §16 | q1 stage/progress | full UI | Chromium screenshot | evidence branch/path manifest | PASS | — |
| E-04 | `04-quiz-q4.png` | TZ13 §16 | q4 stage/progress | full UI | Chromium screenshot | evidence branch/path manifest | PASS | — |
| E-05 | `05-quiz-q8.png` | TZ13 §16 | q8 before hatch | full UI | Chromium screenshot | evidence branch/path manifest | PASS | — |
| E-06 | `06-bird-reveal.png` | TZ13 §16 | canonical reveal | full UI | Chromium screenshot | evidence branch/path manifest | PASS | — |
| E-07 | `07-worm-loop.png` | TZ13 §16 | worm explanation | full UI | Chromium screenshot | evidence branch/path manifest | PASS | — |
| E-08 | `08-home.png` | TZ13 §16 | canonical Home | full UI | Chromium screenshot | evidence branch/path manifest | PASS | — |
| E-09 | Hook → start → q1 WebM | TZ13 §16 | Real rendered motion | full UI | Playwright video | `motion-1-hook-to-q1.webm` | PASS | — |
| E-10 | q1 → q4 → q8 cracks WebM | TZ13 §16 | Progressive cracking | full UI | Playwright video | `motion-2-q1-q4-q8-cracks.webm` | PASS | — |
| E-11 | q8 → reveal WebM | TZ13 §16 | Same-scene hatch/reveal | full UI | Playwright video | `motion-3-q8-to-reveal.webm` | PASS | — |
| E-12 | `BIRD_CHARACTER_DIRECTION.md` | TZ13 §10/§16 | Named direction file, not an inferred substitute | art evidence | Direct file/field review | `docs/product/evidence/BIRD_CHARACTER_DIRECTION.md` | PASS | — |

## F. Economy, persistence, backend, API, Worker, D1, and bot

| ID | Requirement | Canonical source | Current interpretation | Affected code | Verification method | Evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| F-01 | `/worm` is a reply gratitude gesture | S13, CURRENT_PRODUCT | Bot validates a reply and rewards the replied-to author | bot/core/Worker | Bot, core and Worker suites | 6 bot tests; 76 core tests; Worker gate | PASS | Inherited source is unchanged from old DONE |
| F-02 | Self-farming is forbidden | S13 | Giver cannot reward self | core/Worker | Unit and API journey | inherited unchanged suites, rerun on final head | PASS | — |
| F-03 | Same giver → receiver is limited per game day | S13 | One pair reward per day | core/Worker/D1 | Unit/Worker tests | final Circle logs | PASS | — |
| F-04 | Correct worm value/budget is enforced | S13 | Current `/worm` budget/value contracts stay server-side | core/Worker | Core/Worker tests | final Circle logs | PASS | — |
| F-05 | Reward egg costs exactly five worms | CURRENT_PRODUCT, O17 | Five real `/worm` grants fund the wallet; hatch preserves that balance; opening spends exactly five | local API/Worker | Unit plus live staging journey | staging smoke: wallet 0 → 5 → 0, cost 5 | PASS | — |
| F-06 | Egg is affordable only with sufficient wallet | CURRENT_PRODUCT | State exposes cost/affordability and server validates spend | Worker API | API/Worker tests and staging state | final Circle/staging logs | PASS | — |
| F-07 | Egg yields a guaranteed-new coloration | CURRENT_PRODUCT | No duplicate in the current MVP pool | Worker/D1 | Unit and live staging egg open | staging smoke reports new non-plain coloring | PASS | — |
| F-08 | Older duplicate/refund gacha behavior is mandatory | Older compatibility wording, superseded by CURRENT_PRODUCT | Current MVP guarantees a new non-plain coloring and returns `duplicate=false`, `refund=0` | Worker API | Authority chronology plus live staging assertion | CURRENT_PRODUCT; staging smoke | SUPERSEDED | Guaranteed-new behavior replaces the older duplicate/refund mechanic |
| F-09 | Coloring ownership is persisted | CURRENT_PRODUCT | Opened coloring appears owned in later state/list | Worker/D1 | Worker tests and live staging | staging smoke + unchanged D1 proof | PASS | — |
| F-10 | Equipped coloring persists across refresh/reload | CURRENT_PRODUCT, O22 | Equip mutates palette only and survives state reload | Worker/D1/Mini App | Browser reload plus live API reload | `10-reload-persistence.png`; staging smoke | PASS | — |
| F-11 | Hatch/egg mutations are idempotent where required | S13, accepted backend evidence | Reused request IDs cannot double-spend/re-hatch | Worker/D1 | Worker idempotency suites | unchanged-path inheritance plus final Worker rerun | PASS | — |
| F-12 | API contracts validate inputs and auth | S13, E14-P | Eight answer indexes, JWT-bound local APIs, structured failures | contracts/Worker | Worker/API tests and staging auth boundary | unauthenticated 401; live signed auth PASS | PASS | — |
| F-13 | Worker runtime is release-capable | S13, E14-P | Current Worker serves Mini App and `/api/v4/local/*` | Worker | Full Worker simulator + remote staging | final Circle Worker logs; live staging | PASS | — |
| F-14 | D1 schema/migrations match runtime expectations | S13, old DONE | Current tables/indexes support player, worm, hatch, ownership, idempotency | migrations/Worker | D1 journey/schema verifier | final Worker gate | PASS | No relevant file changed since `50b4426…` |
| F-15 | Staging D1 is isolated from production D1 | O17, O22 | `kontur-staging` / `22786b4b…` only; production ID rejected by generator | staging config/tools | Fail-closed config checks, exact staging build and synthetic player | Cloudflare build + staging logs | PASS | Synthetic rows only in staging; per-run update/giver namespaces are disjoint and safe-integer checked |
| F-16 | Bot/Telegram integration remains compatible | S13 | Bot command, webhook/auth helpers and Mini App auth contract stay green | bot/Worker/crypto | Bot/Worker/Telegram simulator and staging signed initData | final Circle logs; live staging smoke | PASS | No production message is needed to prove the contract |
| F-17 | Production Telegram chat/account smoke is executed | O22 prohibitions | Production credentials/config and user chat are intentionally not used for CORE acceptance | production bot/account | Owner authority check | no production writes | OWNER-CONSTRAINED | Contract is proven by isolated tests and staging auth |

## G. Staging, deployment readiness, and safety

| ID | Requirement | Canonical source | Current interpretation | Affected code | Verification method | Evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| G-01 | Exact candidate deploys to isolated staging | O17, A18, O22 | Cloudflare Git build uses the PR exact head and staging-only config | staging scripts/workflows | Cloudflare build result plus asset convergence | successful `kontur-igor-staging` build; exact-head index/assets | PASS | Final binding build is recorded in external release manifest |
| G-02 | Staging frontend bytes converge to current production build | O22 | Remote root and critical assets equal local exact-head dist/public bytes | build/staging tools | `wait-for-deployed-assets.mjs` | staging asset log | PASS | Not a filesystem-only test |
| G-03 | Staging key surfaces render/reach remotely | O22 | Root, canonical art and APIs are HTTP-reachable | Worker/assets | Circle curl and real browser navigation | staging logs and browser negative-auth screen | PASS | Outside Telegram shows safe signature failure |
| G-04 | Live staging completes auth → 8Q contract → hatch → egg → equip → reload state | O22 | Synthetic staging identity exercises real Worker and D1 | Worker/D1 | Signed Telegram initData live smoke, including a repeated-run collision falsification | staging smoke log: wallet `0 → 5 → 0` | PASS | Non-production IDs are derived from disjoint per-run namespaces |
| G-05 | Staging preserves production traffic/routes/crons | O17, O22 | Generated config removes routes and triggers | config generator | Fail-closed generator assertions | `make-staging-config.mjs`; successful build | PASS | Production traffic switch is zero |
| G-06 | Direct production deploy commands fail closed | README/release safety, O22 | Only reviewed production workflow can deploy after new authority | package scripts/guard | Static gate and tests | handoff safety and refusal tests | PASS | — |
| G-07 | Old v84 one-version preview mechanism is the current release gate | TZ13 §18, O18 | Isolated exact staging replaces the historic preview mechanism | release process | Authority classification | §18 classification | SUPERSEDED | No production Worker version was created |
| G-08 | “No deploy” means no production deploy | TZ13 §18, O18 | Safe isolated staging is required and allowed | release process | Authority chronology | current owner directive | SUPERSEDED | — |
| G-09 | Merge PR #12 or push to `main` | O22 | Explicitly forbidden without a later owner decision | Git refs | PR state check | PR remains draft/open/unmerged | OWNER-CONSTRAINED | Not required for CORE_DONE |
| G-10 | Promote to production or switch traffic | O22 | Explicitly forbidden | production Worker | Deployment history/state check | no production action in this pass | OWNER-CONSTRAINED | — |
| G-11 | Reset or mutate production D1 for verification | O22 | Explicitly forbidden; staging provides the proof | production D1 | Authority and workflow review | zero production D1 writes | OWNER-CONSTRAINED | — |
| G-12 | Change production secrets or Telegram configuration | O22 | Explicitly forbidden | production secrets/config | Authority and diff review | zero secret/config writes | OWNER-CONSTRAINED | — |

## H. Build, handoff, package, and release evidence

| ID | Requirement | Canonical source | Current interpretation | Affected code | Verification method | Evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| H-01 | Exact final head is fixed and provenance-bound | O22 | PR head, Circle checkout, staging build and package manifest agree | Git/workflows/package | Compare exact SHA at every boundary | canonical issue record + manifest | PASS | No overlay or hidden patch |
| H-02 | Clean frozen Linux install is reproducible | O22 | Node 22, pnpm 11.22, frozen lock, native Rollup/esbuild | lock/package | Fresh Circle checkout/install | final Circle logs | PASS | — |
| H-03 | Full relevant tests pass | O22 | Mini App, core, DB, bot and Worker all execute | all workspaces | Circle test commands | final Circle logs | PASS | Not only Mini App tests |
| H-04 | TypeScript passes repository-wide | O22 | Every workspace typecheck executes | all TS | `pnpm -r --if-present typecheck` | final Circle logs | PASS | — |
| H-05 | Production Vite build and HTTP serve pass | O22 | `dist/index.html` exists and is fetched over HTTP | Mini App build | Vite build + local static server | final Circle logs and dist manifest | PASS | — |
| H-06 | Linux native Rollup/esbuild are present | O22 | No Windows-only local dependency false pass | lock/install | Exact package-directory checks | final Circle logs | PASS | — |
| H-07 | Browser/staging evidence is immutable and hashed | TZ13 §16, O22 | Dedicated evidence branch and package index retain every payload SHA-256 without an impossible manifest self-hash | evidence paths | Downloaded SHA manifest validation | evidence branch `SHA256SUMS.txt`; package `sha256sum -c` | PASS | Earlier self-hashing manifest was rejected, corrected and rerun |
| H-08 | README/HANDOFF do not retain stale candidate status | O22 | Current documents point to this matrix and external exact release record | root docs | Stale-marker scan | final package verification | PASS | Older 18.08 tables carry supersession notices |
| H-09 | Owner package is reproducible and excludes generated dependency junk | O22 | Source snapshot + evidence/index/manifest; no `.git`, `node_modules`, caches or `dist` | package | Archive listing and rebuild instructions | package report | PASS | Browser artifacts may be referenced by immutable evidence branch |
| H-10 | Package contains no secrets/private runtime material | O22 | `.env`, tokens, sessions, profiles, dumps and keys excluded | package | Existing handoff safety plus independent secret-pattern scan | `SECRET_SCAN_PASS` in package report | PASS | Known inert staging test strings are allowlisted as public fixtures |
| H-11 | Package and contents have SHA-256 manifests | O22 | Outer archive and internal files are hashed and rechecked | package | `sha256sum -c` and unzip listing | `SHA256SUMS.txt`, external `.sha256` | PASS | — |
| H-12 | Another engineer can reproduce acceptance | O22 | Exact commands, sources, CI/staging IDs and evidence paths are indexed | HANDOFF/evidence index | Fresh-read red-team review | owner package README | PASS | No chat history is required |
| H-13 | PR remains draft | PR body, O22 | Acceptance does not imply merge authorization | PR metadata | GitHub PR query | draft/open/unmerged | PASS | — |

## Closing invariant

All mandatory rows are `PASS` or explicitly `SUPERSEDED`. The only `OWNER-CONSTRAINED` rows are prohibited production/main/production-Telegram actions that are outside `KONTUR_CORE_DONE`. There is no mandatory unresolved item in this matrix.
