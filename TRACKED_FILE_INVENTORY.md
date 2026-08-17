# Контур — tracked-file inventory

**Статус:** поэтапный доказательный аудит · 2026-08-17  
**Ветка:** `cleanup/repo-hygiene-shareable-source`

Этот файл — постоянный журнал классификации tracked-файлов. Категория описывает роль файла в передаваемой кодовой базе, а не автоматически его продуктовую актуальность.

Допустимые категории:

- `CURRENT` — канонический текущий слой;
- `CURRENT_CANDIDATE` — вероятно относится к текущему состоянию, но provenance ещё не закрыт;
- `COMPATIBILITY` — нужен для совместимости/воспроизведения, но не задаёт продукт;
- `TEST_INFRA` — проверки, CI, локальные инструменты, backup/restore;
- `ARCHIVE` — историческое доказательство, не текущая инструкция;
- `PRIVATE_EXCLUDED` — не входит во внешний source handoff;
- `UNKNOWN` — доказательств пока недостаточно.

Главный запрет: до exact-gate `5dabce57 -> immutable Worker version -> bundle/assets -> source/worktree` нельзя удалять runtime только по имени V1–V5 или по предположению о его возрасте.

## 1. Корневой control-plane

| Path | Категория | Решение |
|---|---|---|
| `CURRENT_PRODUCT.md` | CURRENT | текущая продуктовая конституция |
| `PROJECT_STATE.yaml` | CURRENT | машинный указатель состояния и provenance gate |
| `README.md` | CURRENT | человеческая точка входа |
| `AGENTS.md` | CURRENT | обязательные правила для агентов |
| `AI_PROJECT_NAVIGATOR.md` | CURRENT | навигация по актуальной базе |
| `ARCHITECTURE.md` | CURRENT | текущая архитектурная карта |
| `IMPLEMENTATION_PRIORITY.md` | CURRENT | порядок реализации и гейтов |
| `CODEBASE_MAP.md` | CURRENT | карта слоёв кода |
| `HANDOFF.md` | CURRENT | инструкция передачи проекта |
| `BACKLOG.md` | CURRENT | текущие доказанные следующие задачи |
| `SHARE_SAFE_SOURCE.md` | CURRENT | контракт безопасной передачи исходников |
| `TRACKED_FILE_INVENTORY.md` | CURRENT | этот журнал классификации |

## 2. Product provenance

| Path | Категория | Решение |
|---|---|---|
| `docs/product/PRODUCT_BRIEF_2026-08-13.md` | CURRENT | удобное производное изложение ТЗ; не заменяет exact primary source |
| `docs/product/DECISION_LOG_2026-08-14.md` | CURRENT | решения и visual-gates после ТЗ |
| `docs/product/source/README.md` | CURRENT | fail-closed правила импорта exact primary sources |
| `docs/product/source/PRIMARY_SOURCE_IGOR_ZEZOKUK_2026-08-13.md` | UNKNOWN | обязательный exact snapshot ещё не импортирован: нужен byte-preserving source + size + SHA-256 |
| `docs/product/source/FINAL_TZ_HOOK_QUIZ_MOTION_ALIGNMENT.md` | UNKNOWN | обязательный exact 475-line snapshot ещё не импортирован по той же причине |
| Codex H3/B/C/D, review `01–08`, WebM, flow-board, assets/source/prompts 14.08 | CURRENT_CANDIDATE | текущая lineage; запрещено архивировать до восстановления exact provenance |

## 3. Runtime-каталоги

| Path | Категория | Решение |
|---|---|---|
| `apps/miniapp/` | CURRENT_CANDIDATE | содержит Mini App и исторические поверхности; точный deployed subset пока не доказан |
| `apps/worker/` | CURRENT_CANDIDATE | Cloudflare Worker/D1 runtime; exact связь с preview пока не доказана |
| `packages/core/` | CURRENT_CANDIDATE | содержит нужную и потенциально старую игровую логику; требуется reachability-аудит |
| `packages/contracts/` | CURRENT_CANDIDATE | общие контракты; точный current subset требует проверки |
| `apps/api/` | COMPATIBILITY | локальный/reference-контур; не считать вторым production runtime без доказательства |
| `apps/bot/` | COMPATIBILITY | локальный/reference Telegram-контур |
| `packages/db/` | COMPATIBILITY | локальная/reference DB-часть и совместимость |
| `tools/` | TEST_INFRA | локальные проверки, миграции, backup/restore и служебные инструменты; пофайловая проверка продолжается |

## 4. Git/CI/runtime state

| Path | Категория | Решение |
|---|---|---|
| `.github/workflows/ci.yml` | TEST_INFRA | основной CI |
| `.github/workflows/cloudflare-staging.yml` | TEST_INFRA | staging-only инфраструктура; production write не разрешает |
| `.github/ISSUE_TEMPLATE/` | TEST_INFRA | инженерный процесс |
| `.github/pull_request_template.md` | TEST_INFRA | инженерный процесс |
| `.env.example` | TEST_INFRA | только шаблон; проверить отсутствие реальных секретов в secret-scan gate |
| `.env.telegram-test.example` | TEST_INFRA | тестовый шаблон, не live credentials |
| `.runtime-state/` | PRIVATE_EXCLUDED | зашифрованное runtime-состояние хранится отдельно от share-safe source |
| `RESTORE_RUNTIME_STATE.ps1` | TEST_INFRA | восстановление локального encrypted runtime-state |
| `RESTORE_RUNTIME_STATE.sh` | TEST_INFRA | восстановление локального encrypted runtime-state |

## 5. Очевидная историческая документация, ещё встречающаяся в корне

Эти файлы не являются источником текущих требований. Физическое перемещение допустимо отдельным cleanup-коммитом после проверки ссылок; сама классификация уже запрещает агентам принимать их за current.

| Path | Категория |
|---|---|
| `COMMUNITY_RESEARCH_STAGE1_INTERIM.md` | ARCHIVE |
| `CURSOR_HANDOFF_2026-08-07.md` | ARCHIVE |
| `DESIGN.md` | ARCHIVE |
| `EXPERIENCE_SPEC_V1.md` | ARCHIVE |
| `HANDOVER.md` | ARCHIVE |
| `IMPLEMENTATION_PLAN_V1.md` | ARCHIVE |
| `PRODUCT_REDESIGN_BRIEF.md` | ARCHIVE |
| `PROJECT_PASSPORT.md` | ARCHIVE |
| `RESEARCH_SCOPE_V1.md` | ARCHIVE |
| `RESTORED_PRODUCT_V3.md` | ARCHIVE |

## 6. Пока не классифицировано окончательно

`DERIVED_CANDIDATE_README.md`, `INTEGRATION_README_2026-08-14.md`, `NEXT_CHAT_PROMPT.md`, `SHA256SUMS.txt`, `SNAPSHOT_INFO.txt`, `SOURCE_PROVENANCE_LOCAL.json` и остальные tracked-файлы, не перечисленные выше, остаются `UNKNOWN` до проверки содержимого и ссылочной достижимости. `UNKNOWN` не означает «мусор» и не разрешает удаление.

## 7. Что завершает аудит

1. получить полный машинный список tracked paths для exact head;
2. каждому blob назначить одну из категорий выше с кратким основанием;
3. доказать preview/version/source provenance;
4. проверить ссылки на `ARCHIVE` перед физическим перемещением;
5. прогнать fresh-clone install/check + secret scan;
6. после этого сформировать воспроизводимый share-safe manifest/package.

До выполнения этих пунктов этот inventory считается **частично заполненным, fail-closed**.