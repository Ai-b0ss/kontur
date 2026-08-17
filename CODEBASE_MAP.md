# Контур — карта кодовой базы

**Статус:** current handoff + forensic map · 2026-08-17.  
Главное правило: **присутствие файла и даже попадание в production bundle не означает, что его механика входит в текущий продукт.**

## A. Product authority — CURRENT

Текущую механику определяют, в порядке приоритета:

- `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md` — exact primary source;
- `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md` — exact final ТЗ;
- `docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md` — exact accepted integration evidence;
- `docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md` — exact Step E/taxonomy owner acceptance;
- `CURRENT_PRODUCT.md` — краткая текущая конституция;
- `PROJECT_STATE.yaml` — машинная карта состояния;
- `docs/product/DECISION_LOG_2026-08-14.md` — execution state A–E.

Хэши exact files закреплены в `tools/handoff-safety-check.mjs`.

## B. Narrow current product feature closure — CURRENT

Frontend:
- `apps/miniapp/src/screens/LocalKontur.tsx`;
- `apps/miniapp/src/components/QuizEgg.tsx`;
- `apps/miniapp/src/components/LocalBirdVisual.tsx` и его current bird helpers;
- `apps/miniapp/src/components/ResultBird.tsx`;
- `apps/miniapp/src/local-kontur-model.ts`;
- `apps/miniapp/src/result-taxonomy.ts`;
- `apps/miniapp/src/local-kontur.css`;
- `apps/miniapp/public/quiz/egg-stage-01.webp` … `08.webp`;
- current result/bird assets, реально используемые этой веткой.

Backend feature:
- `apps/worker/src/local-kontur-api.ts`;
- shared `db.ts`, `errors.ts`, `types.ts` и другие зависимости, достигаемые из current route;
- `packages/core/` scoring/roles/egg selector, которые импортирует current feature;
- `packages/contracts/` current DTO/contracts.

Current invariant:

`8Q once -> bird -> reply /worm -> +1 worm -> 5 worms = egg -> guaranteed-new coloration -> equip -> reload persists`

Current result taxonomy: **5 backend roles / 6 visual results**, Kotosov = presentation-only `vibe` subtype при strict unique coder secondary score.

## C. Production container/runtime — CURRENT_CANDIDATE

- `apps/miniapp/src/main.tsx`;
- `apps/miniapp/src/App.tsx`;
- `apps/miniapp/src/api.ts`;
- Telegram/bootstrap/shared UI files;
- `apps/worker/src/index.ts`;
- `apps/worker/src/api.ts`;
- auth/crypto/Telegram/shared DB infrastructure;
- `apps/worker/wrangler.jsonc`;
- D1 migrations.

Это production-capable shell вокруг current feature. Он одновременно содержит/импортирует compatibility surfaces, поэтому не следует путать **container reachability** с product approval.

`tools/runtime-reachability.mjs` строит два разных графа:
1. полный production bundle closure от реальных Vite/Worker entrypoints;
2. narrow feature closure от `LocalKontur.tsx` + `local-kontur-api.ts`.

Разница между ними — не автоматический список для удаления, а очередь для классификации.

## D. Route-gated / feature-gated compatibility — COMPATIBILITY UNTIL PROVEN OTHERWISE

Frontend `App.tsx` статически импортирует, среди прочего:
- `ExperienceV2`;
- `RestoredExperience`;
- `ZeroSeason`;
- `LiveCampaign`;
- старый `GameApp`/Onboarding/Profile/Community/Eggs path.

Следовательно, значительная часть этих файлов **физически shipping в JS bundle**, даже если default route сразу возвращает `LocalKontur`.

Текущие явные route boundaries:
- default → `LocalKontur`;
- `?campaign=v5` → `LiveCampaign`;
- `?season=zero` → тоже `LocalKontur`;
- `ZeroSeason` отдельным screen доступен только через DEV `?season=zero-shelf`;
- legacy `GameApp` — только DEV `?legacy=1`.

Backend `apps/worker/src/api.ts` статически подключает:
- `journeyApi`;
- `restoredApi`;
- `localKonturApi`;
- `zeroSeasonApi`;
- `liveCampaignApi`.

Поэтому старые routers также shipping в Worker bundle. Их product state определяется feature gates/owner decisions, а не import-фактом.

### Naming debt: ZERO_SEASON

`ZERO_SEASON_ENABLED` — историческое имя флага, но **сейчас оно также является gate для `/api/v4/local/*` current LocalKontur backend** через `zeroSeasonAllowed()`.

Это не делает старый `ZeroSeason.tsx` current. Нельзя удалить/переименовать этот флаг без миграционного решения, потому что current LocalKontur API от него зависит.

Guarded staging/production configs явно ставят:
- `ZERO_SEASON_ENABLED=true`;
- `EXPERIENCE_V2_ENABLED=false`;
- `EXPERIENCE_V3_ENABLED=false`;
- `LIVE_CAMPAIGN_V5_ENABLED=false`;
- `LIVE_CAMPAIGN_V5_PUBLISH_ENABLED=false`.

## E. Public assets

`apps/miniapp/public/**` Vite копирует в `dist` независимо от того, найден ли literal reference в TS/CSS.

Поэтому:
- `deployed asset != current product asset`;
- отсутствие literal reference != доказанный dead asset;
- dynamic template paths (`egg-stage-${...}.webp`) должны учитываться отдельно.

Reachability tool сохраняет как полный список deployed public assets, так и обнаруженные literal/template references.

## F. Local/reference/test compatibility

- `apps/api/` — COMPATIBILITY/local reference;
- `apps/bot/` — COMPATIBILITY/local reference;
- `packages/db/` — COMPATIBILITY/local/reference DB layer;
- `tools/sim/` и тестовые harnesses — TEST_INFRA.

Они нужны для проверки/истории/сравнения и не объявляются вторым production runtime.

## G. Release / verification infrastructure — TEST_INFRA

- `.github/workflows/ci.yml`;
- `.github/workflows/release-staging.yml`;
- `.github/workflows/release-production.yml`;
- `tools/handoff-safety-check.mjs`;
- `tools/runtime-reachability.mjs`;
- `tools/package-handoff.ps1`;
- `tools/cloudflare/make-staging-config.mjs`;
- `tools/cloudflare/live-release-staging-smoke.mjs`;
- `tools/cloudflare/wait-for-deployed-assets.mjs` + regression test;
- `tools/cloudflare/read-only-public-provenance.mjs`;
- `tools/cloudflare/refuse-direct-production-deploy.mjs`.

### Production deploy boundary

`pnpm cf:deploy` / worker `pnpm deploy` намеренно fail-closed. Они не должны посылать запрос Cloudflare.

Production — только guarded workflow после owner authorization. Причина: guarded path включает rollback evidence, D1 identity proof, explicit current vars и exact post-deploy asset convergence.

## H. Provenance — PROVENANCE / FORENSIC

`docs/provenance/` хранит:
- current Git-export origin из Codex `v86-local-candidate/.../verification/result/source/kontur`;
- v84 integration evidence;
- production incident 17.08;
- derived candidate/snapshot/hash evidence.

Доказано:
- v84 immutable Worker Version = `ab3cce08-12a0-4fa7-879b-9f6bbe838076`;
- v84 Worker module SHA-256 = `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39`;
- current Git export происходит из Codex v86 lineage;
- production run 17.08 создал Worker Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1`.

Не доказано до конца:
- historical preview `5dabce57 -> immutable CF version -> exact assets/source`.

Поэтому `5dabce57` остаётся forensic target, а не authority над current product.

## I. Historical docs/art — ARCHIVE

`docs/archive/legacy/` — сохранённая история:
- старые README/state/navigator/backlog/product directions/V5 specs;
- Stage 1/5/6/7 материалы;
- старые handoff/design/research docs;
- historical worklog;
- art direction/prototypes/candidates.

Это evidence/recovery, не ТЗ.

## J. Private/runtime state — PRIVATE_EXCLUDED

Не входит в обычный source handoff:
- plaintext `.env`;
- токены/credentials;
- Telegram sessions/cookies/accounts;
- production D1 dumps;
- private research/chat exports;
- browser profiles;
- encryption keys.

`.runtime-state/` допускается в Git только в уже зашифрованном `.gpg` виде.

## K. Следующие gates

1. дождаться clean CI exact текущего head и забрать runtime-reachability/public-provenance artifacts;
2. продолжить `5dabce57` provenance до доказуемой границы;
3. классифицировать `productionOutsideNarrowFeature` и `trackedSourceNotInProductionBundle` по файлам;
4. только потом делать отдельный controlled removal/refactor diff;
5. не повторять destructive production reset ради verification;
6. merge PR #11 — только по отдельному owner-разрешению.
