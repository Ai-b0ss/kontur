# Контур

> **CURRENT SOURCE OF TRUTH:** сначала читать [`CURRENT_PRODUCT.md`](CURRENT_PRODUCT.md).  
> Старые V1–V5 документы и наличие старого кода НЕ определяют текущий продукт.

«Контур» — Telegram Mini App + бот с простым социально-коллекционным ядром.

## Текущий MVP

`8 вопросов один раз -> птица -> reply /worm -> +1 червяк -> 5 worms = egg -> гарантированно новый cosmetic coloration -> equip -> reload сохраняет состояние`

Первый пользовательский путь:

`«Какая ты птица в IT?» -> большое яйцо -> 8Q quiz -> progressive cracks -> bird reveal -> /worm -> Home`

В текущем продукте **нет** daily move, tactical tree/ветвей, ежедневных 5 вопросов, прогнозов, рейдов, Form II, inventory, storm, leaderboard/streak, AI character, duplicate/refund gacha и старых перегруженных V3/V4/V5 surfaces. Исторический код этих систем пока может оставаться для compatibility/provenance, но не является продуктовым ТЗ.

## Важно про текущий preview

Owner указал текущий preview:

`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

Пока не доказана цепочка `5dabce57 -> exact Worker version -> exact frontend/source`, **нельзя утверждать, что `main` byte-for-byte равен этому preview**. Поэтому репозиторий сейчас проходит cleanup/provenance-аудит.

## Куда смотреть

- [`CURRENT_PRODUCT.md`](CURRENT_PRODUCT.md) — текущая продуктовая конституция;
- [`CODEBASE_MAP.md`](CODEBASE_MAP.md) — что считать current/candidate/legacy/private;
- [`PROJECT_STATE.yaml`](PROJECT_STATE.yaml) — короткое машинное состояние;
- [`SHARE_SAFE_SOURCE.md`](SHARE_SAFE_SOURCE.md) — правила чистой передачи исходников;
- [`docs/archive/README.md`](docs/archive/README.md) — исторический архив;
- [`AGENTS.md`](AGENTS.md) — правила для автономных агентов.

## Архитектура репозитория

- `apps/miniapp` — React/Vite Mini App;
- `apps/worker` — Cloudflare Worker + D1 runtime candidate;
- `packages/core` — игровая логика;
- `packages/contracts` — общие контракты;
- `apps/api`, `apps/bot`, `packages/db` — локальный/reference/test контур;
- `tools` — проверки, миграции, release/backup/staging utilities.

Наличие файла или route не означает product approval. До exact-preview provenance физическое удаление legacy runtime делается только после reachability-аудита.

## Локальная проверка

```bash
pnpm install
pnpm check
```

Для локального dev:

```bash
cp .env.example .env
pnpm dev
```

Секреты, production data и runtime state не должны попадать в внешний handoff.

## Текущий cleanup gate

1. связать `5dabce57` с exact source;
2. классифицировать каждый tracked file;
3. удалить/изолировать только доказанный legacy;
4. собрать воспроизводимый share-safe source archive;
5. не менять production/live data во время cleanup.