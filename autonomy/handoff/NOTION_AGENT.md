# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 04:46–05:05 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `1030084c819b9f4833544f69ecbff1d4b9d15dec`.

Что уже есть в Agent-линии:
- два режима системного промпта `engineer/owner`; приватный prompt владельца не переписывается и не смешивается с нашей инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, а незавершённая tool-цепочка сохраняет правильный account/thread;
- допустимый failover переносит полную локальную историю на другой легитимный слот, но не переносит старый Notion `thread_id`;
- child-session хранит историю, результаты инструментов и `call_id`, поэтому после failover уже выполненный локальный side effect не должен повторяться;
- remote-thread state дочернего агента теперь привязан к точному объекту provider-client, а не только к `id(client)`, поэтому повторное использование числового Python-id не может отдать новому клиенту старый Notion thread;
- готовы `DelegationDispatcher`, Notion child-runtime, `ServerSubagentLifecycle`, fail-closed server materializer и живые two-slot/failover/Codex project probes;
- живой failover-probe уважает реальное `disabled/cooldown/circuit-breaker` состояние и меняет только временный тестовый пул.

Что сделал в этой смене:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, предыдущий handoff и заново сверил PR #7/#8. В Windows/NCM28 не заходил.
2. Увидел, что Agent-ветка уже продвинулась после прошлого handoff до `68b0c4a1...`: отдельная работа усилила настоящий `codex exec` probe так, чтобы PASS требовал именно падения встроенного verifier и последующего успешного `VERIFY_OK`, а не любого случайного неуспешного shell-команда.
3. Проверил exact head `68b0c4a1...`: пять CircleCI jobs (`agent-contracts`, `routing-contracts`, `prompt-contracts`, `delegation-contracts`, `server-wiring-rehearsal`) всё ещё `pending`. Не стал дублировать прогоны и не запускал provider traffic.
4. Нашёл независимую дыру в идентичности будущих subagent-задач. `validate_delegation_request()` проверял `task_id == parent_turn_id` до нормализации пробелов. Поэтому `task_id=" child "` и `parent_turn_id="child"` считались разными, хотя lifecycle уже использует `strip()` для активной task identity. Это позволяло одному смысловому идентификатору проходить разные слои под разным написанием.
5. Исправил `payload/delegation_policy.py`: сравнение child/parent identity теперь делается по нормализованным значениям; `delegated_conversation_key()` тоже использует канонический task id. Коммит `5e532959d470c8eb3a37b466ae96cf695041a312`.
6. Добавил регрессии в `tests/test_delegation_policy.py`: whitespace-alias родительской identity должен fail-closed; разговорный ключ для `"  child-2  "` обязан стать ровно `delegate:notion:child-2`. Коммит `1030084c819b9f4833544f69ecbff1d4b9d15dec`.
7. На exact head `1030084c...` автоматически поднялся CircleCI workflow `19340f8c-5c96-4cd0-a8a5-7e29e995ce47`; на момент handoff пять Agent jobs ещё `pending`.

Главное новое понимание:
- идентичность дочерней задачи должна быть канонической на всех границах. Нельзя разрешать пробельные алиасы между parent/child identity, потому что lifecycle, локальный conversation key и будущие provider adapters иначе могут видеть одну и ту же задачу по-разному.
- этот фикс полностью независим от NCM28 и не меняет provider/account state.

Что делать дальше:
1. Снять итог CircleCI exact head `1030084c...`. Если новая delegation-регрессия красная — исправлять только конкретную причину. Если все пять jobs зелёные и `server-wiring-rehearsal` PASS, материализовать уже проверенный `ServerSubagentLifecycle` в настоящий `payload/server.py`.
2. Перед provider-run убедиться, что другой живой прогон не идёт. Затем ровно один `live_two_slot_codex_project_probe.py`: два независимых проекта должны занять два разных готовых легитимных слота и сохранить свои account/thread через tool-result.
3. После PASS — ровно один `live_codex_failover_project_probe.py`: A выполняет локальный write, затем временно исключается только в ephemeral pool; B продолжает полную локальную историю в новом Notion thread без повторного write.
4. Затем повторить тот же смысловой сценарий через настоящий `codex exec`.
5. После устойчивого Notion/Codex ядра подключать lifecycle к реальному server startup/auth-refresh/shutdown и затем добавлять Qwen adapter под тот же `DelegationDispatcher`, без общего provider state.
