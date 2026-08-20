# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 03:50–04:10 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `d546c2b4bc575e8d3aa18ee1d0d8be3ab8382246`.

Что уже есть в Agent-линии:
- два режима системного промпта `engineer/owner`; приватный prompt владельца не переписывается и не смешивается с нашей инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, а незавершённая tool-цепочка сохраняет правильный account/thread;
- допустимый failover переносит полную локальную историю на другой легитимный слот, но не переносит старый Notion `thread_id`;
- child-session хранит историю, результаты инструментов и `call_id`, поэтому после failover уже выполненный локальный side effect не должен повторяться;
- готовы `DelegationDispatcher`, Notion child-runtime, `ServerSubagentLifecycle`, fail-closed server materializer и живые two-slot/failover project probes;
- живой failover-probe уважает реальное `disabled/cooldown/circuit-breaker` состояние и меняет только временный тестовый пул.

Что сделал в этой смене:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, предыдущий handoff и заново сверил PR #7/#8. В Windows/NCM28 не заходил.
2. Установил, что прошлый Agent head уже сдвинулся до `cca981db...`; пять CircleCI-проверок на нём всё ещё ожидали исполнителя. Не стал ждать и не запускал provider/live traffic.
3. Нашёл конкретную дыру в изоляции remote-thread state дочернего агента. `_NotionDelegatedModelSession` хранил состояние по одному `id(client)`. Python может переиспользовать целочисленный `id` после уничтожения старого объекта; в длинной child-сессии это теоретически позволяло новому provider-client получить состояние старого клиента и чужой `thread_id`.
4. Исправил `payload/notion_delegated_model_step.py`: `_RemoteThreadState` теперь удерживает точный объект клиента, а перед incremental-продолжением дополнительно проверяется `state.client is client`. Если числовой id совпал, но объект другой, это считается новым provider-client: ему отправляется полный локальный контекст без старого `thread_id`. Коммит `0fc20367d117c852cb4646cec4f7c6812edf54e9`.
5. Добавил регрессию `test_client_identity_guard_rejects_integer_id_collision`. Тест искусственно моделирует опасный результат повторного использования `id`: в ячейке нового клиента лежит thread-state старого. Ожидаемое поведение — новый клиент получает полный prompt и ни одного `thread_id`. Коммит `d546c2b4bc575e8d3aa18ee1d0d8be3ab8382246`.
6. На exact head `d546c2b4...` автоматически стартовал новый CircleCI workflow `49465f4d-f06f-4459-9b87-6b815404a36a`; `agent-contracts`, `routing-contracts`, `prompt-contracts`, `delegation-contracts`, `server-wiring-rehearsal` на момент handoff ещё `pending`.

Главное новое понимание:
- для безопасной ротации недостаточно связывать Notion thread с числовым `id()` Python-объекта; child-session должна проверять именно идентичность живого provider-client. Это особенно важно при смене поколений пула и долгих делегированных задачах.
- найденная проблема не относится к NCM28 и исправляется полностью внутри Agent-линии.

Что делать дальше:
1. Снять итог CircleCI exact head `d546c2b4...`. Если новая регрессия красная — исправлять только конкретную причину; если зелёная и `server-wiring-rehearsal` PASS, материализовать уже проверенный `ServerSubagentLifecycle` в настоящий `payload/server.py`.
2. Перед provider-run убедиться, что другой живой прогон не идёт. Затем ровно один `live_two_slot_codex_project_probe.py`: два независимых проекта должны занять два разных готовых легитимных слота и сохранить свои account/thread через tool-result.
3. После PASS — ровно один `live_codex_failover_project_probe.py`: A выполняет локальный write, затем временно исключается только в ephemeral pool; B продолжает полную локальную историю в новом Notion thread без повторного write.
4. Затем повторить тот же смысловой сценарий через настоящий `codex exec`.
5. Только после устойчивого Notion/Codex ядра подключать запуск subagent lifecycle к реальному server startup/auth-refresh/shutdown и затем добавлять Qwen adapter под тот же `DelegationDispatcher`, без общего provider state.
