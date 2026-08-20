# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — rebind/unbind drain теперь cancellation-safe; прямой server.py всё ещё следующий крупный шаг

Notion Core: `candidate/ncm28-windows-fixed-v1`, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`; Core/NCM28 не менялся.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `1218ae179c5a224d18fff8f535c5bebd28107ae3`.

Фактическое состояние:
- настоящий `payload/server.py` всё ещё имеет exact Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`; lifecycle/single-slot wiring уже материализован, но самый ранний `status = await new_pool.status()` пока содержит `except Exception`;
- `tools/apply_startup_status_cleanup.py` fail-closed по exact Git blob `f02cef...` и готов единым минимальным преобразованием закрыть два хвоста: startup cancellation cleanup и owner-mode lazy instruction extraction;
- owner-mode lazy fix нужен потому, что текущий `responses_planner_prompt()` сначала разбирает Codex `instructions`, а уже потом owner-policy выбрасывает этот инженерный контекст; материализатор меняет порядок на policy → owner branch → extractor только для engineer-mode;
- новый продуктовый фикс в `payload/server_subagent_lifecycle.py`: после того как новый generation уже опубликован, отмена `rebind_pool_and_drain()`/`unbind_and_drain()` больше не может немедленно вернуть управление вызывающему коду, пока на старом entrypoint ещё работает child. Иначе вызывающий код мог закрыть старый provider pool под уже выполняющейся child-задачей;
- drain теперь выполняется отдельной задачей под `asyncio.shield`; первая/повторная cancellation запоминается, но возвращается наружу только после фактического idle старого entrypoint. Неожиданная ошибка самого drain остаётся приоритетной;
- `tests/test_server_subagent_lifecycle_drain.py` расширен точным сценарием: old child блокируется на generation 1 → generation 2 публикуется → rebind task отменяется → cancellation не возвращается до release old child → новые child уже идут через generation 2 → после release исходный `CancelledError` возвращается вызывающему коду;
- локально отдельно проверена сама cancellation-семантика на `asyncio`: в том числе повторный `cancel()` не позволяет бросить drain раньше времени, после release исходная cancellation возвращается (`PASS`);
- `DelegationDispatcher` по-прежнему fail-closed отклоняет пустой/whitespace-only результат child-адаптера; lifecycle status учитывает child-задачи, дренирующиеся на прошлых поколениях;
- CircleCI/GitHub Actions/Cloudflare/provider traffic/production в этом проходе не использовались.

Постоянная память v4:
- в начале запуска прочитан `LATEST.json`, exact parent Git blob SHA `de38705a5d16b34ff746c7b13fa5d062d632646a`;
- LATEST указывал на v4 capsule `20260820T180036Z-71a81bdf5c`, archive SHA-256 `9fcd98adfddbc76889b147ac37abe62b55a261637b47955025c3ed8148ccdb97`;
- manifest и immutable part прочитаны отдельно; archive длина `1384`, SHA совпал; checkpoint восстановлен и подтверждает source `Ai-b0ss/notion-agent-bridge@1aa166cc2336ce69595e3fc7fa1f26930784b49a`, server blob `f02cef...`;
- после этой работы требуется новый v4 checkpoint/pack/upload/readback/CAS publish; при CAS-конфликте force-write запрещён.

Следующий шаг:
1. Материализовать exact bytes blob `f02cef...` локально без преобразования escape/newline; пересчитать Git blob SHA и потребовать точное `f02cef...`.
2. Применить текущий `apply_startup_status_cleanup.py`; helper обязан подтвердить exact source blob и одновременно внести только две узкие правки: startup `BaseException` cleanup и owner-mode lazy extractor.
3. Локально прогнать `test_startup_status_cleanup.py`, `test_server_subagent_wiring_materializer.py`, `test_server_subagent_lifecycle_drain.py`, затем prompt/routing/delegation/tool-loop/lifecycle набор. Новый cancellation-safe drain тест обязателен.
4. Только после lossless PASS заменить `payload/server.py` целиком exact-байтами и сразу сравнить предыдущий и новый commit: допустимы только две ожидаемые узкие правки, никаких несвязанных удалений/переписываний.
5. После крепкого локального PASS — один bounded живой Codex project run, затем two-slot и A→B failover с новым Notion thread и без повторения уже выполненного локального side effect.
6. После этого — Qwen adapter под тот же `DelegationDispatcher`, без смешивания account/thread state.
