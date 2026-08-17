# Контур — tracked-file inventory

**Статус:** handoff + forensic inventory · 2026-08-17  
**Ветка:** `cleanup/repo-hygiene-shareable-source`

Этот документ различает:

1. **рабочий source handoff** — воспроизводимая Git-база, из которой разработчик может продолжить проект;
2. **forensic-complete handoff** — дополнительно доказаны exact historical preview provenance и per-file runtime/build classification.

PR #11 остаётся draft/current-candidate. Пока не закрыт `5dabce57`, запрещено называть HEAD `byte-for-byte equals 5dabce57`.

Категории: `CURRENT | CURRENT_CANDIDATE | COMPATIBILITY | TEST_INFRA | ARCHIVE | PRIVATE_EXCLUDED | UNKNOWN`.

## 1. CURRENT — управляющий слой

- `README.md`
- `CURRENT_PRODUCT.md`
- `PROJECT_STATE.yaml`
- `AGENTS.md`
- `AI_PROJECT_NAVIGATOR.md`
- `ARCHITECTURE.md`
- `IMPLEMENTATION_PRIORITY.md`
- `CODEBASE_MAP.md`
- `HANDOFF.md`
- `BACKLOG.md`
- `SHARE_SAFE_SOURCE.md`
- `TRACKED_FILE_INVENTORY.md`

Старые V1–V5 документы не имеют над ними продуктового приоритета.

## 2. CURRENT — exact product authority/evidence

### Primary source 13.08

- `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`
  - SHA-256 `1f519becf36a44e1761a50c359e9dca02473c81f2f24194bb3c4c704052a436f`;
- `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`
  - SHA-256 `7d092fa46a21de7931bf2f1a26aaea21df5926cd51c322d2b2ad420700074cbe`;
- `docs/product/source/README.md` — exact recovery proof, sizes/Git blobs/newline policy.

Raw bytes восстановлены и защищены clean-checkout SHA gate.

### Accepted execution evidence 14.08

- `docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md`
  - SHA-256 `a11802a8b4fab881b4b19877a086786273fd1f16b48746ac5872cd1f844ef0fb`;
- `docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md`
  - SHA-256 `5e6bdd4ca358d19ff1d1a97d93c0b1ccacea05ddd5d8756a17d253eb3d760bbe`.

Это закрывает STEP E: 5 backend roles / 6 visual results; Kotosov = presentation-only `vibe` subtype при strict unique coder secondary score.

## 3. CURRENT — narrow LocalKontur feature

Frontend current root:
- `apps/miniapp/src/screens/LocalKontur.tsx`;
- `apps/miniapp/src/components/QuizEgg.tsx`;
- current LocalBird/ResultBird helpers;
- `apps/miniapp/src/local-kontur-model.ts`;
- `apps/miniapp/src/result-taxonomy.ts`;
- `apps/miniapp/src/local-kontur.css`;
- `apps/miniapp/public/quiz/egg-stage-01.webp` … `08.webp`;
- current bird/result assets, используемые этой feature-line.

Backend current root:
- `apps/worker/src/local-kontur-api.ts`;
- его shared DB/error/type/core/contracts dependencies.

Current path:

`hook -> 8Q -> hatching -> 6-way visual result -> /worm -> Home`

Current invariant:

`8Q once -> bird -> reply /worm -> +1 worm -> 5 worms = egg -> guaranteed-new coloration -> equip -> reload persists`

## 4. CURRENT_CANDIDATE — production source graph

Mini App production entry:

`apps/miniapp/src/main.tsx -> App.tsx`

Worker production entry:

`apps/worker/src/index.ts -> api.ts`

### Важная граница доказательства

`tools/runtime-reachability.mjs` v2 строит **два разных графа**:

- `runtime-import graph` — только runtime imports/exports, type-only imports исключены;
- `source-dependency graph` — дополнительно включает type-only зависимости для source handoff.

Статическая runtime-достижимость означает: модуль находится в import graph от production entrypoint и должен рассматриваться bundler'ом. Она **не доказывает**, что модуль оставил байты в финальном emitted JS после Vite/Rollup tree-shaking.

Поэтому термины:
- `static runtime reachable` — PROVEN анализатором после зелёного evidence run;
- `emitted in final bundle` — требует отдельного build/module evidence;
- `current product` — определяется owner authority, а не обоими предыдущими фактами.

### Старые frontend surfaces

`App.tsx` содержит runtime imports старых surfaces, включая `ExperienceV2`, `RestoredExperience`, `ZeroSeason`, `LiveCampaign` и legacy GameApp components.

Route-policy:
- default → `LocalKontur`;
- `?campaign=v5` → `LiveCampaign`;
- `?season=zero` → `LocalKontur`;
- DEV-only `?season=zero-shelf` → old `ZeroSeason`;
- DEV-only `?legacy=1` → old `GameApp`.

До build-module evidence это означает **static runtime-reachable candidates**, а не автоматически «байты точно shipping в production chunk».

### Старые Worker routers

Worker `api.ts` runtime-монтирует:
- `journeyApi`;
- `restoredApi`;
- `localKonturApi`;
- `zeroSeasonApi`;
- `liveCampaignApi`.

Для Worker это также статическая runtime-достижимость. Удаление запрещено без semantic/reachability/build proof.

## 5. CURRENT_CANDIDATE — historical flag naming debt

`ZERO_SEASON_ENABLED` — историческое имя, но current `localKonturApi` использует его через `zeroSeasonAllowed()` как gate `/api/v4/local/*`.

Это не делает `ZeroSeason.tsx` current.

Guarded staging/production configs обязаны явно держать:
- `ZERO_SEASON_ENABLED=true`;
- V2/V3 disabled;
- V5 + V5 publish disabled;
- V5 LLM disabled.

Переименование флага возможно только отдельной миграцией/controlled diff.

## 6. TEST_INFRA — runtime/source reachability

`tools/runtime-reachability.mjs` v2 использует фактический `git ls-files` и TypeScript AST.

Он:
- различает runtime и type-only imports;
- резолвит relative `.js` imports обратно в tracked `.ts/.tsx`;
- резолвит workspace packages `@kontur/core` / `@kontur/contracts`;
- строит production/current runtime graphs;
- строит production/current source graphs;
- отдельно перечисляет tracked source вне production source graph;
- анализирует `public/**` literal/simple-template references, включая `egg-stage-${...}.webp`;
- fail-closed падает на unresolved internal/workspace imports.

CI сохраняет JSON+Markdown artifact `kontur-runtime-reachability-${run_id}`.

**Artifact exact текущего head пока не прочитан: Actions connector отвечает 403.** Поэтому counts/per-file lists не повышать до PROVEN до получения artifact.

Интерпретация:
- runtime-import reachable ≠ current product;
- runtime-import reachable ≠ гарантированные emitted bytes;
- outside current feature ≠ dead code;
- static source-unreachable ≠ автоматическое разрешение удалить;
- public asset без detected ref всё равно может deploy-иться/использоваться динамически.

## 7. COMPATIBILITY — local/reference

- `apps/api/`;
- `apps/bot/`;
- `packages/db/`.

Они участвуют в tests/reference/recovery и не объявляются вторым production runtime.

## 8. TEST_INFRA — release/handoff safety

- `.github/workflows/ci.yml` — clean-checkout gate;
- `.github/workflows/release-staging.yml` — isolated staging;
- `.github/workflows/release-production.yml` — guarded production path;
- `tools/handoff-safety-check.mjs` — exact hashes/current invariants/deploy boundary;
- `tools/package-handoff.ps1` — `git ls-files` archive + exclusions + secret scan + SHA manifest + re-extract verification;
- `tools/cloudflare/make-staging-config.mjs`;
- `tools/cloudflare/live-release-staging-smoke.mjs`;
- `tools/cloudflare/wait-for-deployed-assets.mjs` + regression test;
- `tools/cloudflare/read-only-public-provenance.mjs`;
- `tools/cloudflare/refuse-direct-production-deploy.mjs`.

### Direct production deploy — FAIL_CLOSED

`pnpm cf:deploy` -> worker `pnpm deploy` -> refusal guard.

Guard exits before any Cloudflare request. Это закрывает старый обход guarded workflow, который мог взять базовый `wrangler.jsonc` без current LocalKontur runtime flag и без rollback/D1/convergence gates.

Production разрешён только `.github/workflows/release-production.yml` после explicit owner authorization.

## 9. Public assets

`apps/miniapp/public/**` Vite копирует в `dist` независимо от TypeScript import graph. Поэтому для public files факт попадания в deploy source сильнее import reachability, но всё ещё не означает product approval.

Cloudflare Assets использует SPA fallback, поэтому отсутствующий asset path может вернуть `index.html` с HTTP 200. Production verifier требует fresh-root exact SHA, затем critical asset MIME + exact SHA.

Incident evidence: `docs/provenance/PRODUCTION_RELEASE_2026-08-17.md`.

## 10. PRIVATE_EXCLUDED

Не входит в обычный handoff:
- plaintext `.env` / `*.local`;
- tokens/secrets/keys;
- Telegram sessions/cookies/accounts;
- production D1 dumps/backups;
- browser profiles;
- private research/chat exports;
- encryption keys.

`.runtime-state/` в Git допустим только как encrypted `.gpg`.

## 11. ARCHIVE

`docs/archive/legacy/` — historical docs/art/prototypes/worklog. Это evidence/recovery, не current authority.

## 12. PROVENANCE

Доказано:
- Git export origin = Codex `v86-local-candidate/.../verification/result/source/kontur`;
- v84 immutable Version `ab3cce08-12a0-4fa7-879b-9f6bbe838076`;
- v84 Worker SHA-256 `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39`;
- production release 17.08 создал Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1`.

UNKNOWN:
- historical preview `5dabce57 -> immutable version -> exact assets/source`;
- final emitted-module verdict по compatibility frontend до build evidence;
- exact per-file cleanup verdict до анализа reachability artifact;
- часть Codex review boards/WebM, полезных для provenance.

`UNKNOWN` означает «не удалять и не повышать до current без evidence».

## 13. Working source handoff gate

Нужно одновременно:
1. current authority/docs coherent;
2. exact primary/evidence SHA gate PASS;
3. A–E source/assets present;
4. clean checkout/install/tests/typecheck/build PASS **на exact head**;
5. reachability artifact создан и прочитан;
6. secret scan + reproducible share-safe ZIP PASS;
7. direct production deploy FAIL_CLOSED;
8. одна зафиксированная branch + commit.

Green от старого commit не переносится.

## 14. Forensic-complete gate

Дополнительно:
1. закрыть `5dabce57` provenance настолько, насколько позволяют raw evidence, с честным STOP при недоступности;
2. закончить per-file runtime/build classification;
3. проиндексировать восстановленную Codex lineage 14.08;
4. только после этого делать controlled legacy-removal/minimization.

Merge PR #11 — только по отдельному owner-разрешению.
