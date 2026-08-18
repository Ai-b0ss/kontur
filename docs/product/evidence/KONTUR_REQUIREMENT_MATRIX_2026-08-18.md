# KONTUR — mandatory requirement matrix, 2026-08-18

Status vocabulary: `PASS` = current source has direct evidence; `PASS_HISTORICAL` = accepted immutable evidence exists but this exact head still needs its current verifier; `VERIFY_PENDING` = implementation is present but the current head still needs a successful runner/remote proof; `SUPERSEDED` = a later owner decision intentionally replaces the older gate; `NOT_APPLICABLE` = explicitly deferred/forbidden in the current pass.

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
| Hook copy is short and non-combative | PASS | now `8 вопросов. Пара минут — и узнаешь свою птицу.` |
| Hook CTA has no system `↗` glyph | PASS | hook button is plain `начать`; regression test rejects `↗` inside hook action |
| Hook -> quiz keeps same egg object/visual continuity | PASS_HISTORICAL | accepted STEP B + current shared `QuizEgg` stage; exact current-head visual runner pending |
| q1..q8 map deterministically to egg stages 01..08 | PASS | `quizEggStageModel` + exact regression |
| top progress/ring/crack advance as one state model | PASS | stage model + correction CSS; timing assertions cover response delay |
| 320x568 and 430x1000 layouts are explicitly covered | PASS | correction CSS media contracts + unit assertion |
| reduced-motion path remains functional | PASS | `shouldReduceMotion` + correction CSS regression |
| white-glove hand concept remains deferred | NOT_APPLICABLE | explicitly deferred by FINAL_TZ; no implementation required |

## D. 2026-08-17 live-review correction pass

| Requirement | Status | Current evidence |
|---|---|---|
| Hook bravado/system arrow removed | PASS | current head + `owner-copy-regression.test.ts` |
| Quiz egg is one integrated bounded object | PASS | `QuizEgg` owns stage/ring/shell layers; compact/regular viewport rules |
| progress/ring/crack react on one synchronized gesture | PASS | 260 ms response gesture + same stage model; reduced-motion removes delay |
| q8 hatch reuses q8 shell and shows result bird in same composition | PASS | q8 shell fragments live inside `QuizEgg`; legacy sibling supplies glow/bird only; regression test |
| Hatch -> result final identity is the same `BirdResultId` | PASS | `revealResultId` feeds hatch `ResultBird` and reveal `ResultBird` |
| Result/Home/drop/collection use one six-character family | PASS | `RESULT_ASSETS` + canonical renderer; no current `/birds/*` mapping |
| Coloration changes cosmetics rather than character identity | PASS | `LocalBirdVisual` resolves canonical identity and applies palette overlay |
| Crane is compact/friendly/managerial rather than epic | PASS | delegated redraw `/results/crane-collectible.svg`; six-character board records bounded art decision |
| Six-character comparison/evidence board exists | PASS | `KONTUR_SIX_CHARACTER_BOARD_2026-08-18.md` |
| Human visual approval after 17 Aug delta | SUPERSEDED | owner explicitly delegated final visual choice/redraw to AUTOPILOT on 2026-08-18; production/main prohibition remains |

## E. Verification / release gates for this exact head

| Gate | Status | Evidence / next proof |
|---|---|---|
| targeted Mini App tests | VERIFY_PENDING | current Actions run `32134487754` failed before steps (`steps=null`); do not interpret as product failure |
| full relevant CI/typecheck/build | VERIFY_PENDING | hosted Actions pre-step incident; previous byte-equivalent tree was green before the hook-only change |
| broken approved assets = 0 | PASS_HISTORICAL | existing asset decoder tests; exact current-head runner pending |
| responsive/reduced-motion automated contract | PASS_HISTORICAL | source tests present; exact current-head runner pending |
| isolated non-destructive staging exact-head proof | VERIFY_PENDING | allowed only on staging; no D1 reset or production write |
| Telegram owner smoke of this candidate | VERIFY_PENDING | follows exact-head staging convergence; not a production deploy |
| merge to `main` | NOT_APPLICABLE | explicitly forbidden without new owner approval |
| production promotion / destructive D1 reset | NOT_APPLICABLE | explicitly forbidden without new owner approval |

## Current mandatory blockers

1. A successful runner must execute the current-head targeted/full checks. The present `steps=null` failures are hosted Actions infrastructure and must not be rerun-stormed.
2. After green source checks, perform the already-defined **non-destructive isolated staging** proof for the exact head, then Telegram smoke against that candidate.
3. Do not reopen accepted A–E, do not add backend/D1 persistence for Kotosov, and do not touch production/main without a new explicit owner authorization.
