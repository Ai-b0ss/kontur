# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 00:55 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head при начале работы `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Свежий head после этого запуска: `430f692b540e9c5aca3d950dac54430991acd08d`.

Что уже доказано раньше:
- два режима системного промпта `engineer` и `owner`; приватный prompt владельца не переписывается и не смешивается с большой инженерной персоной;
- приватная prompt/runtime policy входит в cache/thread identity только через SHA-256, сам текст там не хранится;
- `payload/server.py` использует общую prompt-policy;
- незавершённая tool-цепочка держит свой легитимный аккаунт, а независимая новая работа обходит зарезервированный слот;
- допустимый failover A→B не переносит старый Notion `thread_id`: B получает полную локальную историю и создаёт новый remote thread;
- delegated child-session хранит локальную историю, tool-result, использованные call id и бюджет ходов через смену слота, поэтому уже выполненный локальный side effect повторно не запускается;
- `DelegationRequest` / `DelegationDispatcher` / `SubagentLifecycle` / `SubagentEntryPoint` / `NotionDelegationAdapter` / `NotionDelegatedModelStep` уже собираются в provider-ready Notion child runtime;
- `ServerSubagentLifecycle` уже умеет привязывать текущее поколение обычного account pool, перепривязываться и оставлять entrypoint выключенным по умолчанию.

Что сделал в этом запуске:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, старый handoff и заново сверил PR #7/#8. В Windows/NCM28 не заходил.
2. Проверил реальный `payload/server.py`: обычный серверный пул создаётся в `startup()`, закрывается в `shutdown()`, а существующий `foreground_account_reservations.active_account_ids` уже является правильным единственным источником занятых родительскими tool-цепочками слотов.
3. Перед прямым server wiring нашёл гонку в `ServerSubagentLifecycle`: старый `bind_pool(None)`/rebind мог убрать ссылку на старый runtime и затем сервер теоретически мог закрыть старый provider pool, пока уже захватившая старый entrypoint child-задача ещё не успела отразиться во внутреннем `SubagentLifecycle.status()`.
4. Исправил это в `payload/server_subagent_lifecycle.py`. Теперь lifecycle сам учитывает активные launches по конкретному поколению entrypoint под одной `asyncio.Condition`, то есть child считается активной уже в момент захвата старого поколения, до входа в provider-код.
5. Добавлены `rebind_pool_and_drain(pool)` и `unbind_and_drain()`. Сначала новые child-запуски атомарно переключаются на новый pool (или начинают отклоняться при shutdown), затем метод ждёт завершения всех child-задач старого поколения. После возврата старый provider pool можно безопасно закрывать.
6. Обычный `bind_pool()` оставлен как дешёвая примитива для тестов/владельцев двух поколений; серверный refresh/shutdown должен использовать именно drain-варианты перед закрытием старого пула.
7. Добавил `tests/test_server_subagent_lifecycle_drain.py`: проверяется, что во время rebind старая child спокойно заканчивает на старом runtime, новая уже идёт через новый runtime, а rebind не завершается до окончания старой; при shutdown новые launches отклоняются сразу, но уже начатая child получает время закончить.
8. `.circleci/config.yml` специально не менял: Agent-ветка несёт устаревшую относительно свежего Core Windows-конфигурацию (Core уже на v32), поэтому нельзя перетирать её ради добавления одного теста. Существующие Agent jobs после коммитов запускаются автоматически, но новый отдельный drain-test пока не входит в их явный список.
9. `payload/server.py` в этом запуске не менял: прямой wiring теперь должен использовать `rebind_pool_and_drain`/`unbind_and_drain`, а не прежний небезопасный `bind_pool(None)` перед `aclose()`.
10. Provider/live traffic и реальные Notion-аккаунты не использовались.

Главное новое понимание:
- безопасная ротация поколения provider pool состоит из двух независимых фаз: атомарно прекратить выдавать старый runtime новым child-задачам, затем дождаться уже захвативших его child-задач и только после этого закрывать старые provider clients;
- одного `entrypoint.status().active` для этого недостаточно из-за окна между захватом entrypoint в server lifecycle и фактическим входом в `SubagentLifecycle.run_child`; активность надо учитывать на внешней границе жизненного цикла;
- существующий `foreground_account_reservations` остаётся единственным реестром занятых родительских слотов, второй реестр не нужен.

Что ещё не завершено:
1. Включить `tests/test_server_subagent_lifecycle_drain.py` в Agent-only удалённый набор после безопасной синхронизации `.circleci/config.yml` со свежим Core, не откатывая его Windows v32.
2. Минимально подключить lifecycle к реальному `payload/server.py`: создать один `ServerSubagentLifecycle` с `foreground_account_reservations.active_account_ids`, `call_runtime_tool` и динамическим gate; после успешного `build_account_pool` привязывать текущий pool; при будущей замене пула использовать `rebind_pool_and_drain(new_pool)` и закрывать старый pool только после возврата; при shutdown — `unbind_and_drain()` перед `account_pool.aclose()`.
3. Entry point оставить выключенным по умолчанию; простое создание/bind runtime не должно запускать provider traffic или локальные инструменты.
4. После зелёного server wiring — один ограниченный настоящий two-slot Codex/CLI run в уже авторизованной среде: две независимые foreground-задачи на разных свободных легитимных слотах, continuation на владельце.
5. Затем один bounded реальный cooldown/failover: A после уже выполненного локального tool уходит в cooldown; B получает полную локальную историю, создаёт новый Notion thread и продолжает без повторения side effect.
6. После устойчивого Notion/Codex ядра — Qwen adapter под тот же `DelegationDispatcher`, без общего account/thread state.

Следующий запуск: сначала заново сверить свежий Core/Agent head. Если `payload/server.py` по-прежнему не менялся Core-линией, сделать минимальное реальное wiring lifecycle к `startup/shutdown` с безопасным drain и выключенным gate. Не менять Core Windows-файлы. Затем синхронизировать Agent-only CircleCI поверх свежего Core так, чтобы новый drain-test вошёл в удалённый набор без отката NCM28-конфигурации.
