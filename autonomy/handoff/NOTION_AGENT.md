# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 11:50–12:02 МСК — ZERO-MINUTE

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `333b3c07f7897b7d7aa6740476d18b2cad951b27`.

Что сделал:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и свежие PR #7/#8. Core не менялся и Windows/NCM28 не трогал.
2. Hosted CI не запускал и никаких push «ради проверки» не делал. Все новые проверки этой смены сначала прогонялись в бесплатной локальной среде ChatGPT.
3. Усилил уже подготовленную single-slot защиту. Новый тест теперь доказывает не только «единственный зарезервированный аккаунт нельзя украсть», но и аварийный выход: если владелец tool-chain исчез и не вызвал `clear()`, ожидание само заканчивается после TTL. Локальная проверка на укороченном TTL прошла: ожидание освободилось примерно через 0.03 с. Commit: `a99273208716a0c8b652e912a5c057afb4d16fab`.
4. Нашёл отдельную дыру в многошаговом child tool-loop: `_normalize_runtime_result()` считал валидным MCP-результат с `isError="true"`, `isError=1` или `isError=null`, потому что проверял только точное `is True`. Это могло превратить повреждённый/неверно типизированный ответ локального инструмента в успешный и заставить модель продолжить после фактически недоказанного действия.
5. Исправил нормализацию fail-closed: если поле `isError` присутствует, оно обязано быть настоящим JSON boolean. Любой другой тип теперь даёт нейтральный `tool_result_invalid`; текст/объект ошибки не протаскивается дальше. Локальный набор проверил `"true"`, `1`, `null`, обычный `false` и обычный `true`. Коммиты: `2ef8921058dce810699a72af7a4a148153099856`, `333b3c07f7897b7d7aa6740476d18b2cad951b27`.
6. Production, реальные Notion-аккаунты, provider traffic, Core и Windows-ветку не трогал.

Что уже доказано бесплатно в этой смене:
- single-slot reservation действительно ждёт освобождения единственного sticky-слота;
- abandoned reservation не превращает single-slot режим в вечную блокировку: TTL освобождает маршрут;
- malformed MCP `isError` больше не может маскироваться под успешный tool result;
- нормальный `isError=false` остаётся успешным, `isError=true` остаётся явной ошибкой инструмента.

Следующий шаг:
1. Не запускать CircleCI/GitHub Actions в ZERO-MINUTE режиме. Следующая полезная работа — материализовать уже fail-closed wiring непосредственно в `payload/server.py`, но только через полное локальное воспроизведение точного файла; не переписывать большой `server.py` через GitHub API частями или по памяти.
2. После прямой материализации убрать зависимость постоянных тестов от materializer: single-slot `wait + clear + TTL` должны проверяться уже на настоящем `ForegroundAccountReservations` из `server.py`.
3. Затем бесплатно локально прогнать prompt/routing/delegation/tool-loop набор. Native Windows verdict не подменять Linux; Windows нужен только для отдельной Core/NCM28 линии.
4. Только после крепкого локального ядра и при свободной уже авторизованной среде — один настоящий two-slot Codex project probe, затем один A→B failover probe без переноса старого Notion thread и без повторного локального side effect.
5. После устойчивого Notion/Codex ядра подключать Qwen adapter к тому же `DelegationDispatcher`, не смешивая account/thread state двух провайдеров.

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
