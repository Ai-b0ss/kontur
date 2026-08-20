# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — ранняя отмена startup локализована, узкий фикс подготовлен, capsule v3 опубликована

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`. Core/NCM28 в этой смене не менялся.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `67ebdc9fc0bfedfb39045b0a7f3c4ecb5ae84590`.

Что сделано:
- подтверждён точный оставшийся разрыв в `payload/server.py`: ранний `status = await new_pool.status()` всё ещё ловит только `Exception`; `asyncio.CancelledError` поэтому способен пройти мимо `new_pool.aclose()` до публикации глобального состояния;
- добавлен `tools/apply_startup_status_cleanup.py` — узкий fail-closed преобразователь с точным preimage. Он меняет только этот блок `Exception -> BaseException`, обязательно закрывает новый pool и отказывается применяться второй раз/к незнакомому исходнику;
- добавлен `tests/test_startup_status_cleanup.py`: проверяет единственный точный preimage в текущем server source, компиляцию результата, отказ второго применения и отдельный сценарий `CancelledError -> aclose -> propagate`;
- изолированный локальный прогон cancellation-семантики прошёл: при отмене `status()` новый pool закрывается до повторного выброса отмены;
- hosted CI/CircleCI не запускались, provider traffic и живой Notion не использовались.

Критическая граница записи:
- прямой `payload/server.py` пока намеренно НЕ изменён: его точный blob на этом head остаётся `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` и ранний блок всё ещё содержит `except Exception`;
- в этой смене была одна попытка заменить весь большой server.py через contents API; compare немедленно показал потерю ~1230 строк. Ветка сразу же была возвращена на чистый `2f43a55e...`, ошибочный commit `76e07c900d61f87fd9e1fa02e1e8561fe408a20d` в рабочей ветке не остался. Никогда не реконструировать большой server.py из чата/частичных фрагментов и не повторять такой whole-file write;
- следующий прямой фикс server.py разрешён только после получения exact bytes целиком в локальную рабочую копию и применения узкого преобразователя к этим exact bytes.

Постоянная capsule v3 для worker `NOTION_AGENT` впервые создана и опубликована:
- capsule id `20260820T1506Z-67ebdc9fc0`;
- manifest `autonomy/v3/workspaces/NOTION_AGENT/20260820T1506Z-67ebdc9fc0/manifest.json`;
- archive SHA-256 `2f7182af8eb50393f34750885e27af4c7c642319fe63a4bd4464218d2efb5a03`;
- 2 base64 parts, 2048 + 1736 chars; обе части прочитаны обратно из GitHub, их Git blob SHA совпали с локальными exact bytes, SHA-256 частей и собранного архива совпали с manifest;
- `LATEST.json` опубликован только после readback частей и manifest;
- workspace честно помечен `partial_exact`: полный `server.py` не упаковывался и должен восстанавливаться только по immutable Git blob/source SHA, не из памяти чата.

Что делать дальше:
1. В начале следующего запуска восстановить capsule `20260820T1506Z-67ebdc9fc0` по `LATEST.json`, проверить части/archive/workspace.
2. Получить exact полный `payload/server.py` для текущего Agent head в локальную рабочую копию (immutable blob `f02cef...` остаётся исходной опорой, пока server не менялся), применить `apply_startup_status_cleanup.py`, прогнать `tests/test_startup_status_cleanup.py` и `tests/test_server_subagent_wiring_materializer.py` локально.
3. Только после lossless local PASS записать изменённый exact server.py обратно и сразу compare: ожидаемая правка должна быть микроскопической, без удаления несвязанных строк.
4. Затем локально прогнать prompt/routing/delegation/tool-loop/lifecycle набор без внешнего provider traffic; если всё крепко — один bounded живой Codex project run, затем two-slot и A→B failover с новым Notion thread и без повторения уже выполненного side effect.
5. После живого ядра подключать Qwen adapter под тот же `DelegationDispatcher`, не смешивая account/thread state провайдеров.

## 2026-08-20 — fail-closed wiring материализован в настоящий server.py

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`. Core/NCM28 в этой смене не менялся.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `2f43a55e01c4c8784a5d2d525f6058ffb4a5fb6c`.

Главный результат: исправленный wiring больше не живёт только в materializer. Commit `a2c824a931fb05868ca916e3349a30ec29f19951` внёс его непосредственно в `payload/server.py`.

Что теперь реально находится в server.py:
- `ServerSubagentLifecycle` и отдельный глобальный lifecycle;
- субагенты выключены по умолчанию и включаются только явным `NOTION_SUBAGENTS_ENABLED`;
- `ForegroundAccountReservations.wait_for_turn_route(...)` работает и для одного слота, исключая reservation собственного `turn_key`;
- чужая single-slot задача ждёт освобождения sticky-account ДО захвата `responses_inference_gate`, поэтому больше не может удержать единственный gate и заблокировать continuation владельца;
- оба Responses-входа — stream и non-stream — передают `turn_key` в inference slot;
- multi-account avoidance в `handle_openai_responses` оставлен отдельным прежним механизмом;
- startup создаёт `ConversationSegmentStore`, lifecycle и bind к новому пулу до публикации `account_pool/subagent_lifecycle/conversation_segments`;
- shutdown сначала запрещает/дренирует delegated work, затем в `finally` обязательно закрывает provider pool и очищает bridge secret.

Commit `2f43a55e01c4c8784a5d2d525f6058ffb4a5fb6c` перевёл `tests/test_server_subagent_wiring_materializer.py` с проверки временно преобразованной копии на прямую проверку настоящего `payload/server.py`. Тест теперь компилирует реальный server source, проверяет порядок startup/shutdown и напрямую исполняет извлечённый `ForegroundAccountReservations` для single-slot wait/owner reentry/TTL.

Локальные hosted-проверки без CircleCI/GitHub Actions:
- single-slot порядок доказан: чужой waiter остаётся заблокирован, owner continuation входит в gate, снимает reservation, после этого чужая задача продолжает;
- TTL брошенной reservation реально освобождает слот;
- `ServerSubagentLifecycle` отдельно прогнан с fake entrypoints: новые child после rebind идут на новый runtime, старые заканчивают на старом, drain ждёт их завершения; неудачная сборка replacement не меняет generation и старый runtime остаётся рабочим;
- базовый owner/engineer prompt-mode локально проверен: owner prompt остаётся первым точным прикладным текстом, инженерная персона в него не подмешивается, runtime context остаётся отдельным.

Новый найденный хвост fail-closed startup:
- первая проверка `status = await new_pool.status()` всё ещё обёрнута в `except Exception`, а не `except BaseException`;
- отмена задачи (`asyncio.CancelledError`) на этом самом раннем этапе может миновать `new_pool.aclose()` ещё до позднего lifecycle-блока;
- это следующий маленький обязательный fix. Не считать startup cancellation полностью закрытым, пока ранний status-блок тоже не ловит BaseException и не имеет прямой регрессии.

Что делать дальше:
1. Исправить ранний startup status cleanup (`Exception -> BaseException`) и добавить прямую регрессию на cancellation/обязательное закрытие нового pool.
2. На hosted машине расширить локальный набор до prompt/routing/delegation/tool-loop/lifecycle без внешнего provider traffic. Не запускать CircleCI/GitHub Actions ради этого.
3. После крепкого локального ядра — один bounded живой Codex project run в уже авторизованной среде; затем two-slot run и A→B failover с новым Notion thread, полной локальной историей и без повторения уже выполненного локального side effect.
4. После этого подключать Qwen adapter под тот же `DelegationDispatcher`, не смешивая account/thread state двух провайдеров.

FREE FABRIC здесь не является задачей этой автоматизации. Реальные аккаунты, production и живой Notion в этой смене не изменялись.
