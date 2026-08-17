# Контур

> **Начни отсюда.** Это полная текущая рабочая Git-база Telegram Mini App + бота «Контур».  
> Она экспортирована из проверенного изолированного `v86-local-candidate` 14 августа и содержит актуальную H3/B/C/D product-line, backend, migrations, tests и release utilities.

## Что за продукт

Текущий замороженный цикл:

`8 вопросов один раз → птица → reply /worm → +1 червяк → 5 worms = egg → гарантированно новый окрас → equip → сохранение`

Первый пользовательский путь:

`«Какая ты птица в IT?» → большое hero egg → 8Q quiz → физические трещины → bird reveal → /worm → Home`

В текущем default UX **нет** дерева, daily move, прогнозов, рейдов, Form II, inventory, storm, leaderboard/streak/XP, AI narrator и прочих старых V4/V5 campaign-механик.

## Что уже реально сделано

Проект не находится в состоянии «нужно придумать hook с нуля».

После ТЗ 13 августа и работы через Codex 14 августа:
- STEP A: Hook Hybrid H3 — принят;
- STEP B: одно hero egg переезжает/уменьшается в q1 — принят;
- STEP C: 8 deterministic crack states — принят;
- STEP D: first-time-flow был собран; соответствующая stage-machine и assets присутствуют в текущем source;
- следующий предусмотренный product gate: STEP E — Bird Character Direction, 1–2 real UI concepts.

В исходнике это видно в `apps/miniapp/src/screens/LocalKontur.tsx` и `apps/miniapp/src/components/QuizEgg.tsx`; восемь физических стадий лежат в `apps/miniapp/public/quiz/`.

Подробнее: [`docs/product/DECISION_LOG_2026-08-14.md`](docs/product/DECISION_LOG_2026-08-14.md).

## Сначала прочитай

1. [`CURRENT_PRODUCT.md`](CURRENT_PRODUCT.md) — короткая продуктовая конституция;
2. [`docs/product/PRODUCT_BRIEF_2026-08-13.md`](docs/product/PRODUCT_BRIEF_2026-08-13.md) — полное актуальное ТЗ в рабочем виде;
3. [`docs/product/DECISION_LOG_2026-08-14.md`](docs/product/DECISION_LOG_2026-08-14.md) — прогресс после ТЗ;
4. [`ARCHITECTURE.md`](ARCHITECTURE.md) — архитектурные границы;
5. [`CODEBASE_MAP.md`](CODEBASE_MAP.md) — карта current/compatibility/archive;
6. [`HANDOFF.md`](HANDOFF.md) — передача проекта;
7. [`AGENTS.md`](AGENTS.md) — правила для AI/агентов;
8. [`docs/provenance/`](docs/provenance/) — происхождение этой source-базы;
9. [`docs/archive/README.md`](docs/archive/README.md) — исторический архив.

## Архитектура

- `apps/miniapp` — React/Vite Mini App;
- `apps/worker` — Cloudflare Worker + D1 runtime;
- `packages/core` — игровая логика;
- `packages/contracts` — общие контракты;
- `apps/api`, `apps/bot`, `packages/db` — local/reference/test/compatibility контур;
- `tools` — проверки, migrations/release/backup/staging utilities.

Старые V1–V5 runtime-модули пока сохранены внутри полной кодовой базы ради совместимости/recovery. **Наличие такого файла не означает, что его механика входит в текущий продукт.** Старые продуктовые документы, арт-направления и прототипы физически вынесены из рабочего корня в `docs/archive/legacy/`.

## Что известно о происхождении source

`docs/provenance/SOURCE_PROVENANCE_LOCAL.json` фиксирует, что экспорт в GitHub взят из:

`.../Codex/2026-08-14/.../v86-local-candidate/verification/result/source/kontur`

`docs/provenance/INTEGRATION_README_2026-08-14.md` хранит более раннюю доказательную цепочку v84 Worker + accepted derived frontend и результаты локальной проверки.

Текущий owner-visible preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

Отдельная forensic-оговорка: пока не доказана цепочка

`5dabce57 → immutable Cloudflare version → exact bundle/assets → exact Git source`,

нельзя говорить, что эта ветка **byte-for-byte** равна именно этому preview. Это не мешает использовать ветку как полную текущую рабочую кодовую базу и передать её разработчику.

## Проверка чистого клона

GitHub CI начинает с чистого checkout и выполняет:
- `pnpm install --frozen-lockfile`;
- отдельный `Handoff safety gate`;
- unit/integration/Worker tests;
- typecheck;
- economy/D1 checks;
- production Mini App build;
- изолированный Cloudflare staging dry-run.

Локально базовый полный gate:

```bash
pnpm install
pnpm check
```

Dev:

```bash
cp .env.example .env
pnpm dev
```

## Безопасность

Внешнему разработчику не нужны и не должны попадать в обычный Git handoff:
- plaintext `.env` и токены;
- Telegram sessions/accounts/cookies;
- Cloudflare credentials;
- production D1 dumps;
- private chat/research exports;
- browser profiles;
- encryption keys.

В `.runtime-state/` разрешён только уже зашифрованный `.gpg`; ключ хранится отдельно.

Production/deploy без отдельного согласования не трогать.

## Если тебе дали эту репу для работы

Начинай с этого README и `CURRENT_PRODUCT.md`, а не со старых V1/V2/V3/V4/V5 материалов.

Главное правило:

**`IMPLEMENTED != PRODUCT APPROVED`**.
