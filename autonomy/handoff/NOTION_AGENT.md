# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — lifecycle status исправлен, startup cleanup привязан к exact server blob

Notion Core: `candidate/ncm28-windows-fixed-v1`, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`; Core/NCM28 не менялся.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `bc482cea95a8b5044c28185a70a97033694cec32`.

Фактическое состояние:
- настоящий `payload/server.py` по-прежнему имеет exact Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`; lifecycle/single-slot wiring уже материализован, но самый ранний `status = await new_pool.status()` всё ещё содержит `except Exception`;
- `tools/apply_startup_status_cleanup.py` теперь fail-closed не только по текстовому anchor, но и по exact Git blob SHA `f02cef...`: вычисляется настоящий Git blob SHA (`sha1("blob <len>\0" + bytes)`), поэтому helper откажется патчить любой другой `server.py`, даже если старый anchor в нём случайно сохранился;
- startup cleanup по-прежнему сохраняет исходный `CancelledError`/startup exception как основной, закрывает новый pool и при двойном отказе цепляет cleanup exception как cause;
- `payload/server_subagent_lifecycle.py` исправлен: `status()` теперь учитывает child-задачи, которые ещё дренируются на предыдущем поколении после rebind/unbind. Раньше во время `rebind_pool_and_drain()` или `unbind_and_drain()` статус мог ложно показывать `active=0`, хотя старая child ещё работала;
- новый `status()` также повторяет чтение, если generation/entrypoint сменились во время `await entrypoint.status()`, чтобы не возвращать смешанный снимок двух поколений;
- `tests/test_server_subagent_lifecycle_drain.py` теперь требует `active=1` во время дренирования старого поколения как при rebind, так и после unbind; после окончания child остаётся `active=0`;
- локально отдельно проверена семантика статуса: при `old active + new bound` -> `bound=True, generation=2, active=1`; после unbind при ещё живой старой child -> `bound=False, active=1`; после её завершения -> `active=0`;
- формула Git blob SHA локально сверена с `git hash-object` на контрольных bytes — совпадает;
- CircleCI/GitHub Actions/provider traffic/production не использовались.

Постоянная память:
- на старте прочитан `autonomy/v3/workspaces/NOTION_AGENT/LATEST.json`, родительский Git blob SHA: `5cccbcc0548a85a099bb40c7b8c4b08ff590afb9`;
- LATEST всё ещё указывает на capsule `20260820T1506Z-67ebdc9fc0`, manifest schema `free_fabric_capsule_v3`; нормативный `capsule_runtime_v4.py` принимает только `free_fabric_worker_capsule_v4`, PREVIOUS отсутствует. Поэтому работа продолжена от exact GitHub source по failure policy протокола v2; неизвестные bytes старой капсулы не реконструировать.

Следующий шаг:
1. Получить exact полный `payload/server.py` blob `f02cef...` в локальную рабочую копию без усечения.
2. Применить текущий `apply_startup_status_cleanup.py`; helper обязан сначала подтвердить exact blob `f02cef...`.
3. Локально прогнать `test_startup_status_cleanup.py`, `test_server_subagent_wiring_materializer.py`, `test_server_subagent_lifecycle_drain.py`, затем prompt/routing/delegation/tool-loop/lifecycle набор.
4. Только после lossless PASS заменить `server.py` целиком exact-байтами и сразу compare: ожидается одна узкая startup-правка, никаких несвязанных удалений.
5. После крепкого локального PASS — один bounded живой Codex project run, затем two-slot и A→B failover с новым Notion thread и без повторения уже выполненного локального side effect.
6. После этого — Qwen adapter под тот же `DelegationDispatcher`, без смешивания account/thread state.

Важно для публикации памяти этого запуска: собрать уже v4 capsule через `capsule_runtime_v4.py`; LATEST обновлять только CAS с exact родительским blob SHA `5cccbcc0548a85a099bb40c7b8c4b08ff590afb9`, при конфликте не force-write.
