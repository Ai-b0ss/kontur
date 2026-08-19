# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 23:58 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head при начале работы `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Свежий head после этого запуска: `8663366faeef3fcce3323ef74feea003523ccc56`.

Что уже доказано раньше:
- два режима системного промпта `engineer` и `owner`; приватный prompt владельца не переписывается и не смешивается с большой инженерной персоной;
- приватная prompt/runtime policy входит в cache/thread identity только через SHA-256, сам текст там не хранится;
- `payload/server.py` использует общую prompt-policy;
- незавершённая tool-цепочка держит свой легитимный аккаунт, а независимая новая работа обходит зарезервированный слот;
- допустимый failover A→B не переносит старый Notion `thread_id`: B получает полную локальную историю и создаёт новый remote thread;
- delegated child-session хранит локальную историю, tool-result, использованные call id и бюджет ходов через смену слота, поэтому уже выполненный локальный side effect повторно не запускается;
- `DelegationRequest` / `DelegationDispatcher` / `SubagentLifecycle` / `SubagentEntryPoint` / `NotionDelegationAdapter` / `NotionDelegatedModelStep` уже собираются в provider-ready Notion child runtime;
- предыдущий exact head `07798da1...` имел четыре зелёных Agent CircleCI job.

Что сделал в этом запуске:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, старый handoff и заново сверил PR #7/#8. Agent уже продвинулся до `484b9a6c...`; Core — до `b6f4eef2...`. В Windows/NCM28 не заходил.
2. Проверил новую `payload/server_subagent_runtime.py`: там уже есть безопасная server-facing композиция child runtime с существующим runtime-tool boundary, обязательным источником reservations и выключенным по умолчанию entrypoint.
3. Закрыл следующий реальный пробел — жизненный цикл этого runtime при смене серверного account pool. Добавил `payload/server_subagent_lifecycle.py`.
4. Новый `ServerSubagentLifecycle` создаётся без provider traffic, умеет привязать текущий обычный пул, перепривязаться после auth/runtime refresh и явно отвязаться при shutdown/сбросе. Новые child-запуски после перепривязки уже не держат ссылку на старый пул.
5. Gate остаётся динамическим: один и тот же установленный runtime может быть связан с пулом, но пока `enabled_predicate` ложный, provider/tool вызовы не начинаются.
6. Источник занятых слотов не дублируется: lifecycle получает тот же callback reservations, который при реальном server wiring должен быть `foreground_account_reservations.active_account_ids`.
7. Проверку lifecycle встроил в уже существующий `tests/test_notion_tool_subagent_runtime.py`, который входит в Agent-only `delegation-contracts`; отдельный дублирующий test-файл удалил.
8. Новый тест доказывает: unbound -> fail closed; bound+disabled -> 0 provider calls; активная reservation `account-a` отправляет child на `account-b`; после rebind на новый пул следующая child использует уже новый пул; после explicit unbind снова fail closed. Старый пул после rebind не получает новых вызовов.
9. `.circleci/config.yml`, `payload/server.py`, Windows/NCM28 и production не менял. Это специально оставлено независимым от движущегося Core.
10. На exact head `8663366f...` CircleCI workflow `04641a6d-fef5-474a-90f6-97afd3f1bed0` стартовал автоматически. На момент обновления handoff четыре Agent job (`agent-contracts`, `prompt-contracts`, `routing-contracts`, `delegation-contracts`) ещё `pending`; PASS не заявлять до финального статуса.
11. Provider/live traffic и реальные Notion-аккаунты не использовались.

Главное новое понимание:
- provider-ready subagent runtime надо привязывать не к вечному глобальному пулу, а к текущему поколению обычного серверного account pool. При auth/runtime refresh новые child-задачи должны сразу перейти на новый пул, иначе можно сохранить устаревшие provider clients;
- это можно сделать без второго реестра слотов и без хранения provider affinity в lifecycle: reservations остаются в существующем `ForegroundAccountReservations`, affinity — внутри обычного пула/child-session;
- построение и bind runtime сами по себе не должны запускать модель или локальные инструменты; единственная точка начала работы — явный `launch` после enabled gate.

Что ещё не завершено:
1. Снять финальный CircleCI для exact head `8663366f...`; особенно `delegation-contracts`, потому что именно он теперь содержит lifecycle-проверку.
2. Реально подключить `ServerSubagentLifecycle` к server startup/auth-refresh/shutdown: при создании/замене `account_pool` вызывать `bind_pool(account_pool)`, при teardown — `bind_pool(None)`. Источник reservations — только `foreground_account_reservations.active_account_ids`. Для этого нужен аккуратный маленький diff в `payload/server.py`, когда его область не занята другим работником; entrypoint оставить выключенным по умолчанию.
3. Не добавлять ещё один реестр занятых слотов и не передавать parent account/thread state в child runtime.
4. После зелёного lifecycle wiring — один ограниченный настоящий two-slot Codex/CLI run в уже авторизованной среде: две независимые foreground-задачи на разных свободных легитимных слотах, continuation на владельце.
5. Затем один bounded реальный cooldown/failover: A после уже выполненного локального tool уходит в cooldown; B получает полную локальную историю, создаёт новый Notion thread и продолжает без повторения side effect.
6. После устойчивого Notion/Codex ядра — Qwen adapter под тот же `DelegationDispatcher`, без общего account/thread state.

Следующий запуск: сначала проверить итог workflow `04641a6d-fef5-474a-90f6-97afd3f1bed0` и свежие head PR #7/#8. Если `delegation-contracts` зелёный и `payload/server.py` не меняет другой рабочий, сделать минимальное реальное wiring lifecycle к startup/refresh/shutdown без включения субагентов. Если server занят — не ждать, а взять отдельный Qwen-adapter/межпровайдерный контракт либо подготовить bounded live two-slot запуск без дублирования provider traffic.
