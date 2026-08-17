# Контур — архитектура текущего проекта

## 1. Product authority и current invariant

Текущую механику нельзя выводить из имени версии или существующего route. Authority:

1. exact primary source 13.08 — `docs/product/source/`;
2. exact accepted execution evidence 14.08 — `docs/product/evidence/`;
3. `CURRENT_PRODUCT.md`;
4. derived `PRODUCT_BRIEF` / `DECISION_LOG`;
5. reproducible source/deployment evidence.

Current frozen contract:

`8Q once → bird → reply /worm → +1 → 5 worms = egg → guaranteed-new coloration → equip → persistence`

Current first-time flow:

`HOOK «Какая ты птица в IT?» → hero egg → 8Q → 8 crack states → hatching → 6-way visual bird result → /worm → HOME`

Backend role taxonomy остаётся из пяти ролей; шестой visual result Kotosov — presentation-only subtype canonical `vibe`.

## 2. Mini App — production shell и narrow current feature

### Production entry

`apps/miniapp/src/main.tsx -> App.tsx`

`App.tsx` сейчас является shell/router. Он статически импортирует current и historical/compatibility surfaces.

Маршрутизация:
- default → `LocalKontur`;
- `?campaign=v5` → `LiveCampaign`;
- `?season=zero` → `LocalKontur`;
- DEV `?season=zero-shelf` → historical `ZeroSeason` screen;
- DEV `?legacy=1` → historical `GameApp` path;
- dev galleries также gated `import.meta.env.DEV`.

Следствие: статический import старой screen делает её частью JS bundle, но не делает current product.

### Narrow current frontend feature

Основные файлы:
- `apps/miniapp/src/screens/LocalKontur.tsx`;
- `apps/miniapp/src/components/QuizEgg.tsx`;
- current LocalBird/ResultBird helpers;
- `apps/miniapp/src/local-kontur-model.ts`;
- `apps/miniapp/src/result-taxonomy.ts`;
- `apps/miniapp/src/local-kontur.css`;
- `apps/miniapp/public/quiz/egg-stage-01.webp` … `08.webp`;
- accepted bird/result assets.

Ответственность:
- hook;
- 8Q quiz;
- deterministic egg progress/cracks;
- hatch/reveal;
- owl/Kotosov presentation persistence;
- `/worm` explanation;
- Home/collection/equip current UX;
- optional contextual community onboarding branch.

## 3. Cloudflare Worker — production shell

Production entry:

`apps/worker/src/index.ts -> api.ts`

Ответственность shell/platform:
- Telegram auth/webhook;
- JWT/auth middleware;
- D1 access;
- common errors/state;
- API routing;
- static Assets fallback;
- scheduled handlers/cron;
- current и compatibility routers.

`api.ts` статически route-монтирует:
- `journeyApi`;
- `restoredApi`;
- `localKonturApi`;
- `zeroSeasonApi`;
- `liveCampaignApi`.

Следствие: эти routers shipping в Worker bundle. Их наличие != owner approval.

## 4. Narrow current backend feature

`apps/worker/src/local-kontur-api.ts`

Current `/api/v4/local/*` отвечает за:
- state;
- exact 8 questions presentation поверх canonical scoring order;
- hatch через existing `resolveRole`;
- guaranteed-new egg за 5 worms;
- coloring list/equip;
- persistence через существующие D1 tables.

Он намеренно скрывает для current surface:
- passive faucet;
- leaderboard;
- отдельный community tab;
- duplicate/refund gacha.

### ZERO_SEASON naming debt

`localKonturApi` использует `zeroSeasonAllowed()`, который проверяет `ZERO_SEASON_ENABLED`.

Это историческое имя флага. Оно сейчас является техническим gate current LocalKontur backend и **не означает**, что отдельный старый `ZeroSeason.tsx` UI входит в продукт.

Guarded production/staging config обязан явно задавать:
- `ZERO_SEASON_ENABLED=true`;
- `EXPERIENCE_V2_ENABLED=false`;
- `EXPERIENCE_V3_ENABLED=false`;
- `LIVE_CAMPAIGN_V5_ENABLED=false`;
- `LIVE_CAMPAIGN_V5_PUBLISH_ENABLED=false`;
- `V5_LLM_PROVIDER=disabled`.

## 5. Shared product logic

### `packages/core`

Canonical scoring/roles/game helpers.

Ключевой инвариант STEP E: Kotosov selector не должен менять `resolveRole()` или weights. Visual subtype выбирается после canonical role result.

### `packages/contracts`

DTO/types между Mini App и runtime.

Current frontend/backend imports должны сходиться через эти контракты; не создавать параллельные несовместимые DTO без отдельной миграции.

## 6. Local/reference compatibility

`apps/api`, `apps/bot`, `packages/db`

Это local/reference/test/compatibility контур. Не считать вторым production backend и не удалять автоматически, пока тесты/migration tooling/recovery используют его.

## 7. Migration architecture

Production D1 lineage: `apps/worker/migrations/`.

Исторически есть также local/reference migrations вокруг `packages/db`.

Правила:
- applied production migrations не переписывать задним числом;
- local/reference migrations не смешивать с Cloudflare D1 lineage только по похожему имени;
- destructive reset — отдельная release operation с rollback evidence, не обычный test command.

## 8. Static assets

Cloudflare Worker Assets binding обслуживает `apps/miniapp/dist`; Vite копирует весь `apps/miniapp/public/**` в dist.

`not_found_handling = single-page-application` означает, что отсутствующий asset path может вернуть `index.html`. Поэтому проверка `HTTP 200 + non-empty` недостаточна для изображений.

Release verifier обязан:
1. дождаться exact SHA свежего remote `index.html` == local `dist/index.html`;
2. только затем проверять critical assets;
3. требовать правильный MIME (`image/webp` для eggs);
4. требовать exact SHA critical asset bytes.

Это исправляет incident 17.08, когда `egg-stage-01.webp` вернул stale SPA fallback HTML.

## 9. Runtime reachability

`tools/runtime-reachability.mjs` воспроизводимо строит:
- полный Mini App production bundle closure от `main.tsx`;
- полный Worker production bundle closure от `index.ts`;
- narrow current frontend closure от `LocalKontur.tsx`;
- narrow current backend closure от `local-kontur-api.ts`;
- deployed public assets и literal/template references.

Интерпретация:
- bundle reachable != current;
- outside narrow feature != dead;
- not statically reachable != автоматически safe-to-delete;
- public file без literal reference всё равно deployится Vite и может использоваться динамически.

Удаление — только после отдельной semantic/reachability проверки.

## 10. Release architecture

### Direct deploy

`pnpm cf:deploy` и worker `pnpm deploy` намеренно **fail-closed до Cloudflare request**.

Причина: старый direct Wrangler path обходил guarded runtime vars, rollback capture, D1 identity proof и post-deploy convergence.

### Staging

`.github/workflows/release-staging.yml`

Должен использовать отдельный Worker/D1, inert Telegram identity и current flags; может destructive-reset только staging DB в своём разрешённом scope.

### Production

`.github/workflows/release-production.yml`

Guarded path включает:
- frozen-source proof;
- full checks/build;
- exact production D1 identity;
- Time Travel/bookmark + SQL export;
- rollback artifact upload **до** destructive reset;
- reset/migrations только после evidence;
- deploy explicit generated production config;
- exact static-asset convergence;
- health/evidence upload.

Production run 17.08 уже выполнил reset/deploy. Не повторять весь destructive workflow ради read-only retry.

## 11. Provenance

Historical preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

Пока не доказано:

`5dabce57 hostname → immutable CF version → exact Worker/assets → source commit/worktree`.

Уже доказано отдельно:
- v84 immutable Version `ab3cce08-12a0-4fa7-879b-9f6bbe838076`;
- v84 Worker module SHA-256 `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39`;
- current Git export — Codex `v86-local-candidate/.../verification/result/source/kontur`;
- guarded production run 17.08 — Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1`.

Не смешивать эти identities.

## 12. Environment / private boundary

Git handoff содержит:
- source;
- manifests/lockfiles;
- migrations;
- tests;
- reproducible tooling;
- docs;
- templates;
- encrypted runtime-state only where intentionally tracked.

Не включать plaintext/private:
- `.env`;
- secrets/tokens;
- Telegram sessions/cookies/accounts;
- production DB exports;
- browser profiles;
- private chat/research data;
- encryption keys.

## 13. Safety/control

- no direct main push;
- no merge без explicit owner authorization;
- no unguarded production deploy;
- no migration rewrite;
- no destructive reset для обычной проверки;
- no assumption-based legacy deletion;
- issue #9 CONTROL/owner override проверять перед mutable KONTUR work;
- если KONTUR `MANUAL_LOCKED`, P1–P5 не имеют права CLAIM/write/dispatch KONTUR.
