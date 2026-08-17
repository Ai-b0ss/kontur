# Контур — AI Project Navigator

**Версия:** 3.1 · 2026-08-17  
**Статус:** актуальная точка входа для AI/агентов.

## Сначала понять одну вещь

Репозиторий содержит несколько исторических эпох V1–V5. Это НЕ означает, что текущий продукт объединяет их.

`IMPLEMENTED != PRODUCT APPROVED`.

Также различать:
- файл существует;
- файл статически runtime-достижим;
- файл реально оставил байты в emitted bundle после tree-shaking;
- механика owner-approved current product.

Это четыре разных утверждения.

## Текущий MVP

`8 вопросов один раз -> птица -> reply /worm -> +1 червяк -> 5 worms = egg -> гарантированно новый cosmetic coloration -> equip -> reload сохраняет состояние`

Первый funnel:

`«Какая ты птица в IT?» -> hero egg -> 8Q -> 8 crack states -> hatching -> bird reveal -> /worm -> HOME`

Visual state уже прошёл A–E:
- H3 accepted;
- one-egg continuity accepted;
- 8 crack states accepted;
- full first-time flow integrated;
- 5 backend roles / 6 visual results accepted + integrated;
- Kotosov = presentation-only `vibe` subtype при strict unique coder secondary score; tie/incomplete -> owl.

Не возвращать без нового owner decision: tree, daily move, daily 5Q, forecasts, raids, Form II, inventory, storm, leaderboard, streak, AI character, passive worms, duplicate/refund economy, старые перегруженные V3/V4/V5 default surfaces.

## Product authority

Сначала exact sources/evidence:

1. `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`;
2. `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`;
3. `docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md`;
4. `docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md`;
5. `CURRENT_PRODUCT.md`;
6. `docs/product/DECISION_LOG_2026-08-14.md`.

Exact files защищены SHA-256 в `tools/handoff-safety-check.mjs`.

## Главная forensic-неопределённость

Historical owner preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

Exact source mapping пока не доказан. Нельзя объявлять `main`, v84, v86 или current HEAD byte-for-byte равным preview только по сходству.

Нужна цепочка:

`5dabce57 -> immutable Cloudflare version -> exact asset hashes -> matching source/worktree`.

Отдельно уже доказано:
- v84 immutable Version ID `ab3cce08-12a0-4fa7-879b-9f6bbe838076`;
- v84 Worker SHA-256 `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39`;
- current Git export origin = Codex `v86-local-candidate/.../verification/result/source/kontur`.

Не смешивать эти линии.

## Runtime architecture

### Narrow current feature

- `apps/miniapp/src/screens/LocalKontur.tsx`;
- `QuizEgg`, current bird/result helpers, `result-taxonomy.ts`, `local-kontur-model.ts`, current CSS/assets;
- `apps/worker/src/local-kontur-api.ts`;
- current core/contracts source dependencies.

### Production source entries

- `apps/miniapp/src/main.tsx` -> `App.tsx`;
- `apps/worker/src/index.ts` -> `api.ts`.

### Historical/compatibility runtime imports

`App.tsx` имеет runtime-imports старых screens; Worker `api.ts` runtime-монтирует journey/restored/zero/V5 routers.

Это означает **static runtime reachability**, а не автоматически emitted bytes каждого модуля и не current product.

`tools/runtime-reachability.mjs` v2 отдельно строит:
- runtime-import graph без type-only imports;
- source-dependency graph с type-only imports;
- narrow current runtime/source graphs;
- public asset references.

До exact-head artifact не объявлять per-file counts/вердикты. Tree-shaken final bundle inclusion — отдельный build-evidence слой.

### ZERO_SEASON naming debt

`ZERO_SEASON_ENABLED` сейчас gating current `/api/v4/local/*`. Это историческое имя флага, а не доказательство, что старый `ZeroSeason.tsx` surface current.

## Release state 17.08

Production guarded run `32030041504` уже:
- сохранил rollback evidence;
- сбросил D1 + применил migrations;
- задеплоил frozen handoff source;
- создал Worker Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1`;
- прошёл health.

Последний red asset-check увидел старое публичное поколение assets сразу после deploy. Incident доказан в `docs/provenance/PRODUCTION_RELEASE_2026-08-17.md`.

Не повторять destructive reset для retry. Новый verifier ждёт exact root SHA convergence + MIME/SHA approved assets.

## Deployment boundary

`pnpm cf:deploy` и worker `pnpm deploy` **намеренно отключены fail-closed** до Cloudflare request.

Production — только `.github/workflows/release-production.yml` после explicit owner authorization. Staging — isolated staging workflow.

## Перед любой работой

1. прочитать authority/evidence и `CURRENT_PRODUCT.md`;
2. прочитать `PROJECT_STATE.yaml`, `CODEBASE_MAP.md`, `IMPLEMENTATION_PRIORITY.md`;
3. проверить `Ai-b0ss/kontur#9` на CONTROL/owner override/freeze;
4. если `KONTUR: MANUAL_LOCKED`, P1–P5 не имеют права CLAIM/write/dispatch KONTUR;
5. определить узкую границу задачи;
6. только затем менять код.

## Текущий P0

1. clean/reproducible exact-head handoff PR #11;
2. runtime/source reachability artifact + per-file classification;
3. historical preview `5dabce57` provenance до доказуемой границы;
4. Codex lineage/review artifact retention;
5. после proof — controlled runtime minimization, без assumption-based deletion.

## Запреты

No direct main push. No merge без нового явного owner authorization. No production mutation в cleanup. No direct production deploy command. No secrets/personal data. No assumption-based deletion. No resurrection of legacy mechanics. No claim of CI green from another commit.
