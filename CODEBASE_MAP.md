# Контур — карта кодовой базы

**Статус:** current handoff + forensic map · 2026-08-17.  
Главное правило: **присутствие файла, статическая runtime-достижимость и попадание байтов в emitted bundle — три разных утверждения; ни одно из них само по себе не означает product approval.**

## A. Product authority — CURRENT

Текущую механику определяют:

- `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md` — exact primary source;
- `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md` — exact final ТЗ;
- `docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md` — exact accepted integration evidence;
- `docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md` — exact STEP E/taxonomy owner acceptance;
- `CURRENT_PRODUCT.md` — краткая current constitution;
- `PROJECT_STATE.yaml` — машинная карта состояния;
- `docs/product/DECISION_LOG_2026-08-14.md` — execution state A–E.

Exact hashes закреплены в `tools/handoff-safety-check.mjs`.

## B. Narrow current feature — CURRENT

Frontend:
- `apps/miniapp/src/screens/LocalKontur.tsx`;
- `apps/miniapp/src/components/QuizEgg.tsx`;
- current LocalBird/ResultBird helpers;
- `apps/miniapp/src/local-kontur-model.ts`;
- `apps/miniapp/src/result-taxonomy.ts`;
- `apps/miniapp/src/local-kontur.css`;
- `apps/miniapp/public/quiz/egg-stage-01.webp` … `08.webp`;
- accepted bird/result assets.

Backend:
- `apps/worker/src/local-kontur-api.ts`;
- его shared DB/error/type/core/contracts dependencies.

Current invariant:

`8Q once -> bird -> reply /worm -> +1 worm -> 5 worms = egg -> guaranteed-new coloration -> equip -> reload persists`

Current taxonomy: **5 backend roles / 6 visual results**; Kotosov — presentation-only `vibe` subtype при strict unique coder secondary score.

## C. Production source/container — CURRENT_CANDIDATE

Mini App production entry:

`apps/miniapp/src/main.tsx -> App.tsx`

Worker production entry:

`apps/worker/src/index.ts -> api.ts`

Production shell включает auth/Telegram/D1/shared infrastructure и route/container code вокруг current feature.

## D. Reachability evidence — не путать уровни

`tools/runtime-reachability.mjs` v2 строит:

1. **production runtime-import graph** — runtime imports/exports, `import type` исключены;
2. **production source-dependency graph** — включает type-only зависимости;
3. **current feature runtime graph** — `LocalKontur.tsx` + `local-kontur-api.ts` и runtime deps;
4. **current feature source graph** — то же плюс type-only deps;
5. public asset references, включая простые template paths.

Статически runtime-достижимый модуль является кандидатом для bundler, но это **не точное доказательство emitted bytes** после Vite/Rollup tree-shaking. Для удаления нужен semantic/build/provenance proof.

Отсутствие из статического графа тоже не является автоматическим deletion permit: остаются dynamic/generated/tool references.

## E. Route/feature-gated compatibility — COMPATIBILITY UNTIL PROVEN OTHERWISE

Frontend `App.tsx` имеет runtime-imports, среди прочего, к:
- `ExperienceV2`;
- `RestoredExperience`;
- `ZeroSeason`;
- `LiveCampaign`;
- legacy GameApp components.

Route boundaries:
- default → `LocalKontur`;
- `?campaign=v5` → `LiveCampaign`;
- `?season=zero` → `LocalKontur`;
- DEV `?season=zero-shelf` → old `ZeroSeason`;
- DEV `?legacy=1` → old `GameApp`.

Это доказывает static runtime reachability из source graph, **не** owner approval и **не** per-module emitted-byte inclusion.

Worker `apps/worker/src/api.ts` runtime-монтирует:
- `journeyApi`;
- `restoredApi`;
- `localKonturApi`;
- `zeroSeasonApi`;
- `liveCampaignApi`.

Эти routers также нельзя удалять без отдельной классификации.

### Naming debt: `ZERO_SEASON_ENABLED`

`ZERO_SEASON_ENABLED` — историческое имя флага, но current `/api/v4/local/*` использует его через `zeroSeasonAllowed()`.

Это не делает старый `ZeroSeason.tsx` current. Guarded staging/production configs обязаны явно держать:
- `ZERO_SEASON_ENABLED=true`;
- V2/V3 disabled;
- V5 + V5 publish disabled;
- V5 LLM disabled.

## F. Public assets

`apps/miniapp/public/**` Vite копирует в `dist` независимо от TS import graph.

Поэтому:
- copied/deployed asset != current product asset;
- отсутствие literal reference != dead asset;
- dynamic paths вроде `egg-stage-${...}.webp` требуют template-aware анализа.

Cloudflare Assets использует SPA fallback: отсутствующий asset может вернуть `index.html` с HTTP 200. Critical assets проверяются MIME + exact SHA после exact root convergence.

## G. Local/reference compatibility

- `apps/api/` — COMPATIBILITY/local reference;
- `apps/bot/` — COMPATIBILITY/local reference;
- `packages/db/` — COMPATIBILITY/local/reference DB;
- `tools/sim/` и harnesses — TEST_INFRA.

Они не являются вторым production runtime.

## H. Release / verification infrastructure — TEST_INFRA

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

`pnpm cf:deploy` / worker `pnpm deploy` намеренно fail-closed до Cloudflare request.

Production — только `.github/workflows/release-production.yml` после explicit owner authorization. Guarded path включает rollback evidence, D1 identity proof, current flags и exact post-deploy asset convergence.

## I. Provenance — FORENSIC

Доказано:
- current Git export origin = Codex `v86-local-candidate/.../verification/result/source/kontur`;
- v84 immutable Worker Version = `ab3cce08-12a0-4fa7-879b-9f6bbe838076`;
- v84 Worker SHA-256 = `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39`;
- production release 17.08 created Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1`.

Не доказано:
- historical preview `5dabce57 -> immutable CF version -> exact assets/source`.

`5dabce57` остаётся forensic target, а не current authority.

## J. ARCHIVE / PRIVATE_EXCLUDED

`docs/archive/legacy/` — история/evidence, не current ТЗ.

Не входит в обычный handoff:
- plaintext `.env`/tokens/secrets/keys;
- Telegram sessions/cookies/accounts;
- production D1 dumps;
- browser profiles;
- private research/chat exports.

`.runtime-state/` в Git допускается только как encrypted `.gpg`.

## K. Следующие gates

1. получить clean CI exact текущего head;
2. прочитать runtime-reachability + public-provenance artifacts;
3. продолжить `5dabce57` provenance до доказуемой границы;
4. классифицировать runtime-import candidates по semantic/build evidence;
5. только затем отдельный controlled removal/refactor diff;
6. не повторять destructive production reset ради verification;
7. merge PR #11 — только по отдельному owner-разрешению.
