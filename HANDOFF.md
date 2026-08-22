# Контур — финальная передача CORE

## Текущий кандидат

- repository: `Ai-b0ss/kontur`;
- branch: `fix/kontur-core-visual-continuity-20260818`;
- PR: #12, **draft / open / unmerged**;
- runtime/product baseline: `287b9aa294dbec0af077cdcf96e8e5b864f32c03`;
- exact release-record commit: поле `final_commit` в финальном owner-package `MANIFEST.json` и канонической записи issue #9;
- production/main не менялись и не разрешены.

Git-коммит не может содержать собственный SHA. Поэтому exact closing SHA и относящиеся к нему Circle/Cloudflare IDs связаны с деревом во внешнем `MANIFEST.json`, в последнем `KONTUR_CORE_DONE CANONICAL REVALIDATION` комментарии issue #9 и в последнем `KONTUR_CORE_DONE EVIDENCE BINDING` комментарии PR #12.

## Что является текущим продуктом

Первый путь:

`Какая ты птица в IT? → одно hero egg → q1…q8 / восемь стадий трещин → response-gated hatch → reveal → /worm → Home`

Экономика:

`reply /worm → +1 worm → 5 worms = egg → гарантированно новый косметический окрас → equip → reload сохраняет состояние`

Инварианты:

- пять backend roles и шесть визуальных персонажей: сорока, дятел, сойка, компактный журавль-менеджер, сова и Котосов;
- Котосов — client-local presentation subtype роли `vibe`, а не шестая server-role;
- hatch, reveal, Home, reward drop и collection используют один `BirdResultId` master;
- palette меняет только косметическую маску;
- q8 не начинает видимое вылупление до окончания response gesture;
- back заблокирован во время answer transition;
- reload и replay не меняют identity/palette.

## Где лежит финальная доказательная база

Начать с:

1. `docs/product/evidence/KONTUR_FINAL_REQUIREMENT_MATRIX_2026-08-22.md`;
2. `docs/product/evidence/KONTUR_CORE_DONE_REVALIDATION_2026-08-22.md`;
3. `docs/product/evidence/KONTUR_EVIDENCE_INDEX_2026-08-22.md`;
4. `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`;
5. `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`;
6. accepted 14.08 evidence;
7. `CURRENT_PRODUCT.md`, `ARCHITECTURE.md`, `CODEBASE_MAP.md`.

Файлы `KONTUR_REQUIREMENT_MATRIX_2026-08-18.md` и `KONTUR_FINAL_TZ_16_18_CLASSIFICATION_2026-08-18.md` сохранены как исторические audit snapshots и явно помечены superseded. Их старые `VERIFY_PENDING` не являются текущим verdict.

## Что свежо доказано

- clean exact-head checkout без overlay/temporary patch;
- frozen Linux install, pnpm 11.22, native Rollup/esbuild;
- Mini App, core, DB, bot и Worker tests;
- repository-wide TypeScript;
- production Vite build, `dist/index.html`, HTTP serve;
- real Playwright Chromium, 320×568 и 430×1000;
- normal и reduced motion;
- full UI journey, q1…q8, back lock, q8 gesture gate, hatch/reveal/Home continuity, palette, egg/equip, reload и replay;
- console/page/request errors = 0, horizontal overflow = 0, safe-area contract present, reveal copy is separated from the entire outer frame;
- canonical master art is decoded and independently checked for rendered pixel detail, so a tint-only silhouette cannot pass;
- восемь обязательных PNG + три обязательных WebM + дополнительные captures;
- exact isolated Cloudflare staging generation;
- live synthetic staging auth/questions/hatch/egg/equip/reload на реальном Worker/D1;
- строгая provenance граница от старого DONE `50b4426…`;
- воспроизводимый secret-safe owner package.

Binding IDs находятся в package `MANIFEST.json` и канонических GitHub comments. Product-baseline acceptance run: exact head `287b9aa294dbec0af077cdcf96e8e5b864f32c03`, Circle trigger `0b12fc5838b673962422ea015eafed1b3564bef8`, workflow `1cb18623-ee52-42a5-8a0f-ca53a994a1a8`, job `cb3ed7e5-ebc5-456d-ad0b-e68212d06860`, SUCCESS. Exact isolated staging build: `9ec8e6a5-38a6-485f-9e1f-cafa066b93cb`; immutable evidence branch: `evidence/kontur-core-287b9aa2-runtime2-20260822`.

## Как воспроизвести локальные gates

```bash
corepack enable
corepack prepare pnpm@11.22.0 --activate
pnpm install --frozen-lockfile
pnpm -F @kontur/miniapp test
pnpm -F @kontur/core test
pnpm -F @kontur/db test
pnpm -F @kontur/bot test
pnpm -F @kontur/worker test
pnpm -r --if-present typecheck
pnpm -F @kontur/miniapp build
pnpm -F @kontur/miniapp exec playwright install chromium
pnpm -F @kontur/miniapp test:browser:kontur
node tools/handoff-safety-check.mjs
```

Browser harness использует production `dist` и contract-faithful isolated API. Это UI proof. Live backend proof запускается отдельно против **только** `kontur-igor-staging` через `tools/cloudflare/live-release-staging-smoke.mjs`.

## Evidence artifacts

Имена обязательных файлов:

- `01-hook.png` … `08-home.png`;
- `motion-1-hook-to-q1.webm`;
- `motion-2-q1-q4-q8-cracks.webm`;
- `motion-3-q8-to-reveal.webm`.

Плюс captures drop/reload/replay/large/reduced-motion и `browser-acceptance.json`. Exact evidence branch и SHA-256 каждого файла записаны в owner-package manifest/index.

## Что запрещено после передачи

Без нового явного решения owner:

- не merge PR #12;
- не push/merge в `main`;
- не promote/switch production traffic;
- не писать в production Worker/D1;
- не делать destructive D1 reset;
- не менять production secrets или Telegram configuration;
- не использовать production как тестовый стенд.

Эти действия не являются незакрытым CORE blocker: они owner-constrained и намеренно не выполнялись.

## Что не передавать

Не добавлять в handoff:

- `.env`, API tokens, cookies/sessions/accounts;
- Cloudflare/Telegram credentials;
- production D1 dumps;
- browser profiles, private exports, encryption keys;
- `.git`, `node_modules`, `dist`, caches и временные runner files.

Использовать финальный owner package, а не старый ZIP `KONTUR_CORE_DONE_5ec223a_2026-08-22.zip`: тот архив был проверен и признан неполным/не привязанным к текущему дереву.
