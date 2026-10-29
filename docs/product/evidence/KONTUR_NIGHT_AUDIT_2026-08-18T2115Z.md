# KONTUR night full-acceptance audit — 2026-08-18T21:15Z

> **Historical audit snapshot.** Its pending/failing verdict describes the 18.08 head and is superseded for release status by [`KONTUR_FINAL_REQUIREMENT_MATRIX_2026-08-22.md`](KONTUR_FINAL_REQUIREMENT_MATRIX_2026-08-22.md). Keep the findings as authority inputs; do not use this file as the current candidate verdict.

Scope: adversarial verification of PR #12 against the full owner/TZ authority stack. This file is evidence only. It does not authorize `main`, production, production D1, destructive resets, Telegram publication, or any production Cloudflare write.

Exact audited head before this evidence commit: `53d557e0852da9759473b8791b220e6a050fd256`.

## Authority read

Order used:
1. latest OWNER corrections in `kontur#9`, including `OWNER/KONTUR ACCEPTANCE AUTHORITY CORRECTION`;
2. `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`;
3. `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`;
4. accepted 2026-08-14 evidence / decision log;
5. `docs/product/OWNER_LIVE_REVIEW_DELTA_2026-08-17.md`;
6. exact current source/tests/evidence.

## Current-head source findings

### Directly present in source

- q1..q7 response state now has explicit React `visualQuestionIndex`; egg stage and top progress are derived from it while committed question `index` remains separate.
- q8 result readiness is separate `hatchReady`; visible `hatching` is entered only by the effect guarded by `!eggResponding && hatchReady`.
- hatching and reveal share the same onboarding render branch and the same mounted `QuizEgg`; the reveal no longer mounts a second result bird.
- hook copy is the corrected short form and the hook CTA no longer contains the system arrow.
- six-result presentation remains client-side over the five-role backend taxonomy; no sixth backend role/D1 identity field was introduced.
- the named `docs/product/evidence/BIRD_CHARACTER_DIRECTION.md` now exists on exact head and contains the required §10 direction fields for all six current presentation results. The older matrix row marking this artifact `VERIFY_PENDING` is stale and must not be used as a blocker.

These are source-presence findings, not a substitute for an executed current-head test/build/WebView proof.

## Full-matrix rows challenged

| Authority row | Audit result on `53d557e...` | Why |
|---|---|---|
| Hook/default route / 8Q / scoring / five backend roles | SOURCE_PROVEN | current source and unchanged scoring boundary are explicit |
| q1..q7 synchronized visual target | SOURCE_PROVEN, EXECUTOR_PENDING | explicit React target exists; current-head runner has not completed |
| q8 gesture + result two-condition gate | SOURCE_PROVEN, EXECUTOR_PENDING | guard is explicit; current-head runner has not completed |
| same-scene hatch → reveal | SOURCE_PROVEN, EXECUTOR_PENDING | one branch / one `QuizEgg`; rendered continuity still needs proof |
| six-character family / Kotosov presentation-only | SOURCE_PROVEN | current renderers/taxonomy preserve the required boundary |
| `BIRD_CHARACTER_DIRECTION.md` | SOURCE_PROVEN | named artifact now exists with per-character archetype, traits, memness, retained strength and avoid-list |
| §16 eight screenshots | MISSING_CURRENT_HEAD_EVIDENCE | not produced for this exact candidate |
| §16 three WebMs | MISSING_CURRENT_HEAD_EVIDENCE | not produced for this exact candidate |
| 320×568 / 430×1000 collision-free render | MISSING_CURRENT_HEAD_EXECUTION | CSS/source contracts are not a rendered browser/WebView proof |
| reduced-motion rendered ordering | MISSING_CURRENT_HEAD_EXECUTION | source gate exists; browser/WebView execution pending |
| broken approved images = 0 | CURRENT_HEAD_EXECUTION_PENDING | historical decoder evidence exists, but current-head runner did not execute |
| real 5-worm reward egg listen/crack/open/light/colour/equip path (§11) | CURRENT_HEAD_EXECUTION_PENDING | mechanics/source remain present; current exact-head visual/runtime proof is not available |
| current base visual language (§12) | SOURCE_PROVEN, RENDER_PENDING | graphite/cyan/violet/lime/editorial source remains; rendered review pending |
| isolated non-destructive staging | FAIL_CURRENT_PROOF | Cloudflare Workers Build for exact head failed; no successful staging convergence may be claimed |
| Telegram smoke | BLOCKED_BY_STAGING | must follow a successful exact-head staging proof |
| production/main/destructive D1 | FORBIDDEN | still explicitly outside this pass |

## Executor evidence

GitHub Actions exact-head run `32185443879`, job `95867864959`, completed before any step (`steps=null`). It is infrastructure/admission evidence only and must not be interpreted as product PASS or product FAIL.

Cloudflare Workers Builds did accept exact head `53d557e...` for `kontur-igor-staging`, but build `20299954-24de-434d-8e47-c73247a3b117` is reported failed. The available GitHub-side Cloudflare status does not expose the failing build step, so the reason is currently UNKNOWN. This failure supersedes older matrix wording that cited only a pre-repair staging failure.

The repository staging entrypoint itself is fail-closed and non-destructive: `tools/cloudflare/workers-build-staging.sh` requires Node 22, frozen install, handoff safety, Mini App tests/build, generated staging identity checks, and uses staging D1 `22786b4b-99cc-4ca5-a18b-932e8781021b`. A failed build does not authorize bypassing those checks.

## Acceptance conclusion

`KONTUR_CORE_DONE` is **not** claimable.

The old React-state defects are no longer a valid current-head diagnosis, but current mandatory acceptance still lacks executable/rendered evidence. The shortest safe path is:

1. obtain the exact failure stage for the current Cloudflare Workers Build or a successful equivalent exact-head executor;
2. if tests/build are green, converge `kontur-igor-staging` non-destructively;
3. produce the §16 screenshots/WebMs at 320×568 and 430×1000, including reduced motion and q8 same-scene continuity;
4. perform Telegram smoke against that same staging candidate;
5. only then re-evaluate `KONTUR_CORE_DONE`.

Do not rerun GitHub-hosted Actions while the established pre-step quota/admission failure persists, and do not weaken staging safety to make Cloudflare turn green.
