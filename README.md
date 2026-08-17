# Контур

> **Начни отсюда.** Это рабочая база Telegram Mini App + бота «Контур».  
> В репозитории исторически накопилось несколько поколений V1–V5, поэтому наличие файла/route **не означает**, что это текущая продуктовая фича.

## Что за продукт

Текущий замороженный цикл:

`8 вопросов один раз → птица → reply /worm → +1 червяк → 5 worms = egg → гарантированно новый окрас → equip → сохранение`

Первый пользовательский путь:

`«Какая ты птица в IT?» → большое hero egg → 8Q quiz → физические трещины → bird reveal → /worm → Home`

В текущем default UX **нет** дерева, daily move, прогнозов, рейдов, Form II, inventory, storm, leaderboard/streak/XP, AI narrator и прочих старых V4/V5 campaign-механик.

## Что уже утверждено визуально

Проект не находится в состоянии «нужно придумать hook с нуля».

После owner-approved ТЗ 13 августа и работы через Codex 14 августа:
- STEP A: Hook Hybrid H3 — принят;
- STEP B: одно hero egg переезжает/уменьшается в q1 — принят;
- STEP C: 8 deterministic crack states — принят;
- STEP D: first-time-flow mock был собран и локально проверен;
- следующий предусмотренный product gate: STEP E — Bird Character Direction, 1–2 real UI concepts.

Подробнее: [`docs/product/DECISION_LOG_2026-08-14.md`](docs/product/DECISION_LOG_2026-08-14.md).

## Сначала прочитай

1. [`CURRENT_PRODUCT.md`](CURRENT_PRODUCT.md) — короткая продуктовая конституция;
2. [`docs/product/PRODUCT_BRIEF_2026-08-13.md`](docs/product/PRODUCT_BRIEF_2026-08-13.md) — полное актуальное ТЗ;
3. [`docs/product/DECISION_LOG_2026-08-14.md`](docs/product/DECISION_LOG_2026-08-14.md) — что уже реально произошло после ТЗ;
4. [`ARCHITECTURE.md`](ARCHITECTURE.md) — архитектурные границы;
5. [`IMPLEMENTATION_PRIORITY.md`](IMPLEMENTATION_PRIORITY.md) — что делать в каком порядке;
6. [`CODEBASE_MAP.md`](CODEBASE_MAP.md) — current/legacy/test/private классификация;
7. [`HANDOFF.md`](HANDOFF.md) — как безопасно передать код человеку;
8. [`AGENTS.md`](AGENTS.md) — правила автономной разработки;
9. [`docs/archive/README.md`](docs/archive/README.md) — исторический архив.

## Текущая архитектура

- `apps/miniapp` — React/Vite Mini App;
- `apps/worker` — Cloudflare Worker + D1 runtime candidate;
- `packages/core` — игровая логика;
- `packages/contracts` — общие контракты;
- `apps/api`, `apps/bot`, `packages/db` — local/reference/test/compatibility контур до завершения reachability-аудита;
- `tools` — проверки, migrations/release/backup/staging utilities.

## Важный provenance gate

Owner-visible current preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

Пока не доказана цепочка:

`5dabce57 → immutable Cloudflare version → exact bundle/assets → exact source/worktree`

**нельзя утверждать, что `main`, v84 или v86 byte-for-byte соответствует этому preview.**

Поэтому current P0 — не новый redesign, а восстановление exact source + Codex lineage 14.08 + пофайловая классификация.

## Локальная проверка

```bash
pnpm install
pnpm check
```

Локальный dev:

```bash
cp .env.example .env
pnpm dev
```

Цель cleanup — чтобы clean clone работал без скрытой зависимости от домашнего ПК владельца.

## Безопасность

Внешнему разработчику не нужны и не должны попадать в обычный Git handoff:
- `.env` и токены;
- Telegram sessions/accounts/cookies;
- Cloudflare credentials;
- production D1 dumps;
- private chat/research exports;
- browser profiles/runtime state;
- encryption keys.

Production/deploy без отдельного согласования не трогать.

## Если тебе дали эту репу для работы

Не начинай с V1/V2/V3/V4/V5 документов. Сначала прочитай список выше.

Главное правило:

**`IMPLEMENTED != PRODUCT APPROVED`**.

Если задача относится к cleanup/recovery, не удаляй спорный runtime или Codex artifacts только потому, что путь выглядит старым: сначала докажи provenance/reachability.
