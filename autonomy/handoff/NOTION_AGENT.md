# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — усилена ротация/делегирование; exact server.py materialization остаётся следующим крупным шагом

Notion Core: `candidate/ncm28-windows-fixed-v1`, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`; Core/NCM28 не менялся.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `9affb9546bec5ce7fe321d6e9e03cb055fc5ab18`.

Фактическое состояние:
- настоящий `payload/server.py` всё ещё имеет exact Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`; прямую полную замену огромного файла в этом проходе не делали;
- `tools/apply_startup_status_cleanup.py` fail-closed по exact blob `f02cef...` и теперь содержит ПЯТЬ точных преобразований: (1) ранний startup `BaseException` cleanup, (2) owner-mode не запускает extractor Codex `instructions` в `responses_planner_prompt`, (3) owner-mode не запускает тот же extractor в metric/token path, (4) stale affinity больше не считается владением foreground reservation, (5) multi-account routing использует `wait_for_turn_route(..., owner_turn_key=turn_key)` — только настоящий владелец reservation освобождается от avoid-set;
- найденная причина пункта 4: старый anchored turn мог указывать на account A и из-за `has_affinity_anchor=True` вообще не консультировать foreground reservations, хотя account A уже мог быть зарезервирован ДРУГИМ незавершённым tool-chain. Теперь кандидат решения различает affinity и фактическое владение reservation;
- owner-mode cache/thread identity дополнительно очищена: `turn_affinity.response_input_fingerprint()` больше не включает проигнорированные Codex `instructions` в режиме owner. Private owner prompt/runtime-context продолжают входить только через content-free SHA-256 policy fingerprint. Engineer-mode по-прежнему учитывает `instructions`;
- `payload/prompt_modes.py` получил selector-only `requested_prompt_mode()`, который определяет режим, не читая/не проверяя содержимое private owner prompt/runtime context;
- lifecycle rebind/unbind теперь cancellation-safe: после публикации нового поколения отмена `rebind_pool_and_drain()` не может вернуть управление вызывающему коду, пока child старого entrypoint ещё работает. Drain идёт отдельной задачей под `asyncio.shield`; даже повторный `cancel()` не бросает старый provider pool раньше времени. После idle возвращается исходный `CancelledError`;
- `tests/test_server_subagent_lifecycle_drain.py` покрывает old-child → publish generation 2 → repeated cancel → new child already uses gen2 → old child release → cancellation propagation;
- исправлен ещё один риск batch delegation: peer failure больше не отменяет независимых sibling children, которые уже могли войти в локальный write/shell. `run_many()` ждёт завершения всех атомарно допущенных siblings и затем поднимает первую ошибку; явная отмена самого batch по-прежнему отменяет его незавершённые children;
- под peer-failure добавлен тест: один child падает, sibling продолжает и завершает потенциально side-effectful bounded operation, не получает cancellation, lifecycle active возвращается к 0;
- `_normalize_runtime_result()` уже был fail-closed: MCP result обязан быть dict с content:list[dict], `isError` — реальный bool; строки/числа/null отвергаются. Дополнительной правки тут не требовалось;
- delegated failover по-прежнему сохраняет локальную историю/результаты уже выполненных инструментов, а новый provider client создаёт новый Notion thread; старый thread другого аккаунта не переносится;
- subagents остаются выключены по умолчанию; живой provider traffic не запускался;
- CircleCI/GitHub Actions/Cloudflare/production не использовались.

Локальные проверки этого прохода:
- отдельный asyncio-probe cancellation-safe drain: PASS, включая повторный `cancel()`;
- отдельный семантический probe peer-failure/sibling-settle: PASS;
- все изменения в exact server helper compile-check проходят внутри самого helper; полный локальный проектный набор должен быть прогнан после lossless materialization `server.py`.

Постоянная память v4:
- в начале запуска `LATEST.json` был прочитан с exact parent blob `de38705a5d16b34ff746c7b13fa5d062d632646a` и восстановлен штатно из capsule `20260820T180036Z-71a81bdf5c`;
- промежуточная capsule `20260820T190441Z-3eb216d577`, archive SHA-256 `e6a9ad7101e887fc03fdab6f3b1bfce5a39516fc1b4a83ac05549463c04c196d`, была pack/verify/restore PASS, immutable manifest/part перечитаны обратно и опубликованы CAS; LATEST blob после публикации `42c74bb6b9a985e3a5372149a0cd84c0c0feaf61`;
- поскольку после неё были дополнительные продуктовые изменения, перед завершением текущего прохода нужна ещё одна свежая v4 capsule и новый CAS publish либо честная фиксация CAS-конфликта.

Следующий шаг:
1. Получить полные exact bytes `payload/server.py` blob `f02cef...` без усечения/escape-реконструкции и локально повторно проверить Git blob SHA.
2. Применить текущий `apply_startup_status_cleanup.py`; он обязан увидеть exact `f02cef...` и все пять preimage-фрагментов ровно по одному разу.
3. Локально прогнать `test_startup_status_cleanup.py`, `test_server_subagent_wiring_materializer.py`, `test_server_subagent_lifecycle_drain.py`, prompt-mode/identity, foreground routing, delegation, delegated tool-loop, failover и lifecycle tests.
4. Только после lossless PASS заменить `payload/server.py` и сразу сравнить exact diff: разрешены только пять подготовленных узких изменений; никаких посторонних удалений/переформатирования.
5. После крепкого локального PASS — один bounded живой Codex project run; затем two-slot run; затем A→B failover с новым Notion thread и без повторения уже выполненного локального side effect.
6. После этого — Qwen adapter под тот же `DelegationDispatcher`, без смешивания Notion account/thread state.
