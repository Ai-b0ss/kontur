# KONTUR — mandatory requirement matrix, 2026-08-18

Status vocabulary: `PASS` = current source has direct evidence; `FAIL` = current source contradicts an applicable owner/TZ requirement; `PASS_HISTORICAL` = accepted immutable evidence exists but this exact head still needs its current verifier; `VERIFY_PENDING` = implementation is present but the current head still needs a successful runner/remote proof; `SUPERSEDED` = a later owner decision intentionally replaces the older gate; `NOT_APPLICABLE` = explicitly deferred/forbidden in the current pass.

Current candidate: PR #12, branch `fix/kontur-core-visual-continuity-20260818`.

## Source hierarchy used

1. latest explicit owner decisions recorded in `kontur#9`, including the 2026-08-18 delegated visual gate;
2. `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`;
3. `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`;
4. accepted 2026-08-14 execution evidence and `DECISION_LOG_2026-08-14.md`;
5. `docs/product/OWNER_LIVE_REVIEW_DELTA_2026-08-17.md`;
6. current implementation/tests.

## A. Product/mechanics invariants

| Requirement | Status | Current evidence |
|---|---|---|
| Default first-time path is `hook -> 8Q -> hatch -> reveal -> /worm -> Home` | PASS | `LocalKontur.tsx` stage machine; `initialLocalStage` regression |
| Community onboarding stays in source but is not default | PASS | `community` remains explicit branch; default stage is hook |
| Exactly 8 canonical answers are submitted | PASS | `QUESTIONS.length === 8`; `validateAnswers()` unchanged |
| Canonical option indexes/weights and `resolveRole()` stay unchanged | PASS | presentation copy is separate `LOCAL_QUESTIONS`; hatch still calls `validateAnswers(body.answers)` + `resolveRole(body.answers)` |
| Backend taxonomy remains 5 roles | PASS | `Role = designer|coder|creative|manager|vibe` |
| Visual taxonomy is 6 results including Kotosov | PASS | `BirdResultId`, `RESULT_ASSETS`, six-identity tests |
| Kotosov remains presentation-only subtype of `vibe` | PASS | `result-taxonomy.ts`; no sixth backend role/API/D1 field |
| Owl/Kotosov presentation variant is client-local per `player.userId` | PASS | `vibeVariantStorageKey`; server-side bird identity migration removed |
| `/worm` remains reply-gratitude gesture | PASS | current `/worm` copy and existing bot/core tests |
| Reward egg costs exactly 5 worms | PASS | local MVP contract/current product tests |
| Reward egg yields a new cosmetic coloration; equip/reload persists | PASS_HISTORICAL | existing API/DB tests and previously green exact-tree CI; exact current-head runner pending |
| No passive faucet/leaderboard/V3–V5 product surface leaks into current MVP | PASS | local state forces only eggs enabled; canonical product map |

## B. Exact accepted quiz presentation

| Requirement | Status | Current evidence |
|---|---|---|
| v84 conversational question/option copy is preserved | PASS | `apps/worker/src/local-kontur-api.ts::LOCAL_QUESTIONS`; exact copy recovered independently from 2026-08-08 source/diff in File Library |
| Presentation copy does not alter scoring | PASS | display array contains no weights; hatch scores against canonical `@kontur/core` answers |
| Copy regression is explicitly tested | PASS | `apps/miniapp/test/owner-copy-regression.test.ts` locks all 8 questions/options and scoring boundary |

Important correction: the formal/corporate strings in `packages/core/src/roles.ts` are the scoring-side canonical question objects. They are **not** what `/api/v4/local/questions` serves. Rewriting their text to fix presentation would violate the accepted boundary and is not required.

## C. Hook / accepted A–D funnel

| Requirement | Status | Current evidence |
|---|---|---|
| Headline `Какая ты птица в IT?` | PASS | `LocalKontur.tsx` |
| Large hero egg is retained | PASS | `QuizEgg` used in hook; accepted H3 lineage preserved |
| Hook copy is short and non-combative | PASS | `8 вопросов. Пара минут — и узнаешь свою птицу.` |
| Hook CTA has no system `↗` glyph | PASS | hook button is plain `начать`; regression test rejects `↗` inside hook action |
| Hook -> quiz keeps same egg object/visual continuity | PASS_HISTORICAL | accepted STEP B + current shared `QuizEgg` stage; exact current-head visual runner pending |
| q1..q8 map deterministically to egg stages 01..08 | PASS | `quizEggStageModel` + exact regression |
| top progress/ring/crack advance together during the answer gesture | VERIFY_PENDING | current source now uses explicit `visualQuestionIndex`; CSS N+1 impersonation removed; exact-head executable proof still required |
| q8 visible hatch cannot overtake answer gesture or result readiness | VERIFY_PENDING | current source gates `stage='hatching'` on `!eggResponding && hatchReady`; exact-head executable proof still required |
| 320x568 and 430x1000 layouts are explicitly covered | PASS | correction CSS media contracts + unit assertion |
| reduced-motion path keeps the same ordering without an extra fixed wait | VERIFY_PENDING | same React gate is used and response delay collapses to 0; exact-head executable/visual proof pending |
| white-glove hand concept remains deferred | NOT_APPLICABLE | explicitly deferred by FINAL_TZ; no implementation required |

## D. 2026-08-17 live-review correction pass

| Requirement | Status | Current evidence |
|---|---|---|
| Hook bravado/system arrow removed | PASS | current head + `owner-copy-regression.test.ts` |
| Quiz egg is one integrated bounded object | PASS | `QuizEgg` owns stage/ring/shell layers; compact/regular viewport rules |
| progress/ring/crack react on one synchronized gesture | VERIFY_PENDING | explicit React visual target now drives egg/progress; current-head executor pending |
| q8 hatch reuses q8 shell and shows result bird in same composition | VERIFY_PENDING | `QuizEgg` now receives `hatching` + `revealResultId`; executable/visual proof pending |
| Hatch -> result is one continuous mounted scene/object, without remount/hard-cut | VERIFY_PENDING | hatching and reveal now share one onboarding branch and one persistent `QuizEgg`; second reveal `ResultBird` removed; regression/executor pending |
| Hatch -> result final identity is the same `BirdResultId` | PASS | `revealResultId` remains stable through both phases |
| Result/Home/drop/collection use one six-character family | PASS | `RESULT_ASSETS` + canonical renderer; no current `/birds/*` mapping |
| Coloration changes cosmetics rather than character identity | PASS | `LocalBirdVisual` resolves canonical identity and applies palette overlay |
| Crane is compact/friendly/managerial rather than epic | PASS | delegated redraw `/results/crane-collectible.svg`; six-character board records bounded art decision |
| Six-character comparison/evidence board exists | PASS | `KONTUR_SIX_CHARACTER_BOARD_2026-08-18.md` |
| Human visual approval after 17 Aug delta | SUPERSEDED | owner explicitly delegated final visual choice/redraw to AUTOPILOT on 2026-08-18; production/main prohibition remains |

## E. FINAL_TZ §16 review artifacts — exhaustive classification

The original §16 named files were part of the mandatory human visual-review sequence. The 2026-08-18 owner delegation removed that human gate, but **not** the underlying product behaviors. Exact-head executable verification, isolated staging and Telegram smoke replace the named screenshot/WebM approval artifacts. Detailed per-item rationale is recorded in `KONTUR_FINAL_TZ_16_18_CLASSIFICATION_2026-08-18.md`.

| Original §16 item | Status | Replacement / retained requirement |
|---|---|---|
| `01-hook.png` | SUPERSEDED | named screenshot gate replaced; hook source/responsive/staging proof retained |
| `02-hook-start-before.png` | SUPERSEDED | named screenshot gate replaced; same-object hook→quiz continuity retained |
| `03-quiz-q1.png` | SUPERSEDED | named screenshot gate replaced; q1 stage/progress/crack proof retained |
| `04-quiz-q4.png` | SUPERSEDED | named screenshot gate replaced; q4 stage/progress/crack proof retained |
| `05-quiz-q8.png` | SUPERSEDED | named screenshot gate replaced; q8 pre-hatch/order proof retained |
| `06-bird-reveal.png` | SUPERSEDED | named screenshot gate replaced; reveal identity/layout proof retained |
| `07-worm-loop.png` | SUPERSEDED | named screenshot gate replaced; `/worm` semantic proof retained |
| `08-home.png` | SUPERSEDED | named screenshot gate replaced; Home canonical-character proof retained |
| WebM 1: hook→start→egg shrink→q1 | SUPERSEDED | named clip replaced; continuity still needs exact-head executable/staging proof |
| WebM 2: q1→q4→q8 progressive cracking | SUPERSEDED | named clip replaced; deterministic cracking/synchronized response remains mandatory |
| WebM 3: q8→bird reveal | SUPERSEDED | named clip replaced; q8 hatch/reveal continuity remains mandatory and is now source-implemented but VERIFY_PENDING |
| `BIRD_CHARACTER_DIRECTION.md` | SUPERSEDED | owner delegated final art choice; current bounded replacement is `KONTUR_SIX_CHARACTER_BOARD_2026-08-18.md` |

## F. FINAL_TZ §18 release contract — exhaustive classification

The old §18 preview mechanism is not silently discarded. It is classified against the current staging-only authority; no item below authorizes production.

| Original §18 item | Status | Current classification |
|---|---|---|
| only after owner approval | SUPERSEDED | old human visual approval gate removed by 2026-08-18 delegation; production/main still require new explicit authorization |
| existing proven safe preview workflow | SUPERSEDED | current required candidate proof is isolated non-destructive staging + Telegram smoke |
| module set `{index.js}` | PASS_HISTORICAL | old accepted preview identity; exact remote identity is not re-promoted without current executable staging proof |
| backend SHA `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39` | PASS_HISTORICAL | current pass forbids backend change; current remote proof still pending |
| D1 unchanged | PASS | no D1/schema/data change in PR #12; destructive reset forbidden in this gate |
| Telegram unchanged | PASS | no Telegram configuration change in PR #12/current gate |
| live deployment unchanged | PASS | no production/live deployment authorized or performed by this candidate path |
| one `wrangler versions upload` | SUPERSEDED | v84-era undeployed-version preview replaced by isolated staging; do not create a production Worker version under this contract |
| no deploy | SUPERSEDED | current meaning is no **production** deploy; isolated staging deployment is the required proof |
| no traffic switch | PASS | remains mandatory; staging proof must not alter production traffic |

## G. Verification / release gates for this exact head

| Gate | Status | Evidence / next proof |
|---|---|---|
| targeted Mini App tests | VERIFY_PENDING | answer-state and persistent-scene source regressions now match the repaired source; a real executor is still required |
| full relevant CI/typecheck/build | VERIFY_PENDING | hosted Actions quota/admission incident; do not interpret admission failure as product failure |
| broken approved assets = 0 | PASS_HISTORICAL | existing asset decoder tests; exact current-head runner pending |
| responsive/reduced-motion automated contract | PASS_HISTORICAL | source tests present; exact current-head runner pending |
| isolated non-destructive staging exact-head proof | VERIFY_PENDING | latest known Cloudflare bot result was failure on pre-repair `ead99a8d`; wait for current-head build evidence, never production |
| Telegram owner smoke of this candidate | VERIFY_PENDING | follows exact-head staging convergence; not a production deploy |
| merge to `main` | NOT_APPLICABLE | explicitly forbidden without new owner approval |
| production promotion / destructive D1 reset | NOT_APPLICABLE | explicitly forbidden without new owner approval |

## Current mandatory blockers

1. Obtain a successful exact-head targeted/full test + typecheck/build execution for the explicit React motion and persistent-scene repair.
2. Perform the already-defined **non-destructive isolated staging** proof for that exact head and verify 320x568 / 430x1000 / reduced-motion behavior.
3. Telegram smoke against the same candidate.
4. Do not add backend/D1 persistence for Kotosov, and do not touch production/main without a new explicit owner authorization.
