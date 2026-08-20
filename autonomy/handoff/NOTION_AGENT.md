# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 09:47–09:56 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `5cecbdf3f05e24ae3ae74560378177f0d9b8ea66`.

Что уже есть в Agent-линии:
- два режима системного промпта `engineer/owner`; приватный prompt владельца не переписывается и не смешивается с нашей инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, а незавершённая tool-цепочка сохраняет правильный account/thread;
- допустимый failover переносит полную локальную историю на другой легитимный слот, но не переносит старый Notion `thread_id` и не повторяет уже выполненный локальный side effect;
- готовы `DelegationDispatcher`, Notion child-runtime, `ServerSubagentLifecycle`, fail-closed server materializer и живые two-slot/failover/Codex project probes;
- дочерний tool-loop умеет исправлять ошибочный tool name, переживает допустимую смену слота и выдаёт разные локальные synthetic `call_id` для осмысленного повторного вызова после ошибки инструмента.

Что сделал в этой смене:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, прошлый handoff и заново сверил PR #7/#8. Core по-прежнему на `b6f4eef2...`; в Windows/NCM28 не заходил.
2. Увидел, что Agent-ветка после прошлого handoff уже продвинулась до `1978c0f5...`: там исправлена генерация synthetic `call_id`, чтобы повтор того же инструментального действия после реального ошибочного tool-result не считался повторным использованием старого call id.
3. Нашёл отдельную гонку в `SubagentLifecycle.run_many()`. До этой смены batch только проверял дубли внутри себя, а каждый child резервировал свой `task_id` уже после `create_task`. Если один id из batch одновременно уже выполнялся внешним `run_child`, свободный sibling мог успеть начать provider/local work до того, как конфликтующий sibling обнаружит занятый id и уронит весь batch. Это нарушало принцип «отклонённый batch не должен частично что-то сделать».
4. Исправил `payload/subagent_lifecycle.py`: весь канонический набор `task_id` теперь резервируется атомарно под одним lock до создания дочерних задач и до любого provider work. Если хотя бы один id уже активен, весь batch закрывается отказом с нулём новых побочных эффектов. Для этого выделен внутренний `_run_reserved_child()`. Коммит `2b2183f1850134cf94d6ea05779141eb6ff22888`.
5. Добавил регрессию `test_batch_conflict_with_active_child_fails_before_any_new_provider_work`: уже работает child `occupied`; batch содержит свободный `free-sibling` и конфликтующий `occupied`; batch обязан упасть до запуска `free-sibling`, а существующая child-задача продолжает жить. Коммит `5cecbdf3f05e24ae3ae74560378177f0d9b8ea66`.
6. Provider/live traffic, реальные Notion-аккаунты, production и Core-файлы не трогал. Свежий удалённый PASS для exact head `5cecbdf3...` пока не заявлять без результата CircleCI.

Главное новое понимание:
- атомарность нужна не только внутри одного tool-call batch. При параллельных субагентах сам batch дочерних задач тоже должен проходить единый admission gate: либо все его канонические task id зарезервированы до provider work, либо ни один sibling не начинает работу. Иначе ошибка идентичности одной child может оставить частичный внешний эффект от другой.

Что делать дальше:
1. Снять итог Agent CircleCI на exact head `5cecbdf3...`. Если красный — исправлять только конкретную причину.
2. Если `server-wiring-rehearsal` и остальные Agent jobs зелёные, материализовать уже проверенный `ServerSubagentLifecycle` непосредственно в настоящий `payload/server.py` через существующий fail-closed materializer. После этого повторить prompt/routing/delegation/server-wiring контракты уже на прямом server-коде.
3. Перед живым прогоном убедиться, что другого provider-run нет. Затем ровно один `live_two_slot_codex_project_probe.py`: два независимых проекта должны занять два разных готовых легитимных слота и сохранить свои account/thread через tool-result.
4. После PASS — один `live_codex_failover_project_probe.py`: A выполняет локальный write, затем временно исключается только в ephemeral pool; B продолжает полную локальную историю в новом Notion thread без повторного write.
5. Затем повторить тот же смысловой сценарий через настоящий `codex exec`. Только после устойчивого Notion/Codex ядра добавлять Qwen adapter под тот же `DelegationDispatcher`, без общего provider state.
