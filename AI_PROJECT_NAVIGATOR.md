# Контур — AI Project Navigator

**Версия:** 2.0 · 2026-08-17  
**Статус:** актуальная точка входа для AI/агентов.

## Сначала понять одну вещь

Репозиторий содержит несколько исторических эпох V1–V5. Это НЕ означает, что текущий продукт объединяет их.

Текущий продукт определён только в `CURRENT_PRODUCT.md`.

## Текущий MVP

`8 вопросов один раз -> птица -> reply /worm -> +1 червяк -> 5 worms = egg -> гарантированно новый cosmetic coloration -> equip -> reload сохраняет состояние`

Первый funnel:

`«Какая ты птица в IT?» -> hero egg -> 8Q -> progressive cracks -> bird reveal -> /worm -> HOME`

Не возвращать без нового owner decision: tree, daily move, daily 5Q, forecasts, raids, Form II, inventory, storm, leaderboard, streak, AI character, passive worms, duplicate/refund economy, старые перегруженные V3/V4/V5 default surfaces.

## Главная техническая неопределённость

Owner показывает текущий preview:
`https://5dabce57-kontur-igor.igorekglukhovskii43.workers.dev`

Exact source для него пока не доказан. Нельзя объявлять `main`, v84, v86 или любой старый snapshot current только по сходству. Нужна доказательная цепочка:

`5dabce57 -> Cloudflare version metadata -> exact asset hashes -> matching source/worktree`.

## Архитектурная карта

- `apps/miniapp` — frontend candidate;
- `apps/worker` — Cloudflare runtime candidate;
- `packages/core`, `packages/contracts` — shared logic/contracts;
- `apps/api`, `apps/bot`, `packages/db` — local/reference/test контур;
- `tools` — verification/release/staging/backup utilities;
- `docs/archive` — history only.

Внутри candidate-кода могут существовать старые routes/surfaces. Не развивать и не удалять их до классификации.

## Перед любой работой

1. прочитать `CURRENT_PRODUCT.md`;
2. прочитать `PROJECT_STATE.yaml`;
3. прочитать `CODEBASE_MAP.md`;
4. проверить `Ai-b0ss/kontur#9` и KONTUR CLAIM;
5. определить границу задачи;
6. только затем читать нужный код.

## Текущая P0 работа

1. exact provenance preview `5dabce57`;
2. exhaustive tracked-file classification;
3. archive/quarantine legacy docs/code без потери recovery evidence;
4. воспроизводимый share-safe source handoff;
5. после proof — минимизация runtime до реально используемого продукта.

## Запреты

No direct main push, no merge без нового явного owner authorization, no production mutation, no secrets/personal data, no assumption-based deletion, no resurrection of legacy product mechanics.