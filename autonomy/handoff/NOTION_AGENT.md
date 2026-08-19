# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 20:00 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `18427776e1cbab1a94224254039134470fcaa160`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Свежий head после этого запуска: `5a92f76936b9423a8dc59d6b0348017e1778fefe`. PR всё ещё основан на старом Core SHA `a62833f...`; текущий Core ушёл вперёд на 74 commit. Сравнение показывает, что Core после этой базы меняет `.circleci/config.yml` и Windows/NCM28 tools, но не `payload/server.py`, prompt-mode, account-pool или файлы делегирования. Перед слиянием нужна аккуратная синхронизация, особенно для `.circleci/config.yml`.

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
3. Добавил `payload/notion_subagent_runtime.py` — готовую композицию `SubagentEntryPoint -> DelegationDispatcher -> NotionDelegationAdapter -> обычный NotionAccountPool`.
4. Источник `reserved_account_ids` в `build_notion_subagent_entrypoint(...)` сделан обязательным. Нельзя случайно включить child-задачи без учёта аккаунтов, закреплённых за незавершёнными tool-цепочками родителя. Сам entry point по умолчанию по-прежнему выключен и при создании provider traffic не запускает.
5. Добавил `tests/test_notion_subagent_runtime.py` с настоящим `NotionAccountPool` и fake Notion clients. Три end-to-end контракта:
   - child обходит `account-a`, если он зарезервирован незавершённой родительской цепочкой, и берёт свободный `account-b`;
   - два независимых child одновременно занимают два разных свободных легитимных слота;
   - если родительский слот зарезервирован, а единственный другой слот на cooldown, child fail-closed и не крадёт аккаунт родителя.
6. Затем проверил реальный API `ForegroundAccountReservations` из `payload/server.py`: его `active_account_ids()` уже точно совпадает с обязательным callback нового runtime. Серверный реестр хранит account id незавершённых foreground tool-цепочек, очищается на завершении и сам вычищает протухшие reservation.
7. Добавил `tests/test_notion_subagent_server_reservations.py`: на настоящем `ForegroundAccountReservations` child при открытой родительской цепочке берёт `account-b`; после `clear()` того же родителя обычная балансировка снова разрешает `account-a`. То есть мост к реальному реестру теперь доказан без изменения большого `server.py`.
8. Новые изменения не касаются production, реальных аккаунтов, NCM28 или базы. Provider traffic не запускался.

Что ещё не завершено:
1. Свежий exact head `5a92f769...` ещё не называю удалённо зелёным: общий Agent-CircleCI сейчас не запускает новые `test_subagent_entrypoint.py`, `test_notion_subagent_runtime.py` и `test_notion_subagent_server_reservations.py`, а менять `.circleci/config.yml` поверх активного Core в этом запуске нельзя.
2. Когда Core освободит общий CircleCI-файл, добавить эти три теста в Agent-only contract job и получить один green run на exact head.
3. Затем ровно один настоящий two-slot live Codex probe в уже авторизованной среде, только если доказано отсутствие другого provider-run.
4. После двухслотового PASS — один bounded cooldown/failover сценарий: закреплённый аккаунт временно недоступен -> полная локальная история переносится на новый легитимный слот -> создаётся новый Notion thread, старый чужому аккаунту не передаётся.
5. После синхронизации с Core можно подключить новый runtime к реальному серверу буквально через `reserved_account_ids=foreground_account_reservations.active_account_ids`; child runner должен использовать `context.conversation_key` как отдельную локальную цепочку. Большой `server.py` сейчас специально не трогал.
6. После устойчивого живого Codex-ядра добавить Qwen adapter под тот же `DelegationDispatcher`, без общего account/thread state.

Следующий запуск: сначала проверить, освободился ли `.circleci/config.yml` от активной Core-работы. Если да — включить три новых subagent/runtime теста в Agent-only удалённый contract-run. Если общий CI-файл всё ещё занят, не конфликтовать: следующий независимый кусок — fake end-to-end child runner, который сохраняет `context.conversation_key` через несколько model/tool-result ходов и доказывает, что два child не смешивают локальную историю, после чего его можно будет напрямую заменить реальным Responses runner для bounded live-проверки.
