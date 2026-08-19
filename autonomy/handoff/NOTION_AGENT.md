# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 17:05 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `53a11cbba2c8a3b8111a14d15636b7e0a15a08f9`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head: `61100e2bac7e2f87684c7a5976557f744e15a3ee`.

Что уже было доказано раньше:
- режимы системного промпта `engineer` и `owner`;
- приватный `owner_system_prompt` идёт первым прикладным текстом без переписывания и без большой конкурирующей Codex-персоны;
- нейтральный `runtime_context` отделён от прикладного prompt;
- prompt/runtime policy входит в cache/thread identity только через SHA-256 без сохранения приватного текста;
- `payload/server.py` напрямую использует `compose_responses_planner_prompt(...)`;
- незавершённая tool-цепочка держит свой аккаунт, независимая новая задача обходит зарезервированный слот;
- lease-level тесты покрывают два свободных слота, закреплённое продолжение, ожидание занятого владельца, cooldown и fail-closed поведение;
- при допустимом failover старый Notion thread не переносится на другой аккаунт: полная локальная история создаёт новый thread на новом слоте;
- отдельный CircleCI workflow `39916a96-2f13-427e-bc8f-a4c2f5bd45d6` ранее был полностью зелёным для семи основных Agent-контрактов;
- `tools/live_two_slot_codex_probe.py` готовит ограниченную настоящую проверку двух независимых Responses-задач и продолжения на своих слотах.

Что сделал в этом запуске:
1. Заново прочитал OWNER_INTENT/CURRENT/handoff и сверил свежие PR #7/#8. Core сильно ушёл вперёд, но его новые изменения относительно Agent-линии сейчас только в `.circleci` и инструментах NCM28/Windows; продуктовые файлы Responses/prompt/account-pool с нашей работой не пересекаются.
2. Довёл основу будущих субагентов до отдельного `payload/delegation_dispatcher.py`. Он принимает проверенный `DelegationRequest`, строит изолированный локальный ключ дочерней задачи и передаёт его выбранному адаптеру Notion/Qwen. В дочернем контексте намеренно нет `account_id` и remote `thread_id`, поэтому provider-affinity родителя не наследуется случайно.
3. Добавлен `DelegationResult`: parent получает только `task_id`, `parent_turn_id`, target и текстовый результат; provider lifecycle остаётся внутри адаптера.
4. Добавлены 5 тестов `tests/test_delegation_dispatcher.py`: изоляция Notion-child от parent affinity, отдельный Qwen adapter/namespace, fail-closed при отсутствующем адаптере, валидация до provider work, запрет нетекстового результата.
5. Вместе с прежними 5 тестами `tests/test_delegation_policy.py` это теперь отдельный удалённый gate `delegation-contracts`.
6. `delegation-contracts` на workflow `6de1ca41-490e-4d95-82dc-52bf1188c3e6` прошёл `success`. Значит, новый provider-neutral контракт делегирования отдельно доказан на CircleCI без live/provider traffic.
7. Общий `agent-contracts` при этом продолжал падать. Я разрезал его на `prompt-contracts` и `routing-contracts`; оба тоже упали. Затем нашёл причину в самом CI, а не в продукте: текущий объединённый job потерял проверенную среду старого зелёного workflow — не ставил `uvicorn/pytest/pytest-asyncio`, потерял `regression/stubs` и `payload` в `PYTHONPATH`, а главное ссылался на два несуществующих файла `test_server_prompt_mode_wiring.py` и `test_cooldown_failover.py`.
8. Исправил CI обратно к доказанной схеме: `pytest`, полный `PYTHONPATH`, реальные файлы `tests/test_responses_prompt_wiring_contract.py` и `tests/test_responses_cooldown_failover.py`. Текущий head `61100e2b...`; workflow `35f42289-d683-40ef-bd4c-ba14fa61ee79` уже стартовал, четыре jobs на момент передачи `pending`.
9. Обновил описание PR #8 под фактический prompt/rotation/delegation scope.

Что ещё не завершено:
1. Снять итог workflow `35f42289-d683-40ef-bd4c-ba14fa61ee79`. Ожидание простое: `delegation-contracts` должен остаться зелёным; если prompt/routing после починки среды тоже зелёные, общий Agent gate снова восстановлен. Если какой-то узкий job красный — теперь это уже конкретный продуктовый/тестовый сигнал, а не сломанный список файлов.
2. Нужен ровно один настоящий двухслотовый live Codex probe в уже авторизованной среде; не дублировать другой provider-run.
3. После двухслотового PASS — один bounded cooldown/failover сценарий с полной локальной историей на новом легитимном слоте и новом Notion thread.
4. Только после живого Codex-ядра подключать `DelegationDispatcher` к реальному lifecycle субагента. Notion-child должен входить в обычный foreground account-pool как независимая задача; parent получает только структурированный результат.
5. Затем добавить Qwen adapter под тот же envelope, не смешивая provider state.
6. Перед слиянием Agent-линии аккуратно синхронизировать её со свежим Core и не перетереть текущие Windows/NCM28 изменения `.circleci`.

Следующий запуск: первым делом проверить статусы `61100e2b...`. Если все offline Agent jobs зелёные и provider-среда свободна — выполнить один bounded live two-slot probe. Если один узкий job красный — чинить только его. Core Windows-файлы не трогать.
