# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 02:50–03:15 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `691af38d9bcf5e42b245c5f7e704fc9bed8c1d4f`.

Что уже было готово к началу смены:
- режимы `engineer/owner`, причём приватный prompt владельца не переписывается и не смешивается с нашей большой инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, незавершённая tool-цепочка сохраняет свой аккаунт/контекст;
- допустимый failover переносит полную локальную историю на новый слот, но не переносит старый Notion `thread_id`;
- child-session сохраняет историю/tool-result/call id через смену слота и не повторяет уже выполненный локальный side effect;
- собраны `DelegationDispatcher`, lifecycle и Notion child-runtime; серверный lifecycle пока проверяется через fail-closed materializer и `server-wiring-rehearsal`;
- реальный project-probe уже умеет `read_file → write_file → bash/verify`, а two-slot project-probe требует два независимых проекта, два разных аккаунта и два разных Notion thread;
- к началу этой смены Agent-ветка уже дошла до `4c151c6e...`: реальные схемы инструментов child-runtime и правильная обработка MCP `isError=true` уже присутствуют.

Что сделал в этой смене:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, handoff и заново сверил PR #7/#8. В Windows/NCM28 не заходил.
2. Проверил exact Agent head `4c151c6e...`: пять CircleCI jobs (`agent`, `routing`, `prompt`, `delegation`, `server-wiring-rehearsal`) всё ещё `pending`. Не стал ждать и не стал добавлять очередной синтетический тест.
3. Подготовил следующий обязательный живой гейт: `tools/live_codex_failover_project_probe.py`, первый коммит `b09b2b48da4476e7b95392c810de51380d8d9c28`.
4. Сценарий failover теперь конкретный: модель сама читает неизвестный токен из `input.txt`, делает `write_file`, после первого успешного локального write текущий слот временно исключается только внутри тестового пула; следующий модельный ход обязан перейти на другой легитимный аккаунт и новый Notion thread, получить уже готовый tool-result из полной локальной истории и закончить через `python verify.py`. Условия PASS: account A != B, thread A != B, локальная запись выполнена ровно один раз, verifier прошёл.
5. Расширил уже подключённый к `agent-contracts`/`routing-contracts` `tests/test_live_two_slot_probe_contract.py`: он теперь запрещает ложный PASS failover при том же аккаунте, том же thread или повторной локальной записи. Коммит `0b1b4330a948dd023668bb3ba5e4cf4abd58569b`.
6. После самопроверки усилил безопасность живого probe. Он по-прежнему использует отдельный временный `NotionAccountPool` без `state_path` и временные thread-state каталоги, но теперь **не обходит реальное состояние scheduler-а**: из обычного пула копируются `disabled`, текущий `cooldown_until` и глобальный circuit-breaker. Если сейчас нет двух реально готовых слотов, probe закрывается отказом, а не «оживляет» охлаждающийся/запрещённый аккаунт. Финальный коммит: `691af38d9bcf5e42b245c5f7e704fc9bed8c1d4f`.
7. Искусственный cooldown для переключения A→B существует только в ephemeral pool, поэтому обычный `pool-state.json` владельца не меняется. Тестовые локальные thread-state удаляются вместе с временным каталогом.
8. Probe не печатает account id, thread id, токены, пути credentials или provider payload. Пул и глобальный `server.account_pool` очищаются в `finally`.
9. На exact head `691af38d...` автоматически стартовал CircleCI workflow `09cd8a7c-da20-438d-85f7-18e31f29d940`; пять Agent jobs на момент handoff ещё `pending`. Provider/live traffic в этой смене не запускался.

Главное новое понимание:
- реальный failover можно проверять без загрязнения обычного scheduler/thread состояния и без обхода уже действующих cooldown/disabled/circuit-breaker;
- для доказательства безопасного продолжения недостаточно увидеть смену account: одновременно нужны новый remote thread и отсутствие повторного локального side effect;
- этот probe проверяет bridge-level Responses/Codex путь. Настоящий `codex exec` остаётся отдельным последующим гейтом.

Что делать дальше:
1. Снять итог CircleCI для exact head `691af38d...`. Если красный — исправлять только конкретный упавший контракт; если `server-wiring-rehearsal` зелёный, больше не откладывать материализацию уже проверенного lifecycle в настоящий `payload/server.py`.
2. Перед любым provider-run убедиться, что другой живой прогон не идёт. Первый живой прогон — `live_two_slot_codex_project_probe.py`: два независимых проекта на двух свободных слотах с sticky account+thread и двумя verifier.
3. После его PASS запустить ровно один `live_codex_failover_project_probe.py`: A выполняет локальный write, затем временно исключается только в ephemeral pool; B обязан продолжить с полной историей в новом Notion thread без повторного write.
4. После bridge-level PASS провести тот же смысловой путь через настоящий `codex exec`, не создавая второго конкурирующего реестра account/thread.
5. Затем подключать уже готовый `ServerSubagentLifecycle` к реальному startup/auth-refresh/shutdown (субагенты по умолчанию выключены), а после устойчивого Notion/Codex ядра — Qwen adapter под тот же `DelegationDispatcher`, без общего provider state.
