# Контур

> **Текущий кандидат на передачу и проверку (19.08.2026).** Рабочая ветка: `fix/kontur-core-visual-continuity-20260818`, PR #12. Текущий проверяемый коммит: `60d1703a958757dc27222338cc41a9349382efb5`. Это развитие чистой handoff-базы `cleanup/repo-hygiene-shareable-source`: в нём собран текущий первый пользовательский путь, единая система шести визуальных персонажей и исправления непрерывности q1→q8→раскрытие. Полный Chromium/CircleCI и non-destructive Cloudflare staging proof для этого exact head ещё не закрыты, поэтому PR остаётся draft и в production не продвигается.
>
> **Начни отсюда.** Это единая текущая рабочая Git-база Telegram Mini App + бота «Контур». Она экспортирована из проверенного изолированного Codex `v86-local-candidate` 14 августа и содержит доказанную продуктовую линию A–E, Worker/D1 runtime, migrations, tests и release utilities.

## Что за продукт

Текущий замороженный цикл:

`8 вопросов один раз → птица → reply /worm → +1 червяк → 5 worms = egg → гарантированно новый окрас → equip → сохранение`

Первый пользовательский путь:

`«Какая ты птица в IT?» → большое hero egg → 8Q quiz → 8 физических стадий трещин → bird reveal → /worm → Home`

В текущем default UX **нет** дерева, daily move, прогнозов, рейдов, Form II, inventory, storm, leaderboard/streak/XP, AI narrator и прочих старых V4/V5 campaign-механик.

## Что уже реально сделано

Проект не находится в состоянии «нужно придумать hook/птиц с нуля».

После ТЗ 13 августа и работы через Codex 14–19 августа:
- **STEP A:** Hook Hybrid H3 — принят;
- **STEP B:** одно hero egg переезжает/уменьшается в q1 — принят;
- **STEP C:** 8 deterministic crack states — принят;
- **STEP D:** first-time flow `hook -> 8Q -> hatching -> reveal -> /worm -> Home` — интегрирован в current source;
- **STEP E:** принят и интегрирован — 5 canonical backend roles дают 6 visual results: сорока, дятел, сойка, журавль, сова и Котосов;
- Котосов не является шестой backend-role: это presentation-only вариант уже победившего `vibe`, когда `coder` — строго единственный сильнейший secondary score; ничья/неполные данные дают сову;
- q1–q7 теперь имеют явный React `visualQuestionIndex`: визуальное состояние яйца/прогресса меняется сразу после ответа, а номер вопроса коммитится после жеста;
- q8 разделяет `eggResponding` и `hatchReady`: видимое раскрытие начинается только после завершения жеста и готовности результата;
- hatching и reveal используют одну непрерывную сцену и один `QuizEgg`; отдельный дублирующий `ResultBird` удалён;
- текущая скорлупа раскрывается двумя согласованными половинами, птица остаётся за скорлупой;
- следующий обязательный gate — реальный Chromium user journey на exact head, затем isolated non-destructive staging и Telegram/WebView smoke.

Current implementation:
- `apps/miniapp/src/screens/LocalKontur.tsx`;
- `apps/miniapp/src/components/QuizEgg.tsx`;
- `apps/miniapp/src/result-taxonomy.ts`;
- `apps/worker/src/local-kontur-api.ts`.

## Exact product authority

В `docs/product/source/` лежат **точные исходные байты** двух первичных материалов 13 августа:

- `PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md` — SHA-256 `1f519becf36a44e1761a50c359e9dca02473c81f2f24194bb3c4c704052a436f`;
- `FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md` — SHA-256 `7d092fa46a21de7931bf2f1a26aaea21df5926cd51c322d2b2ad420700074cbe`.

В `docs/product/evidence/` восстановлены exact accepted evidence 14 августа:

- `PREVIEW_INTEGRATION_GATE_2026-08-14.md` — SHA-256 `a11802a8b4fab881b4b19877a086786273fd1f16b48746ac5872cd1f844ef0fb`;
- `RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md` — SHA-256 `5e6bdd4ca358d19ff1d1a97d93c0b1ccacea05ddd5d8756a17d253eb3d760bbe`.

`tools/handoff-safety-check.mjs` проверяет эти хэши fail-closed в clean checkout.

## Сначала прочитай

1. [`CURRENT_PRODUCT.md`](CURRENT_PRODUCT.md) — краткая текущая конституция;
2. [`docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md`](docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md) — exact primary transcript;
3. [`docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md`](docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md) — exact final ТЗ;
4. [`docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md`](docs/product/evidence/PREVIEW_INTEGRATION_GATE_2026-08-14.md) — exact интеграционный gate после STEP E;
5. [`docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md`](docs/product/evidence/RESULT_TAXONOMY_ALIGNMENT_2026-08-14.md) — exact taxonomy/owner acceptance;
6. [`docs/product/evidence/KONTUR_REQUIREMENT_MATRIX_2026-08-18.md`](docs/product/evidence/KONTUR_REQUIREMENT_MATRIX_2026-08-18.md) — текущая матрица выполненного/ожидающего проверки;
7. [`ARCHITECTURE.md`](ARCHITECTURE.md) и [`CODEBASE_MAP.md`](CODEBASE_MAP.md);
8. [`HANDOFF.md`](HANDOFF.md);
9. [`AGENTS.md`](AGENTS.md) — правила для AI/агентов;
10. [`docs/provenance/`](docs/provenance/) — provenance/release evidence;
11. [`docs/archive/README.md`](docs/archive/README.md) — история, не ТЗ.

## Архитектура

- `apps/miniapp` — React/Vite Mini App;
- `apps/worker` — Cloudflare Worker + D1 runtime;
- `packages/core` — игровая логика/scoring;
- `packages/contracts` — общие контракты;
- `apps/api`, `apps/bot`, `packages/db` — local/reference/test/compatibility контур;
- `tools` — проверки, migrations/release/backup/staging/provenance utilities.

Старые V1–V5 runtime-модули пока сохранены рядом с current source. `App.tsx` и Worker `api.ts` имеют runtime-imports/routes в часть старых surfaces, поэтому они **статически runtime-достижимы из production entrypoints** и удалять их по названию нельзя. Это ещё не доказательство, что каждый такой модуль оставил байты в финальном emitted bundle после tree-shaking, и тем более не product approval.

`tools/runtime-reachability.mjs` v2 отдельно строит runtime-import graph без `import type` и полный source-dependency graph с type-only зависимостями. Его результат — evidence для классификации, а не список на удаление.

## Что известно о происхождении source

`docs/provenance/SOURCE_PROVENANCE_LOCAL.json` фиксирует экспорт из:

`.../Codex/2026-08-14/.../v86-local-candidate/verification/result/source/kontur`

Для v84 отдельно доказаны immutable Worker Version `ab3cce08-12a0-4fa7-879b-9f6bbe838076` и Worker module SHA-256 `80510394f7a3e3c086b4c85e96dec0a555b105f5bbdb1e7c8f57d5f78dbdef39`.

Исторический owner-visible preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

Пока не доказана полная цепочка

`5dabce57 → immutable Cloudflare version → exact bundle/assets → exact Git source`,

нельзя говорить, что HEAD **byte-for-byte** равен именно этому preview. Это отдельный forensic gate.

## Production 17 августа

Guarded release run `32030041504`:
- сохранил rollback evidence до destructive reset;
- сбросил production D1 к свежей схеме и применил migrations;
- успешно выполнил deploy frozen handoff source;
- создал Worker Version `b6a03ac0-ec1f-43b9-886a-dd1664c9f6c1`;
- health check прошёл;
- последний asset-check получил старое публичное поколение assets сразу после deploy и поэтому стал красным.

Разбор: `docs/provenance/PRODUCTION_RELEASE_2026-08-17.md`.

Повторять destructive reset ради этого красного smoke **запрещено**. Release verifier теперь сначала ждёт exact SHA свежего `dist/index.html`, затем проверяет egg assets по `Content-Type: image/webp` + exact SHA.

## Проверка чистого клона

Базовый полный gate:

```bash
pnpm install --frozen-lockfile
pnpm check
```

Для текущего PR этого недостаточно для финального выпуска: нужен отдельный реальный Chromium/CircleCI user journey, затем isolated non-destructive staging и Telegram/WebView smoke именно на проверяемом exact head.

Dev:

```bash
cp .env.example .env
pnpm dev
```

## Deployment safety

**Не использовать `pnpm cf:deploy` или `pnpm -F @kontur/worker deploy` для production.** Эти команды намеренно fail-closed и завершаются до любого Cloudflare request.

Причина: прямой Wrangler deploy обходил rollback capture, D1 identity gate, current runtime vars и post-deploy convergence proof.

Production release допустим только через reviewed `.github/workflows/release-production.yml` после отдельного owner authorization. Staging — только изолированный и non-destructive.

## Безопасность

Внешнему разработчику не нужны и не должны попадать в обычный Git handoff:
- plaintext `.env` и токены;
- Telegram sessions/accounts/cookies;
- Cloudflare credentials;
- production D1 dumps;
- private chat/research exports;
- browser profiles;
- encryption keys.

Production/deploy без отдельного согласования не трогать.

## Главное правило

**`IMPLEMENTED != PRODUCT APPROVED`**.
