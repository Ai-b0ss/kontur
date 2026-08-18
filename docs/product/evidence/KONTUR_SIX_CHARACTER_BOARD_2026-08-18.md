# KONTUR: canonical six-character board — 2026-08-18

Status: owner-delegated final visual selection. This board records the bounded correction after the four approved audits; it does not introduce new gameplay.

| BirdResultId | Canonical master | Decision |
|---|---|---|
| `magpie` | `/results/magpie.webp` | keep reviewed result candidate |
| `woodpecker` | `/results/woodpecker.webp` | keep reviewed result candidate |
| `jay` | `/results/jay.webp` | keep reviewed result candidate |
| `crane` | `/results/crane-collectible.svg` | bounded redraw: compact, friendly, slightly comic manager; tie + task tablet; no epic/totem posture |
| `owl` | `/results/owl.webp` | keep reviewed result candidate |
| `kotosov` | `/results/kotosov.webp` | keep reviewed result candidate; persisted Kotosov stays Kotosov in collection/drop |

## Canonical integration contract

- `BirdResultId` is the visual-character identity for hatch/result/Home/drop/collection; the current collection/drop renderer resolves to the same six-result family instead of `/birds/*`.
- The old `/birds/*` files stay in the repository only as bounded historical/fallback evidence and are no longer the current `LocalBirdVisual` product path.
- Colorations apply a low-opacity palette mask over the exact same canonical master. Equip/reload can change cosmetics without substituting another character.
- `q1…q8` map exactly to `egg-stage-01…08.webp`; ring progress is `stage × 45°`.
- Stage-eight shell fragments live inside `QuizEgg` and are cut from the same `egg-stage-08.webp`. The old hatch sibling supplies only glow/bird, so it no longer visually replaces the egg with unrelated shell art.
- While the q8 260 ms response gesture is still active, visible hatch effects wait. Reduced-motion removes that delay while preserving the same state order.
- Responsive contracts explicitly cover the compact `320×568` path and the regular `430×1000` path, while retaining the existing safe-area rules.

## Four-audit synthesis

The layout, motion, hatch and character-art audits converge on one bounded correction: preserve the accepted hook/quiz copy and mechanics; keep the reviewed five result masters; replace only the rejected crane; eliminate the result-vs-`/birds` identity split; retain one visual egg from q8 into hatch; and lock these properties with regression tests. Optional polish is not part of this gate.
