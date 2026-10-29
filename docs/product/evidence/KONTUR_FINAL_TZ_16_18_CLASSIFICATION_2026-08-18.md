# KONTUR — FINAL_TZ §16 / §18 classification, 2026-08-18

This note classifies every explicit §16 review artifact and §18 release-contract item against later owner authority. It does **not** authorize `main`, production, destructive D1 writes, Telegram configuration changes, or a traffic switch.

Status vocabulary follows `KONTUR_REQUIREMENT_MATRIX_2026-08-18.md`.

## §16 — required review artifacts

Auditor correction: FINAL_TZ names these as `REQUIRED REVIEW ARTIFACTS`. The 2026-08-18 owner correction delegates final visual choice/redraw to AUTOPILOT and removes the need to wait for human visual approval; it does **not** explicitly waive the required screenshot/WebM evidence. Therefore these artifacts remain `VERIFY_PENDING` until generated from the exact candidate, or until a later explicit owner decision waives them. They may be generated/reviewed autonomously and do not require a new human approval gate.

| Original §16 item | Status | Current authority / required evidence |
|---|---|---|
| `01-hook.png` | VERIFY_PENDING | Exact-head hook capture at the required mobile layout. |
| `02-hook-start-before.png` | VERIFY_PENDING | Exact-head same-object hook→quiz transition evidence. |
| `03-quiz-q1.png` | VERIFY_PENDING | Exact-head q1 egg/progress/crack capture. |
| `04-quiz-q4.png` | VERIFY_PENDING | Exact-head q4 egg/progress/crack capture. |
| `05-quiz-q8.png` | VERIFY_PENDING | Exact-head q8 pre-hatch/order capture. |
| `06-bird-reveal.png` | VERIFY_PENDING | Exact-head reveal identity/layout capture. |
| `07-worm-loop.png` | VERIFY_PENDING | Exact-head `/worm` loop capture. |
| `08-home.png` | VERIFY_PENDING | Exact-head Home canonical-character capture. |
| WebM 1: hook → start → egg shrink → q1 | VERIFY_PENDING | Rendered continuity recording; source assertions alone do not replace it. |
| WebM 2: q1 → q4 → q8 progressive cracking | VERIFY_PENDING | Rendered progressive-crack/synchronized-motion recording. |
| WebM 3: q8 → bird reveal | VERIFY_PENDING | Rendered same-scene hatch→reveal recording. |
| `BIRD_CHARACTER_DIRECTION.md` | VERIFY_PENDING | Produce the named artifact or prove that `KONTUR_SIX_CHARACTER_BOARD_2026-08-18.md` contains every required §10 direction field for every role. |

The human approval dependency is `SUPERSEDED`; the evidence obligation is not.

## §18 — original release contract

The original §18 described a very specific v84-era preview mechanism: one undeployed Worker Version, no traffic switch. Later owner/control policy replaces that release mechanism with an **isolated, non-destructive staging** proof for the exact candidate. Production remains forbidden until a new explicit owner authorization.

| Original §18 item | Status | Current classification |
|---|---|---|
| `Only after owner approval` | SUPERSEDED | The 2026-08-18 owner delegation removed the prior human visual approval gate for this correction pass; it did **not** authorize production/main. |
| use existing proven safe preview workflow | SUPERSEDED | Current required proof is isolated staging for the exact head, followed by Telegram smoke, with production identity/data untouched. |
| module set `{index.js}` | PASS_HISTORICAL | Part of the older immutable preview contract; current frontend correction does not justify re-declaring exact remote module identity until an executable exact-head staging proof runs. |
| backend SHA `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39` | PASS_HISTORICAL | Accepted historical backend identity. Current pass forbids backend changes; exact remote proof is still required before promotion claims. |
| D1 unchanged | PASS | This PR contains no D1/schema/data change; destructive D1 reset is explicitly forbidden in the current gate. |
| Telegram unchanged | PASS | This PR contains no Telegram configuration change; current gate forbids changing it. |
| live deployment unchanged | PASS | No production/live deployment is authorized or performed by this candidate path. |
| one `wrangler versions upload` | SUPERSEDED | The old undeployed-version preview mechanism is replaced by isolated staging for this candidate. Do not perform a production Worker version write under this contract. |
| no deploy | SUPERSEDED | Interpreted under current authority as **no production deploy**; isolated staging deployment is the required candidate proof. |
| no traffic switch | PASS | Still mandatory; staging proof must not alter production traffic. |

## Remaining release proof

The classification itself does not make the candidate done. The mandatory sequence remains:

1. executable targeted/full verification for the exact PR head;
2. generate the required §16 exact-head visual evidence (or obtain an explicit owner waiver), including the direction artifact/equivalent-field proof;
3. isolated non-destructive staging proof for that exact head;
4. Telegram smoke against the staging candidate;
5. only after a new explicit owner authorization may production/main/destructive-data actions be considered.
