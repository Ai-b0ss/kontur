# Worklog

## 2026-08-22 — hatch flash continuity and result-ring artifact

- Mini App only. No bot, D1, worker, deploy, scoring, or asset replacement.
- Hard cut cause: at the `flash`→`reveal` animation-name swap the overlay fell back to base `opacity: 0` while the egg was already hidden and the bird/frame became visible. The overlay was also a soft radial blob (peak `.82`, transparent at 78%), so it never fully covered the swap.
- Fix: covering white flash; resting `opacity: 1` across flash and reveal; egg stays until cover completes; `animationend` of `lk-hatch-flash-in` advances the state machine; bird eases `scale(.88)` / opacity over the existing reveal phase.
- Artifact cause: the q8 block (`08` plus option letters) stayed mounted under the result, and `.lk-reveal-signal` was leftover overlay from the old bird-inside-reveal layout. Both could paint through the transparent lower oval of `.lk-quiz-egg__ring`.
- Question copy now unmounts only on `hatching`/`reveal`. Hook and questions keep it mounted so the q1 egg transition still waits for the copy fade. The inline reveal no longer renders `.lk-reveal-signal`.
- Proof at `32298ee8`: Mini App unit tests pass, typecheck pass, production Vite build pass, Chromium acceptance PASS (`KONTUR_BROWSER_ACCEPTANCE_PASS`) on 320x568, 390x844, 430x1000, reduced motion, and delayed hatch API. Reveal layout: no `.lk-question-number`, no `.lk-reveal-signal`, stray text under the ring `[]`, name gap 34px/67px/126px. 10 fps frames from `motion-3-q8-to-reveal.webm` show cracked egg → covering white flash → bird under the fading flash, with no uncovered egg-to-bird cut.
- Production was not deployed or otherwise mutated by this candidate.

## 2026-08-22 — owner-authorized non-destructive production release

## 2026-08-22 — owner-authorized non-destructive production release

- Deployed exact runtime `b153d4c96a775484c0cfc3b454029f9e4dadaf75` to Worker `kontur-igor` through the credentialed `kontur-igor-staging` Workers Builds executor.
- Deployment used `wrangler deploy --name kontur-igor --keep-vars`; no D1 reset, migration, user-data mutation, secret update, webhook update, or `main` merge was performed.
- Exact production root/assets, health, unauthenticated API boundary, webhook-secret boundary, and non-decreasing aggregate D1 counts passed. Post-deploy counts: 5 users, 4 hatched profiles.
- The one-time production harness was removed from the executor lane after success.
- Real `/start` → Mini App journey remains `HOLD`: the agent VM has no authenticated Telegram user session. The public bot page and direct Mini App security boundary are reachable, but this is not claimed as an end-to-end Telegram PASS.

## 2026-08-22 — owner-authorized production participant data reset

- A concurrent Cloudflare-native one-shot executor at `51a0669b` deleted rows from the live schema-derived mutable/runtime table set without dropping tables, migrations, or static catalogs.
- Read-only proof `60fd17c7` checked 62 mutable tables with zero remaining rows; production health reports zero started and hatched users. Static colorings and restored opportunities remained non-empty.
- Commit `23f6d016` restored the executor script byte-for-byte to its safe read-only state, preventing a second reset.
- Available executor evidence does not contain a retained pre-reset export or Time Travel bookmark; backup status is `UNKNOWN`, not claimed as PASS.
- Telegram `/start` and first-time onboarding remain `HOLD` because this VM has no authenticated Telegram user session. No synthetic user was created after reset.

## 2026-08-22 — quiz hatch state-machine candidate

- Replaced split-shell geometry with an explicit frontend-only `pulse -> cracks -> flash -> reveal -> settled` sequence; no backend, API, scoring, D1, migration, bot, Telegram, taxonomy, or plumage asset changed.
- The visual sequence starts after the q8 response gesture. Flash is fail-closed until both the API result and decoded final bird asset are ready, so fast and slow responses cannot skip visual phases.
- The first Chromium run exposed a real empty-circle frame before handoff. Commit `1d6b0e72` hides the clipped result frame until the flash covers the egg-to-bird replacement.
- Mini App tests, typecheck, production build, and isolated Chromium acceptance passed. Chromium covered 320x568, 390x844, and 430x1000 in normal and reduced motion, plus a delayed hatch API.
- Fresh MP4 and 10 fps frame-sheet were manually reviewed at normal speed and frame-by-frame. No premature bird, empty frame, stale q8 copy, shell shard, early tail, settled geometry jump, route return, wrong hatch header, layout jump, or avatar bleed remained.
- Production was not deployed or otherwise mutated by this candidate.

## 2026-08-22 — production hatch deploy of PR #21; owner one-user reset blocked

- Deployed exact PR #21 head `771f908b6f2407102a04e2c1773ff97f1150a400` to Worker `kontur-igor` through the credentialed `kontur-igor-staging` Workers Builds executor (`67ce5981`). Deploy used `wrangler deploy --name kontur-igor --keep-vars`. No D1 migration, secret, var, webhook, or `main` merge.
- Live production root serves `/assets/index-DuA7dhZw.js` and `/assets/index-C64rrWW-.css`. Health `ok/devMode=false/driver=d1` PASS. Unauthenticated `/api/v4/local/state` 401 PASS. Webhook without secret 403 PASS. `quiz/egg-stage-01.webp` and `quiz/egg-stage-08.webp` return `image/webp`.
- Post-deploy D1 aggregates were 3 started / 3 hatched / 0 grants. No global reset was performed.
- Owner one-user reset stayed fail-closed: `lower(replace(username,'@','')) = igorekglukhovskii43` matched 0 rows. Experience allowlist was unavailable (size 0). Current sanitized usernames: `fff999o`, `fff6dm`, `fff6pm`, and later `belasblesov`. None were guessed as owner. Other users and static catalogs were left untouched.
- Executor restored read-only at `918d87b2`. Real iPhone `/start` → q8 → hatch remains `HOLD` in this VM (no authenticated Telegram session). If the owner names their Telegram username among the live handles, a scoped one-user reset can be repeated without a global wipe.

## 2026-08-22 — one-user reset of owner Telegram username fff6pm

- Owner identified the production account as username `fff6pm` (internal `users.id` 37). Fail-closed match count was 1.
- FK-safe per-statement DELETEs on production D1 `kontur` removed only that user. `DELETE FROM users WHERE id = 37` reported `changes=1`. No global wipe, no schema/migration/secret/webhook change, no production Worker redeploy.
- Read-only proof `d91b74b2`: `fff6pm` and db id 37 are gone. Remaining users: `fff999o`, `fff6dm`, `belasblesov`. Aggregates 3 started / 3 hatched / 0 grants. Colorings 10, restored opportunities 4, migrations 18.
- Hatch runtime `771f908b` still live (`index-DuA7dhZw.js` / `index-C64rrWW-.css`). Health / API 401 / webhook 403 PASS.
- Executor restored read-only at `ffe04654`. iPhone `/start` → onboarding → q8 → new hatch is ready for `fff6pm`; this VM still cannot perform that authenticated Telegram walkthrough (`HOLD`).


