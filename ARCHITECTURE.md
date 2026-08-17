# Контур — архитектура текущего проекта

## 1. Product authority и current invariant

Текущую механику нельзя выводить из имени версии, route, static import или emitted bundle. Authority:

1. exact primary source 13.08 — `docs/product/source/`;
2. exact accepted execution evidence 14.08 — `docs/product/evidence/`;
3. `CURRENT_PRODUCT.md`;
4. derived `PRODUCT_BRIEF` / `DECISION_LOG`;
5. reproducible source/deployment evidence.

Current frozen contract:

`8Q once → bird → reply /worm → +1 → 5 worms = egg → guaranteed-new coloration → equip → persistence`

Current first-time flow:

`HOOK «Какая ты птица в IT?» → hero egg → 8Q → 8 crack states → hatching → 6-way visual bird result → /worm → HOME`

Backend role taxonomy остаётся из пяти ролей; Kotosov — presentation-only subtype canonical `vibe`.

## 2. Mini App — production source entry и narrow current feature

Production entry:

`apps/miniapp/src/main.tsx -> App.tsx`

`App.tsx` — shell/router с runtime imports current и historical/compatibility surfaces.

Маршрутизация:
- default → `LocalKontur`;
- `?campaign=v5` → `LiveCampaign`;
- `?season=zero` → `LocalKontur`;
- DEV `?season=zero-shelf` → historical `ZeroSeason` screen;
- DEV `?legacy=1` → historical `GameApp` path;
- dev galleries gated `import.meta.env.DEV`.

**Static runtime import означает bundler input/reachability, но не доказывает emitted bytes после tree-shaking.**

Narrow current frontend:
- `apps/miniapp/src/screens/LocalKontur.tsx`;
- `apps/miniapp/src/components/QuizEgg.tsx`;
- current LocalBird/ResultBird helpers;
- `apps/miniapp/src/local-kontur-model.ts`;
- `apps/miniapp/src/result-taxonomy.ts`;
- `apps/miniapp/src/local-kontur.css`;
- `apps/miniapp/public/quiz/egg-stage-01.webp` … `08.webp`;
- accepted bird/result assets.

## 3. Cloudflare Worker — production source entry

Production entry:

`apps/worker/src/index.ts -> api.ts`

Shell/platform отвечает за Telegram auth/webhook, JWT/auth middleware, D1, common state/errors, routing, Assets fallback и cron.

`api.ts` runtime-монтирует:
- `journeyApi`;
- `restoredApi`;
- `localKonturApi`;
- `zeroSeasonApi`;
- `liveCampaignApi`.

Это доказывает static runtime reachability этих routers из Worker source entry. Их current/product status определяется authority/feature gates; per-module emitted-byte classification остаётся отдельным build/provenance вопросом.

## 4. Narrow current backend feature

`apps/worker/src/local-kontur-api.ts`

Current `/api/v4/local/*` отвечает за:
- state;
- восемь questions presentation поверх canonical scoring order;
- hatch через existing `resolveRole`;
- guaranteed-new egg за 5 worms;
- coloring list/equip;
- persistence через существующие D1 tables.

Он скрывает для current surface passive faucet, leaderboard, отдельный community tab и duplicate/refund gacha.

### ZERO_SEASON naming debt

`localKonturApi` использует `zeroSeasonAllowed()`, который проверяет `ZERO_SEASON_ENABLED`.

Это историческое имя технического gate current LocalKontur backend и **не означает**, что отдельный старый `ZeroSeason.tsx` UI входит в продукт.

Guarded production/staging config обязан явно задавать:
- `ZERO_SEASON_ENABLED=true`;
- `EXPERIENCE_V2_ENABLED=false`;
- `EXPERIENCE_V3_ENABLED=false`;
- `LIVE_CAMPAIGN_V5_ENABLED=false`;
- `LIVE_CAMPAIGN_V5_PUBLISH_ENABLED=false`;
- `V5_LLM_PROVIDER=disabled`.

## 5. Shared product logic

### `packages/core`

Canonical scoring/roles/game helpers. STEP E не меняет `resolveRole()` или weights: Kotosov выбирается только presentation-layer после canonical role result.

### `packages/contracts`

DTO/types между Mini App и runtime. Многие imports здесь type-only, поэтому source dependency не следует автоматически считать runtime bundle dependency.

## 6. Reachability model v2

`tools/runtime-reachability.mjs` использует TypeScript AST и строит раздельно:

- production **runtime-import graph** — type-only imports исключены;
- production **source-dependency graph** — type-only imports включены;
- narrow current runtime graph;
- narrow current source graph;
- public assets + literal/simple-template references.

Интерпретация:
- runtime-import reachable != current product;
- runtime-import reachable != доказанные emitted bytes;
- outside narrow feature != dead;
- static source-unreachable != автоматически safe-to-delete;
- public file без detected reference всё равно может копироваться Vite/использоваться динамически.

Удаление — только после semantic + build + provenance evidence.

## 7. Local/reference compatibility

`apps/api`, `apps/bot`, `packages/db` — local/reference/test/compatibility контур. Не считать вторым production backend и не удалять, пока tests/migration tooling/recovery используют его.

## 8. Migration architecture

Production D1 lineage: `apps/worker/migrations/`.

Правила:
- applied production migrations не переписывать;
- local/reference migrations не смешивать с D1 lineage по имени;
- destructive reset — отдельная release operation с rollback evidence, не обычный test command.

## 9. Static assets

Cloudflare Worker Assets обслуживает `apps/miniapp/dist`; Vite копирует `apps/miniapp/public/**` в dist.

`not_found_handling = single-page-application` позволяет отсутствующему asset path вернуть `index.html`, поэтому `HTTP 200 + non-empty` недостаточно.

Release verifier обязан:
1. дождаться exact SHA remote `index.html` == fresh local `dist/index.html`;
2. затем проверять critical assets;
3. требовать правильный MIME (`image/webp` для eggs);
4. требовать exact SHA asset bytes.

Это закрывает incident 17.08, когда `egg-stage-01.webp` вернул stale SPA fallback HTML.

## 10. Release architecture

### Direct deploy

`pnpm cf:deploy` и worker `pnpm deploy` намеренно **fail-closed до Cloudflare request**.

Причина: старый direct Wrangler path обходил guarded runtime vars, rollback capture, D1 identity proof и post-deploy convergence.

### Staging

`.github/workflows/release-staging.yml` использует отдельный Worker/D1, inert Telegram identity и current flags.

### Production

`.github/workflows/release-production.yml` включает frozen-source proof, full checks/build, exact D1 identity, Time Travel + SQL export, rollback artifact до destructive reset, migrations, generated current config, exact static-asset convergence и health evidence.

Production run 17.08 уже выполнил reset/deploy. Не повторять destructive workflow ради read-only retry.

## 11. Provenance

Historical preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

Пока не доказано:

`5dabce57 hostname → immutable CF version → exact Worker/assets → source commit/worktree`.

Уже доказано отдельно:
- v84 immutable Version `ab3cce08-12a0-4fa7-879b-9f6bbe838076`;
- v84 Worker SHA-256 `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39`;
- current Git export — Codex `v86-local-candidate/.../verification/result/source/kontur`;
- production 17.08 — Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1`.

Не смешивать эти identities.

## 12. Environment/private boundary

Git handoff содержит source, manifests/lockfiles, migrations, tests, reproducible tooling, docs/templates и только намеренно tracked encrypted runtime-state.

Не включать plaintext `.env`, secrets/tokens, Telegram sessions/cookies/accounts, production DB exports, browser profiles, private chat/research data и encryption keys.

## 13. Safety/control

- no direct main push;
- no merge без explicit owner authorization;
- no unguarded production deploy;
- no migration rewrite;
- no destructive reset для обычной проверки;
- no assumption-based legacy deletion;
- exact-head CI green не переносить со старого commit;
- issue #9 CONTROL/owner override проверять перед mutable KONTUR work;
- если KONTUR `MANUAL_LOCKED`, P1–P5 не имеют права CLAIM/write/dispatch KONTUR.
