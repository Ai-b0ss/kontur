# Notion — ротация, агентность, prompt-mode и делегирование

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
