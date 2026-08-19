# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 02:50–03:10 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `0b1b4330a948dd023668bb3ba5e4cf4abd58569b`.

Что уже было готово к началу смены:
- режимы `engineer/owner`, причём приватный prompt владельца не переписывается и не смешивается с нашей большой инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, незавершённая tool-цепочка сохраняет свой аккаунт/контекст;
- допустимый failover переносит полную локальную историю на новый слот, но не переносит старый Notion `thread_id`;
- child-session сохраняет историю/tool-result/call id через смену слота и не повторяет уже выполненный локальный side effect;
- собраны `DelegationDispatcher`, lifecycle и Notion child-runtime; серверный lifecycle пока проверяется через fail-closed materializer и `server-wiring-rehearsal`;
- реальный project-probe уже умеет `read_file → write_file → bash/verify`, а two-slot project-probe требует два независимых проекта, два разных аккаунта и два разных Notion thread;
- к началу этой смены другой рабочий уже довёл Agent-ветку до `4c151c6e...`: реальные схемы инструментов child-runtime и правильная обработка MCP `isError=true` уже присутствуют.

Что сделал в этой смене:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, handoff и заново сверил PR #7/#8. В Windows/NCM28 не заходил.
2. Проверил exact Agent head `4c151c6e...`: пять CircleCI jobs (`agent`, `routing`, `prompt`, `delegation`, `server-wiring-rehearsal`) всё ещё `pending`. Не стал ждать и не стал плодить ещё один синтетический тест.
3. Подготовил следующий обязательный живой гейт: `tools/live_codex_failover_project_probe.py`, коммит `b09b2b48da4476e7b95392c810de51380d8d9c28`.
4. Новый probe использует настоящие уже авторизованные Notion credentials, но создаёт отдельный временный пул: scheduler state не сохраняется (`state_path=None`), тестовые thread-state пишутся только во временный каталог. Поэтому искусственный cooldown одного слота не меняет обычный `pool-state.json` владельца и после процесса не остаётся локального тестового thread-state.
5. Сценарий failover теперь конкретный: модель сама читает неизвестный токен из `input.txt`, делает `write_file`, после первого успешного локального write текущий слот временно исключается только внутри временного пула; следующий модельный ход обязан перейти на другой легитимный аккаунт и новый Notion thread, получить уже готовый tool-result из полной локальной истории и закончить через `python verify.py`. Условия PASS: account A != B, thread A != B, локальная запись выполнена ровно один раз, verifier прошёл.
6. Probe не печатает account id, thread id, токены, пути credentials или provider payload. Пул и глобальный `server.account_pool` очищаются в `finally`.
7. Расширил уже подключённый к `agent-contracts`/`routing-contracts` файл `tests/test_live_two_slot_probe_contract.py`: он теперь запрещает ложный PASS failover при том же аккаунте, том же thread или повторной локальной записи. Коммит `0b1b4330a948dd023668bb3ba5e4cf4abd58569b`.
8. На exact head `0b1b4330...` автоматически стартовал CircleCI workflow `e88ebdc0-1160-42bc-9f39-bc052406df88`; пять Agent jobs на момент handoff ещё `pending`. Provider/live traffic в этой смене не запускался.

Главное новое понимание:
- failover-гейт можно сделать реальным и при этом не загрязнять обычное состояние scheduler-а: валидированные credential-файлы можно использовать через отдельные временные `MaxEffortNotionAgentClient`, а `NotionAccountPool` поднять без `state_path`;
- для доказательства безопасного продолжения недостаточно увидеть смену account. Нужно одновременно доказать новый remote thread и отсутствие повторного локального side effect;
- этот probe проверяет именно bridge-level Responses/Codex путь. Настоящий `codex exec` остаётся отдельным последующим гейтом.

Что делать дальше:
1. Снять итог CircleCI для exact head `0b1b4330...`. Если красный — исправлять только конкретный упавший контракт; если `server-wiring-rehearsal` зелёный, больше не откладывать материализацию уже проверенного lifecycle в настоящий `payload/server.py`.
2. Перед любым provider-run убедиться, что другой живой прогон не идёт. Первый живой прогон — `live_two_slot_codex_project_probe.py`: два независимых проекта на двух свободных слотах с sticky account+thread и двумя verifier.
3. После его PASS запустить ровно один `live_codex_failover_project_probe.py`: A выполняет локальный write, затем временно исключается только в ephemeral pool; B обязан продолжить с полной историей в новом Notion thread без повторного write.
4. После bridge-level PASS провести тот же смысловой путь через настоящий `codex exec`, не создавая второго конкурирующего реестра account/thread.
5. Затем подключать уже готовый `ServerSubagentLifecycle` к реальному startup/auth-refresh/shutdown (субагенты по умолчанию выключены), а после устойчивого Notion/Codex ядра — Qwen adapter под тот же `DelegationDispatcher`, без общего provider state.
