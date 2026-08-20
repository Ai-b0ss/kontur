# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — startup cleanup усилен перед прямой материализацией

Notion Core: `candidate/ncm28-windows-fixed-v1`, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`; Core/NCM28 не менялся.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `084522b10115c3e934e105025e4dcd95d0d15793`.

Фактическое состояние:
- настоящий `payload/server.py` по-прежнему имеет exact blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`; lifecycle/single-slot wiring уже материализован, но самый ранний `status = await new_pool.status()` всё ещё содержит `except Exception`;
- `tools/apply_startup_status_cleanup.py` усилен: целевой вариант ловит `BaseException`, закрывает новый pool при `CancelledError`, а если сам `aclose()` падает, исходная startup-ошибка/отмена остаётся основной, cleanup-ошибка цепляется как cause и отмечается note;
- `tests/test_startup_status_cleanup.py` расширен регрессией на двойной отказ `status cancellation + cleanup failure`; изолированная локальная семантика проверена: наружу остаётся `CancelledError`, `RuntimeError` от close сохраняется как cause, порядок `status -> close` соблюдается;
- прямой whole-file write `server.py` не выполнялся: contents API требует полную замену, а неизвестные/усечённые bytes реконструировать запрещено. Нужны exact полные bytes текущего blob, затем узкая локальная правка и минимальный compare;
- CircleCI/GitHub Actions/provider traffic/production не использовались.

Постоянная память:
- на старте прочитан `autonomy/v3/workspaces/NOTION_AGENT/LATEST.json`, родительский Git blob SHA: `5cccbcc0548a85a099bb40c7b8c4b08ff590afb9`;
- LATEST указывает на capsule `20260820T1506Z-67ebdc9fc0`, schema manifest — `free_fabric_capsule_v3`. Нормативный `capsule_runtime_v4.py` принимает только `free_fabric_worker_capsule_v4`, поэтому эту старую v3-капсулу нельзя честно объявить восстановленной через v4. Части/manifest прочитаны как immutable evidence, а работа продолжена от exact GitHub source, как разрешает failure policy протокола v2. Не реконструировать неизвестные bytes из старой капсулы.

Следующий шаг:
1. Получить exact полный `payload/server.py` blob `f02cef...` в локальную рабочую копию без усечения.
2. Применить текущий `apply_startup_status_cleanup.py`; локально прогнать `test_startup_status_cleanup.py`, `test_server_subagent_wiring_materializer.py`, затем prompt/routing/delegation/tool-loop/lifecycle набор.
3. Только после lossless PASS заменить server.py целиком exact-байтами и сразу compare: ожидается микроскопическая правка одного startup-блока, никаких несвязанных удалений.
4. После крепкого локального PASS — один bounded живой Codex project run, затем two-slot и A→B failover с новым Notion thread и без повторения уже выполненного локального side effect.
5. После этого — Qwen adapter под тот же `DelegationDispatcher`, без смешивания account/thread state.

Важно для следующей публикации памяти: создать уже v4 capsule через `capsule_runtime_v4.py`; старый LATEST обновлять только CAS с exact parent blob SHA, при конфликте не force-write.
