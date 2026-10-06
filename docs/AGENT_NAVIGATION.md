# Контур — карта кода для агента

## Где находится реальный продукт
| Зона | Начинать с | Дальше |
|---|---|---|
| Состояние и авторитет | `PROJECT_STATE.yaml` | `AI_PROJECT_NAVIGATOR.md`, `README.md`, `HANDOVER.md` |
| Telegram Mini App | `apps/miniapp/` | экраны, API-клиент, стили, public assets |
| Worker/API | `apps/worker/` | маршруты, Telegram-интеграция, D1/хранилище |
| Доменная логика | `packages/core/` | тесты/симуляторы, вызовы из worker |
| Баланс и проверки | `tools/sim/` | package scripts и отчёты |
| Продуктовая спецификация | `V5_PRODUCT_SPEC.md`, `PRODUCT_DIRECTION_V1.md` | backlog/experience spec |
| Исследование | `COMMUNITY_*`, `CHAT_RESEARCH_PROTOCOL.md` | не смешивать с реализованным runtime |
| Визуальные направления | `art-direction/`, `docs/direction-candidates-*` | reference/prototype, не source of truth |
| Старый прототип | `stage5-prototype/` | использовать только как исторический материал |

## Как проследить фичу
Начать с пользовательского экрана или команды бота, найти соответствующий вызов API, перейти в `apps/worker`, затем в `packages/core`, после чего проверить persistence/migration и ближайшие тесты. Для экономик/наград дополнительно проверить симуляцию и метрики.

## Авторитет
Текущий код и тесты > `PROJECT_STATE.yaml` > `AI_PROJECT_NAVIGATOR.md` > README/HANDOVER > WORKLOG > концептуальные документы. Это правило важнее совпадения названий файлов и веток.

## Ветки
Точные 103 ветки и их head SHA находятся в `.agent/branch-index.json`. `evidence/*` и многие `ci/*` должны рассматриваться как зафиксированные свидетельства, а не как место для новых правок.

## Построчное чтение
После checkout выполнить `python tools/build_agent_index.py`. В `.agent/local-code-index.json` будут line count, SHA256 и начала функций/классов для каждого текстового файла. Номера строк нельзя переносить между ветками.
