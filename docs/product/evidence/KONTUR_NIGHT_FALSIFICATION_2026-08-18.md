# KONTUR night acceptance falsification — 2026-08-18

Exact audited head before this note: `bdb84f0e467a6e16bda447056f39d06c2320d23b` on PR #12.

Authority: newest OWNER/KONTUR ACCEPTANCE AUTHORITY CORRECTION in `kontur#9`, then the canonical 13 Aug source, FINAL_TZ, accepted 14 Aug decisions, 17 Aug live delta, and current source/tests.

This note is deliberately adversarial. It does not replace the main requirement matrix; it records rows that the current matrix over-promotes and gives the exact proof needed to restore them.

| Mandatory row challenged | Verdict on audited head | Exact reason / required closure |
|---|---|---|
| q1..q7 top progress + ring + physical crack advance together in the answer gesture | **FALSE_PASS / FAIL** | React keeps `index` unchanged for the response interval and derives `eggStage`/progress from it. `kontur-core-corrections.css` uses `:has(...)`, ring overrides and `content:url(...)` to impersonate N+1. The new `answer-state-timeline.test.ts` requires an explicit React visual target and removal of the CSS impersonation. |
| q8 visible hatch cannot overtake answer gesture/result readiness | **FALSE_PASS / FAIL** | `pick()` starts `hatch(next)` immediately; `hatch()` may call `setStage('hatching')` before the response timer ends. CSS masks/pauses the overlap, but React state has already advanced. Required closure: React-level two-condition gate (gesture complete AND result ready), then executable timeline proof. |
| hatch -> bird reveal is one persistent scene/object | **FAIL** | `hatching` and `reveal` are separate top-level render branches and LocalKontur mounts a second reveal bird. `hatch-reveal-persistence.test.ts` is the red contract. Required closure: one persistent QuizEgg/bird scene through reveal; skip and reduced-motion reach the same final state. |
| physical crack is part of the egg rather than a fake SVG/white overlay | **SOURCE-PASS / VISUAL-VERIFY-PENDING** | q1..q8 use `/quiz/egg-stage-01.webp` … `08.webp` as the egg base; no per-question SVG crack overlay is used. Hatch light is separate and activates only for opening. Exact visual/WebView proof is still required before CORE_DONE. |
| exact 8Q/scoring/backend five-role taxonomy | **PASS / unchanged surface** | Current correction path is frontend-only; no scoring/backend/D1 change is authorized. |
| six-result family incl. Kotosov without backend sixth role | **PASS / unchanged surface** | Presentation taxonomy remains six results over the five-role backend. Cross-device Kotosov backend persistence remains explicitly non-required by owner authority. |
| reward egg = 5 worms -> cosmetic coloration -> collection/equip persistence | **CURRENT-HEAD VERIFY REQUIRED** | No intentional change in this branch, but final CORE_DONE still requires current-head regression/staging evidence rather than historical PASS alone. |
| responsive 320x568 + 430x1000, safe-area, reduced-motion | **CURRENT-HEAD VERIFY REQUIRED** | Source contracts exist; final acceptance needs a successful exact-head executable proof after the state fixes. |
| isolated `kontur-igor-staging` proof | **FAIL/PENDING** | Cloudflare Workers Build for `566e27ef...` reported deployment failed; later red-contract commits are not deployable acceptance candidates. Do not stage production or prod D1. |

## Repair order

1. Make `answer-state-timeline.test.ts` green with explicit React visual target + q8 two-condition gate; remove CSS-only N+1 impersonation.
2. Make `hatch-reveal-persistence.test.ts` green with one persistent QuizEgg/bird scene through reveal and timer-safe skip.
3. Run targeted/full exact-head checks on a zero-cost executor, then Cloudflare Workers Builds against **only** `kontur-igor-staging`.
4. Telegram WebView smoke and full owner/TZ matrix falsification on that exact head.

`KONTUR_CORE_DONE=NO` until every still-applicable mandatory row has current-head evidence or explicit later-owner supersession.
