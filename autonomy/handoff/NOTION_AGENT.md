# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 05:49–05:58 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `28a50a462ccc29eedd2102ece9c9257b2a268432`.

Что уже есть в Agent-линии:
- два режима системного промпта `engineer/owner`; приватный prompt владельца не переписывается и не смешивается с нашей инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, незавершённая tool-цепочка сохраняет правильный account/thread;
- допустимый failover переносит полную локальную историю на другой легитимный слот, но не переносит старый Notion `thread_id` и не повторяет уже выполненный локальный side effect;
- готовы `DelegationDispatcher`, Notion child-runtime, `ServerSubagentLifecycle`, fail-closed server materializer и живые two-slot/failover/Codex project probes;
- идентичность дочерней задачи теперь канонизируется в `DelegationRequest`: пробельные алиасы parent/child не считаются разными задачами, разговорный ключ строится из канонического `task_id`;
- свежая параллельная работа до начала этой смены дополнительно довела канонизацию до dispatcher/tool-loop и executor.

Что сделал в этой смене:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и заново сверил PR #7/#8. В Windows/NCM28 не заходил.
2. Увидел, что PR #8 уже продвинулся до `2a3520cd...` и что свежие изменения довели canonical task/tool identity до dispatcher и tool executor. Пять CircleCI jobs на том head всё ещё были `pending`; дубликат не запускал.
3. Нашёл следующий реальный разрыв той же цепочки: `SubagentLifecycle` резервировал активную задачу по `request.task_id.strip()`, но после dispatcher сравнивал `result.task_id` и `result.parent_turn_id` с исходными, неканоническими значениями. Поэтому допустимый запрос `task_id="  child  "` проходил policy/dispatcher, но потом ложно падал как `delegation result task_id mismatch`. Аналогичная проблема была у `parent_turn_id`.
4. Исправил `payload/subagent_lifecycle.py`: lifecycle один раз вызывает `validate_delegation_request()` и дальше использует ровно этот канонический request для reservation, dispatcher и result checks. Batch-путь тоже сначала канонизирует все requests и только потом проверяет дубликаты. Коммит `4d174ded0a0b9dbb2a81d6b471ec6e1efc9a5698`.
5. Добавил регрессии в `tests/test_subagent_lifecycle.py`: пробельные алиасы task/parent должны нормально пройти до адаптера уже как `child/parent`, а `child` и `"  child  "` в одном batch обязаны fail-closed до provider work. Коммит `28a50a462ccc29eedd2102ece9c9257b2a268432`.
6. На exact head `28a50a46...` автоматически поднялся CircleCI workflow `2959d0b2-a41b-4689-bfd7-aa000893c99c`; пять jobs (`agent-contracts`, `routing-contracts`, `prompt-contracts`, `delegation-contracts`, `server-wiring-rehearsal`) на момент handoff ещё `pending`. Provider traffic не запускал.

Главное новое понимание:
- канонизация identity должна происходить не только в policy/dispatcher, а до любого lifecycle reservation и до всех result-checks. Иначе разные слои могут честно использовать один смысловой task id, но всё равно ложно конфликтовать на строковом сравнении.
- этот фикс не касается account/provider state и независим от NCM28.

Что делать дальше:
1. Снять итог CircleCI exact head `28a50a46...`. Если красный — исправлять только конкретную причину. Если все пять jobs зелёные и `server-wiring-rehearsal` PASS, материализовать уже проверенный `ServerSubagentLifecycle` в настоящий `payload/server.py`.
2. Перед живым прогоном убедиться, что другого provider-run нет. Затем ровно один `live_two_slot_codex_project_probe.py`: два независимых проекта должны занять два разных готовых легитимных слота и сохранить свои account/thread через tool-result.
3. После PASS — ровно один `live_codex_failover_project_probe.py`: A выполняет локальный write, затем временно исключается только в ephemeral pool; B продолжает полную локальную историю в новом Notion thread без повторного write.
4. Затем повторить тот же смысловой сценарий через настоящий `codex exec`.
5. После устойчивого Notion/Codex ядра подключать lifecycle к реальному server startup/auth-refresh/shutdown и затем добавлять Qwen adapter под тот же `DelegationDispatcher`, без общего provider state.
