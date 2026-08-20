# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 08:54–09:02 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `073a543159267ada4da25b5bf841433eee9f812d`.

Что сделал в этой смене:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, прошлый handoff и заново сверил PR #8. Ветка к началу запуска уже ушла вперёд до `8d476322...`: добавлена проверка, что ошибочное имя инструмента возвращается модели как обычный tool-result и она может исправить вызов в том же дочернем треде.
2. Проверил exact-head CI: пять Agent job на `8d476322...` всё ещё ждали CircleCI. Не стал тратить запуск на ожидание и не трогал Windows/NCM28.
3. Нашёл реальную дыру в уже подготовленном server materializer. В сгенерированном `shutdown()` `subagent_lifecycle.unbind_and_drain()` и `account_pool.aclose()` шли последовательно в одном `try`. Если drain выбрасывал исключение или shutdown получал отмену в этот момент, закрытие provider-пула пропускалось, а старые авторизованные клиенты могли пережить нештатный teardown.
4. Исправил `tools/apply_server_subagent_lifecycle_wiring.py`: закрытие `account_pool` теперь находится во внешнем `finally` после попытки drain, а очистка `BRIDGE_AUTH_SECRET` — во вложенном `finally`. Поэтому provider-пул закрывается даже при ошибке drain. Коммит `8c2ef86508e5d19bc89e75abc7cbb23f72f0279c`.
5. Усилил `tests/test_server_subagent_wiring_materializer.py`: отдельная регрессия проверяет порядок `unbind -> finally -> pool close -> auth clear`, чтобы будущий materializer снова не сделал закрытие пула зависимым от успешного drain. Коммит `073a543159267ada4da25b5bf841433eee9f812d`.
6. На exact head `073a5431...` автоматически поднялся CircleCI workflow `f14a34e0-475a-408d-be96-f0015843160b`; `agent-contracts`, `routing-contracts`, `prompt-contracts`, `delegation-contracts`, `server-wiring-rehearsal` на конец смены ещё `pending`. Provider/live traffic не запускал.

Главное новое понимание:
- drain дочерних задач и закрытие provider-пула — две разные обязанности shutdown. Ошибка/отмена drain не должна оставлять авторизованный пул открытым; серверный wiring обязан гарантировать cleanup независимо от результата ожидания child-задач.

Что делать дальше:
1. Снять итог CircleCI exact head `073a5431...`. Если красный — исправлять только конкретную причину. Если все пять Agent jobs зелёные, материализовать уже проверенный `ServerSubagentLifecycle` непосредственно в настоящий `payload/server.py` через существующий fail-closed materializer.
2. После материализации повторить prompt/routing/delegation/server-wiring контракты уже на прямом server-коде.
3. Перед живым прогоном убедиться, что другого provider-run нет. Затем один `live_two_slot_codex_project_probe.py`: два независимых проекта должны занять два разных готовых легитимных слота и сохранить свои account/thread через tool-result.
4. После PASS — один `live_codex_failover_project_probe.py`: A выполняет локальный write, затем временно исключается только в ephemeral pool; B продолжает полную локальную историю в новом Notion thread без повторного write.
5. Затем повторить тот же смысловой сценарий через настоящий `codex exec`. Только после устойчивого Notion/Codex ядра добавлять Qwen adapter под тот же `DelegationDispatcher`, без общего provider state.

## 2026-08-20 07:48–08:02 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `659304b9a6385e9b4862812ffaf2e59f8397b7bc`.

Что уже есть в Agent-линии:
- два режима системного промпта `engineer/owner`; приватный prompt владельца не переписывается и не смешивается с нашей инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, а незавершённая tool-цепочка сохраняет правильный account/thread;
- допустимый failover переносит полную локальную историю на другой легитимный слот, но не переносит старый Notion `thread_id` и не повторяет уже выполненный локальный side effect;
- готовы `DelegationDispatcher`, Notion child-runtime, `ServerSubagentLifecycle`, fail-closed server materializer и живые two-slot/failover/Codex project probes;
- идентичность child-задач канонизируется по всей цепочке policy → lifecycle → dispatcher → tool-loop;
- родительская reservation теперь перепроверяется не только после выбора слота, но и перед каждой фактической provider-попыткой внутри `lease.run`, включая внутренний failover на другой аккаунт.

Что сделал в этой смене:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, прошлый handoff и заново сверил PR #7/#8. Core остался на `b6f4eef2...`; Windows/NCM28 не трогал.
2. Увидел, что Agent-ветка уже ушла вперёд от прошлого handoff до `42f14828...`: там закрыта атомарность malformed tool-call batch — плохая пачка не съедает model-turn budget, не фиксирует call id и не оставляет частичную историю.
3. Нашёл реальную дыру после уже выполненного локального действия. Если tool executor возвращал непустой Mapping с объектом, который нельзя сериализовать в JSON, `json.dumps(...)` падал уже ПОСЛЕ выполнения side effect. Child-loop обрывался без `function_call_output`, и дальнейший retry мог толкать систему к повтору локального действия. В `payload/delegated_tool_loop.py` сериализация результата теперь тоже fail-closed: после выполненного tool side effect вместо исключения записывается нейтральный `{"ok":false,"error":"tool_result_invalid"}` без утечки объекта/ошибки. Коммит `360d77130a5c17daa3b4ff24955d8656709a75da`.
4. Добавил регрессию `test_unserializable_tool_result_does_not_replay_local_side_effect`: непрозрачный несериализуемый result превращается в model-visible invalid result, а executor вызывается ровно один раз. Коммит `6ea11550d89b55deecb9c8d6b050183c88aa8adb`.
5. Нашёл ещё одну гонку в reservation-защите. Предыдущая проверка происходила до `lease.run`, но сам `AccountLease.run()` умеет внутри той же lease переключиться A→B после transport error. Если родитель успевал зарезервировать B уже во время этого failover, child мог начать provider work на новом B без повторной проверки.
6. Исправил `payload/notion_delegation_adapter.py`: фактический `lease.account_id` теперь сверяется с живым `ForegroundAccountReservations` перед КАЖДОЙ provider-попыткой, в том числе после внутреннего переключения аккаунта внутри `lease.run`. Если replacement-слот успел стать родительским, provider на нём не вызывается; lease освобождается, слот добавляется в `avoid`, а child либо выбирает другой безопасный слот, либо закрывается отказом. Коммит `fb97eb8b138ec4de92703558b531820ea7af4665`.
7. Добавил `test_child_rechecks_reservation_on_internal_lease_failover`: A получает transport error, lease внутренне переходит к B, но B к этому моменту уже зарезервирован родителем; runner обязан быть вызван только на A и ни разу на B. Коммит `659304b9a6385e9b4862812ffaf2e59f8397b7bc`.
8. На exact head `659304b9...` CircleCI workflow `d0931c25-ee6f-4184-a12a-4866407a828f` поднял пять обычных Agent job: `agent-contracts`, `routing-contracts`, `prompt-contracts`, `delegation-contracts`, `server-wiring-rehearsal`. На конец смены все пять ещё `pending`; PASS не заявлять до реального результата. Новых provider/live запусков не делал.

Главное новое понимание:
- защита родительской tool-цепочки должна быть динамической не только до lease. `AccountLease` сам умеет failover, поэтому reservation нужно проверять на фактически текущем `lease.account_id` перед каждой provider-попыткой; иначе replacement-слот можно украсть уже после первого транспортного сбоя;
- локальный side effect считается выполненным до сериализации его результата. Любая ошибка упаковки результата после executor должна превращаться в model-visible нейтральную ошибку, а не выбрасывать исключение, иначе появляется риск повторного действия.

Что делать дальше:
1. Сначала снять итог CircleCI exact head `659304b9...`. Не пушить новые косметические изменения, пока этот workflow просто ждёт исполнителя. Если красный — исправлять только конкретную причину.
2. Если `server-wiring-rehearsal` и остальные Agent jobs зелёные, материализовать уже проверенный `ServerSubagentLifecycle` непосредственно в настоящий `payload/server.py` через существующий fail-closed materializer. После этого повторить prompt/routing/delegation/server-wiring контракты уже на материализованном сервере.
3. Перед живым прогоном убедиться, что другого provider-run нет. Затем один `live_two_slot_codex_project_probe.py`: два независимых проекта должны занять два разных готовых легитимных слота и сохранить свои account/thread через tool-result.
4. После PASS — один `live_codex_failover_project_probe.py`: A выполняет локальный write, затем временно исключается только в ephemeral pool; B продолжает полную локальную историю в новом Notion thread без повторного write.
5. Затем повторить тот же смысловой сценарий через настоящий `codex exec`. Только после устойчивого Notion/Codex ядра добавлять Qwen adapter под тот же `DelegationDispatcher`, без общего provider state.

## 2026-08-20 06:46–06:52 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `05f29ff58db21bb7fc900092040815a6a35934d5`.

Что уже есть в Agent-линии:
- два режима системного промпта `engineer/owner`; приватный prompt владельца не переписывается и не смешивается с нашей инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, а незавершённая tool-цепочка сохраняет правильный account/thread;
- допустимый failover переносит полную локальную историю на другой легитимный слот, но не переносит старый Notion `thread_id` и не повторяет уже выполненный локальный side effect;
- готовы `DelegationDispatcher`, Notion child-runtime, `ServerSubagentLifecycle`, fail-closed server materializer и живые two-slot/failover/Codex project probes;
- идентичность child-задач канонизируется по всей цепочке policy → lifecycle → dispatcher → tool-loop;
- свежая параллельная работа перед этой сменой уже закрыла случай единственного слота: child не может забрать аккаунт, который удерживает незавершённая родительская цепочка.

Что сделал в этой смене:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, прошлый handoff и заново сверил PR #7/#8. В Windows/NCM28 не заходил.
2. Увидел, что PR #8 уже ушёл вперёд до `29942f27...`: там добавлена защита родительской reservation даже при одном доступном аккаунте.
3. Нашёл следующий реальный конкурентный разрыв. `NotionDelegationAdapter` снимал список занятых родительских аккаунтов только перед `pool.lease()`. Между этим снимком и фактическим выбором аккаунта родительская tool-цепочка могла успеть зарезервировать именно выбранный слот. Тогда child начинал provider work на уже принадлежащем родителю аккаунте.
4. Исправил `payload/notion_delegation_adapter.py`: после получения lease и до первого обращения к Notion выбранный `lease.account_id` ещё раз сверяется со свежим `ForegroundAccountReservations`. Если слот успел стать родительским, lease освобождается без provider work, аккаунт добавляется в исключения и child выбирает другой свободный легитимный слот. Число повторных выборов ограничено размером пула; при отсутствии безопасной ёмкости путь закрывается отказом, а не крадёт родительский контекст. Коммит `6da911d791b576ab6f85b97ae81ff1624c1289a4`.
5. Добавил регрессию `test_child_rechecks_reservation_after_account_selection` в `tests/test_notion_subagent_server_reservations.py`: первый снимок пустой, pool успевает выбрать account-a, затем родитель резервирует account-a до provider call; child обязан освободить A, уйти на B и вызвать runner ровно на B. Коммит `05f29ff58db21bb7fc900092040815a6a35934d5`.
6. Provider traffic, реальные Notion-аккаунты и Core-файлы не трогал. Новый exact head уже опубликован в PR #8; свежий удалённый PASS для этих двух коммитов пока не заявляю.

Главное новое понимание:
- reservation родительской tool-цепочки — динамическое состояние. Одного снимка перед выбором аккаунта недостаточно: нужна повторная проверка уже выбранного слота непосредственно перед первым provider call. Иначе при реальном параллелизме сохраняется узкая гонка, которая может разрушить sticky continuation родителя.

Что делать дальше:
1. Снять итог Agent CircleCI на exact head `05f29ff5...`. Если красный — исправлять только конкретную причину. Если все Agent jobs и `server-wiring-rehearsal` зелёные, материализовать уже проверенный `ServerSubagentLifecycle` в настоящий `payload/server.py`.
2. После материализации повторить prompt/routing/delegation/server-wiring контракты уже без временного patch-helper.
3. Перед живым прогоном убедиться, что другого provider-run нет. Затем один `live_two_slot_codex_project_probe.py`: два независимых проекта должны занять два разных готовых легитимных слота и сохранить свои account/thread через tool-result.
4. После PASS — один `live_codex_failover_project_probe.py`: A выполняет локальный write, затем временно исключается только в ephemeral pool; B продолжает полную локальную историю в новом Notion thread без повторного write.
5. Затем повторить тот же смысловой сценарий через настоящий `codex exec` и только после устойчивого Notion/Codex ядра добавлять Qwen adapter под тот же `DelegationDispatcher`, без общего provider state.
