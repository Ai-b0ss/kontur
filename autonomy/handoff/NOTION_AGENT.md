# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 10:46–11:03 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `da7057ec71f90c1e544ce493bf4351ab93f7bbdb`.

Что уже есть в Agent-линии:
- два режима системного промпта `engineer/owner`; приватный prompt владельца не переписывается и не смешивается с нашей инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, а незавершённая tool-цепочка сохраняет правильный account/thread;
- допустимый failover переносит полную локальную историю на другой легитимный слот, но не переносит старый Notion `thread_id` и не повторяет уже выполненный локальный side effect;
- готовы `DelegationDispatcher`, Notion child-runtime, `ServerSubagentLifecycle`, fail-closed server materializer и живые two-slot/failover/Codex project probes;
- child-session переживает смену A → B и возврат на ранее использованный клиент: после продвижения истории на B старый thread A не возобновляется, а создаётся новый thread из полной локальной истории;
- batch дочерних задач проходит атомарный admission gate: если хотя бы один канонический `task_id` уже занят, никакой сосед из batch не начинает provider/local work.

Что сделал в этой смене:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и заново сверил PR #7/#8. Core по-прежнему на `b6f4eef2...`; Windows/NCM28 не трогал.
2. Agent-ветка к началу смены уже была на `a35e6fe3...`; два свежих коммита после прошлого handoff добавили защиту возврата delegated child на старый client/thread и включили эту регрессию в CircleCI.
3. Проверил известный single-slot reservation gap в `payload/server.py` и нашёл, что он двойной. Недостаточно убрать ранний `if pool_size <= 1: return set()` внутри `wait_for_background_route()`: сам `handle_openai_responses()` вообще вызывает этот wait только при `account_pool.size > 1`. Поэтому прежний план закрывал бы лишь половину дефекта.
4. Усилил fail-closed `tools/apply_server_subagent_lifecycle_wiring.py`, чтобы при будущей материализации он одновременно:
   - заменял early-return на реальное ожидание освобождения/TTL даже при одном слоте;
   - убирал внешний `account_pool.size > 1` gate, поэтому независимая новая работа действительно входит в reservation wait и в single-slot режиме;
   - сохранял прежнее поведение для нескольких слотов: если не все заняты резервациями, возвращается набор аккаунтов, которых надо избегать.
   Коммиты: `dc92edc429a61b4baf0aca0c95b0f8007eb1ae87`, `d0a509093e621470bb08dd4b5b09282014c621a6`.
5. Усилил `tests/test_server_subagent_wiring_materializer.py`. Тест теперь не только ищет строки, а извлекает материализованный `ForegroundAccountReservations`, запускает его отдельно и доказывает: при единственном зарезервированном аккаунте новая задача остаётся ждать; после `clear()` продолжает работу. Отдельно запрещено возвращение обоих старых обходов single-slot. Коммиты: `37a54dd470e823fea9092d5782df5989f716d86a`, `da7057ec71f90c1e544ce493bf4351ab93f7bbdb`.
6. На exact head `da7057ec...` автоматически поднялся CircleCI workflow `82b653d9-ba45-45eb-b5e8-9388b6596dbb`: `agent-contracts`, `routing-contracts`, `prompt-contracts`, `delegation-contracts`, `server-wiring-rehearsal` пока `pending`. PASS заранее не заявлять.
7. Provider/live traffic, реальные Notion-аккаунты, production и Core-файлы не трогал.

Главное новое понимание:
- single-slot reservation bug состоит из двух независимых обходов: early-return внутри reservation registry и caller-side условие `pool_size > 1`. Исправить только один из них — получить ложное ощущение защиты. Материализатор теперь закрывает оба сразу и fail-closed проверяет точный preimage.

Что делать дальше:
1. Снять итог CircleCI workflow `82b653d9-ba45-45eb-b5e8-9388b6596dbb` на exact head `da7057ec...`. Если красный — исправлять только конкретную причину.
2. Если `server-wiring-rehearsal` и остальные Agent jobs зелёные, применить уже проверенный materializer к настоящему `payload/server.py`. Это одним изменением внесёт `ServerSubagentLifecycle` и закроет оба single-slot reservation обхода. После materialization добавить/включить прямую регрессию в `tests/test_foreground_slot_routing.py`, чтобы single-slot защита проверялась уже без materializer.
3. Повторить prompt/routing/delegation/server-wiring контракты на прямом server-коде. После этого materializer должен либо стать migration-only, либо быть удалён из постоянного пути, чтобы не было двух источников истины.
4. Перед живым прогоном убедиться, что другого provider-run нет. Затем ровно один `live_two_slot_codex_project_probe.py`: два независимых проекта должны занять два разных готовых легитимных слота и сохранить свои account/thread через tool-result.
5. После PASS — один `live_codex_failover_project_probe.py`: A выполняет локальный write, затем временно исключается только в ephemeral pool; B продолжает полную локальную историю в новом Notion thread без повторного write.
6. Затем тот же смысловой сценарий через настоящий `codex exec`. Только после устойчивого Notion/Codex ядра добавлять Qwen adapter под тот же `DelegationDispatcher`, без общего provider state.
