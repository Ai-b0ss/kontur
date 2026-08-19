# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 19:56 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `18427776e1cbab1a94224254039134470fcaa160`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Свежий head после этого запуска: `ceed71a9c7aa079ffaaf32294392cb54c677459e`. PR всё ещё основан на старом Core SHA `a62833f...`; текущий Core ушёл вперёд на 74 commit. Сравнение показывает, что Core после этой базы меняет `.circleci/config.yml` и Windows/NCM28 tools, но не `payload/server.py`, prompt-mode, account-pool или файлы делегирования. Перед слиянием нужна аккуратная синхронизация, особенно для `.circleci/config.yml`.

Что уже доказано раньше:
- режимы системного промпта `engineer` и `owner`;
- приватный `owner_system_prompt` идёт первым прикладным текстом без переписывания и без большой конкурирующей Codex-персоны;
- нейтральный `runtime_context` отделён от прикладного prompt;
- prompt/runtime policy входит в cache/thread identity только через SHA-256 без сохранения приватного текста;
- `payload/server.py` напрямую использует `compose_responses_planner_prompt(...)`;
- незавершённая tool-цепочка держит свой аккаунт, независимая новая задача обходит зарезервированный слот;
- lease-level тесты покрывают два свободных слота, закреплённое продолжение, ожидание занятого владельца, cooldown и fail-closed поведение;
- при допустимом failover старый Notion thread не переносится на другой аккаунт: полная локальная история создаёт новый thread на новом слоте;
- `tools/live_two_slot_codex_probe.py` готовит ограниченную настоящую проверку двух независимых Responses-задач и продолжения на своих слотах;
- provider-neutral `DelegationRequest`/`DelegationDispatcher`, `SubagentLifecycle`, `SubagentEntryPoint` и `NotionDelegationAdapter` отделяют child-задачу от provider state родителя;
- на прежнем exact head `61100e2b...` CircleCI был зелёным для основного prompt/routing/delegation contract-набора.

Что появилось перед этим запуском на той же Agent-ветке:
- ветка продвинулась с `b331d13d...` до `5018836355acdfb50067c28f62a0fe647321a66b`;
- добавлен `tools/live_codex_project_probe.py`: ограниченный настоящий проектный цикл `read_file -> write_file -> bash verify` через Responses/Notion; он работает только с маленьким временным проектом, разрешает строго три инструмента/пути и не знает тестовый маркер заранее;
- отдельный дублирующий тест project-probe затем убран, чтобы контракт оставался в существующей CI-проверке.

Что сделал в этом запуске:
1. Перечитал OWNER_INTENT/CURRENT/handoff и заново сверил PR #7/#8, свежие head и исходники.
2. Не трогал Windows/NCM28 и `.circleci/config.yml`: Core прямо сейчас меняет этот общий файл.
3. Закрыл следующий пункт прошлого handoff не только тестом, но и готовой композицией runtime: добавлен `payload/notion_subagent_runtime.py`.
4. `build_notion_subagent_entrypoint(...)` теперь явно связывает `SubagentEntryPoint -> DelegationDispatcher -> NotionDelegationAdapter -> обычный Notion account pool`. Источник `reserved_account_ids` сделан обязательным аргументом, поэтому реальная интеграция не сможет случайно запустить child-задачу без учёта аккаунтов, закреплённых за незавершёнными родительскими tool-цепочками.
5. Новый runtime по умолчанию остаётся выключенным. Простое создание объекта не запускает provider traffic.
6. Добавлен `tests/test_notion_subagent_runtime.py` с настоящим `NotionAccountPool` и fake Notion clients. Три end-to-end контракта:
   - child обходит `account-a`, если он зарезервирован незавершённой родительской цепочкой, и берёт свободный `account-b`;
   - два независимых child одновременно занимают два разных свободных легитимных слота;
   - если родительский слот зарезервирован, а единственный другой слот на cooldown, child fail-closed и не крадёт аккаунт родителя.
7. Новые изменения не касаются production, реальных аккаунтов, `server.py`, NCM28 или базы. Provider traffic не запускался.

Что ещё не завершено:
1. Свежий exact head `ceed71a9...` ещё не называю удалённо зелёным: общий Agent-CircleCI сейчас не запускает новые `test_subagent_entrypoint.py`/`test_notion_subagent_runtime.py`, а менять `.circleci/config.yml` поверх активного Core в этом запуске нельзя.
2. Когда Core освободит общий CircleCI-файл, добавить эти два теста в Agent-only contract job и получить один green run на exact head.
3. Затем ровно один настоящий two-slot live Codex probe в уже авторизованной среде, только если доказано отсутствие другого provider-run.
4. После двухслотового PASS — один bounded cooldown/failover сценарий: закреплённый аккаунт временно недоступен -> полная локальная история переносится на новый легитимный слот -> создаётся новый Notion thread, старый чужому аккаунту не передаётся.
5. Подключить `reserved_account_ids` нового runtime к реальному `ForegroundAccountReservations` в `server.py` только после синхронизации с Core; child runner должен использовать `context.conversation_key` как отдельную локальную цепочку.
6. После устойчивого живого Codex-ядра добавить Qwen adapter под тот же `DelegationDispatcher`, без общего account/thread state.

Следующий запуск: сначала проверить, освободился ли `.circleci/config.yml` от активной Core-работы. Если да — включить `tests/test_subagent_entrypoint.py` и `tests/test_notion_subagent_runtime.py` в Agent-only удалённый contract-run. Если общий CI-файл всё ещё занят, не конфликтовать: реализовать безопасный мост `ForegroundAccountReservations -> reserved_account_ids` отдельным маленьким модулем/тестом без правки `server.py`, либо подготовить fake end-to-end child runner с сохранением локальной conversation identity через несколько tool-result ходов.
