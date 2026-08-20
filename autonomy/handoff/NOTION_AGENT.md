# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — owner-mode extractor gap закрыт в exact materializer; прямой server.py остаётся следующим шагом

Notion Core: `candidate/ncm28-windows-fixed-v1`, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`; Core/NCM28 не менялся.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `1aa166cc2336ce69595e3fc7fa1f26930784b49a`.

Фактическое состояние:
- настоящий `payload/server.py` всё ещё имеет exact Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`; полный blob прочитан через GitHub blob API без реконструкции неизвестных bytes;
- lifecycle/single-slot wiring уже материализован в server.py, но самый ранний `status = await new_pool.status()` пока содержит `except Exception`;
- `tools/apply_startup_status_cleanup.py` по-прежнему fail-closed по exact Git blob `f02cef...`, но теперь единым минимальным преобразованием закрывает два независимых хвоста: startup cancellation cleanup и owner-mode lazy instruction extraction;
- owner-mode gap был реальным: `responses_planner_prompt()` сначала безусловно вызывал `anthropic_operator_context(body.get("instructions"))`, а затем `compose_responses_planner_prompt()` выбрасывал результат. Значит приватный owner-mode не отправлял Codex persona модели, но всё равно разбирал `instructions`, что нарушало контракт «вообще не инспектировать instructions»;
- новый guarded replacement сначала вызывает `resolve_prompt_policy(body)` и в owner-mode передаёт пустой `engineer_context`, не вызывая `anthropic_operator_context`; engineer-mode сохраняет прежний extractor;
- `tests/test_startup_status_cleanup.py` усилен: проверяет оба exact preimage/replacement, порядок policy→owner branch→extractor и прежнюю fail-closed семантику startup cleanup;
- startup cleanup сохраняет исходный `CancelledError`/startup exception как основной, закрывает новый pool и при двойном отказе цепляет cleanup exception как cause;
- `payload/server_subagent_lifecycle.py` уже учитывает child-задачи, которые дренируются на предыдущем поколении после rebind/unbind, и повторяет status snapshot при смене поколения;
- `DelegationDispatcher` fail-closed отклоняет пустой/whitespace-only результат child-адаптера;
- CircleCI/GitHub Actions/Cloudflare/provider traffic/production в этом проходе не использовались.

Постоянная память v4:
- в начале запуска прочитан `LATEST.json`, exact parent Git blob SHA `0fa9434ed01d4feae240272871e95ef972064dff`;
- LATEST указывал на v4 capsule `20260820T171209Z-703d81d6fa`, archive SHA-256 `3a6d37743613ed24eb31a92917ad6589e8bb26022fce0d5b29055c7c431ff752`;
- manifest и immutable part прочитаны отдельно; локальный `capsule_runtime_v4.py verify` и `restore` дали PASS, восстановлен checkpoint exact source `Ai-b0ss/notion-agent-bridge@60c53b3dd95c16e8d18266211aab4b859a0578f7`;
- после текущей работы требуется новый v4 checkpoint/pack/upload/readback/CAS publish; при CAS-конфликте force-write запрещён.

Следующий шаг:
1. Материализовать exact bytes blob `f02cef...` локально без преобразования escape/newline; пересчитать Git blob SHA и потребовать точное `f02cef...`.
2. Применить текущий `apply_startup_status_cleanup.py`; helper обязан подтвердить exact source blob и одновременно внести только две узкие правки: startup `BaseException` cleanup и owner-mode lazy extractor.
3. Локально прогнать `test_startup_status_cleanup.py`, `test_server_subagent_wiring_materializer.py`, `test_server_subagent_lifecycle_drain.py`, затем prompt/routing/delegation/tool-loop/lifecycle набор.
4. Только после lossless PASS заменить `payload/server.py` целиком exact-байтами и сразу сравнить предыдущий и новый commit: допустимы только две ожидаемые узкие правки, никаких несвязанных удалений/переписываний.
5. После крепкого локального PASS — один bounded живой Codex project run, затем two-slot и A→B failover с новым Notion thread и без повторения уже выполненного локального side effect.
6. После этого — Qwen adapter под тот же `DelegationDispatcher`, без смешивания account/thread state.
