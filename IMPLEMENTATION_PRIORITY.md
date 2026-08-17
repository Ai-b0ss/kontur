# Контур — приоритеты реализации

## P0 — восстановить точную текущую базу

1. Доказать provenance preview `5dabce57`:
   `hostname → Cloudflare version → exact bundle/assets → exact source/worktree`.
2. Найти и сохранить Codex lineage 14.08:
   H3, Step B/C/D, review screens 01–08, WebM, flow board, assets/source/prompts.
3. Обновить file audit: каждый tracked file получает одну категорию:
   `CURRENT | CURRENT_CANDIDATE | COMPATIBILITY | TEST_INFRA | ARCHIVE | PRIVATE_EXCLUDED | UNKNOWN`.

До закрытия P0 не удалять спорный runtime/design code по имени версии.

## P1 — привести репозиторий к одной понятной истории

1. `README.md` — входная точка для человека.
2. `CURRENT_PRODUCT.md` — короткая продуктовая конституция.
3. `docs/product/PRODUCT_BRIEF_2026-08-13.md` — полное исходное ТЗ.
4. `docs/product/DECISION_LOG_2026-08-14.md` — что уже реально сделано и принято.
5. `ARCHITECTURE.md` — технические границы.
6. `CODEBASE_MAP.md` — классификация живого/архивного кода.
7. `HANDOFF.md` — как передать проект другому разработчику.

Исторические V1–V5 docs → `docs/archive/` с понятным индексом; не держать их рядом с current source-of-truth.

## P2 — текущая продуктовая реализация

После provenance восстановления продолжать НЕ с нового hook-concept, а с фактической точки 14.08:

- STEP A H3 — принят;
- STEP B continuity — принят;
- STEP C 8 crack states — принят;
- STEP D executable first-time flow — был собран и локально проверен, требует сверки с exact source/current preview;
- следующий продуктовый gate: **STEP E — Bird Character Direction, 1–2 real UI concepts**.

При этом, если exact `5dabce57` показывает более позднее owner-approved состояние, оно имеет приоритет после доказательства provenance.

## P3 — инженерная чистота

После определения exact current source:
- удалить или физически изолировать только доказанный dead legacy;
- разделить production/runtime migrations и local/reference migrations;
- устранить дублирующие/неиспользуемые entrypoints;
- сделать clean-clone reproducibility gate;
- собрать share-safe source package;
- оставить CI, который проверяет current MVP invariant.

## P4 — staging / deployment

Только после чистой базы:
- staging proof;
- mobile smoke 430×1000 и 320×568;
- safe preview upload;
- никакого production traffic switch без отдельного owner decision.

## Запрещённый scope creep

Не тратить время на tree/daily move/raid/forecast/Form II/inventory/storm/leaderboard/AI narrator и другие V4/V5 механики без нового явного решения owner.

## Главное правило

Каждая следующая работа должна либо:
1. снимать неопределённость о current source;
2. улучшать current approved funnel;
3. повышать воспроизводимость/безопасность передачи;
4. доказывать реальным тестом, что current invariant не сломан.

Всё остальное ниже по приоритету.
