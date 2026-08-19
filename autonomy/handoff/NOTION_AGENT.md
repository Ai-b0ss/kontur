# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 17:07 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `53a11cbba2c8a3b8111a14d15636b7e0a15a08f9`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head: `61100e2bac7e2f87684c7a5976557f744e15a3ee`.

Что уже доказано:
- режимы системного промпта `engineer` и `owner`;
- приватный `owner_system_prompt` идёт первым прикладным текстом без переписывания и без большой конкурирующей Codex-персоны;
- нейтральный `runtime_context` отделён от прикладного prompt;
- prompt/runtime policy входит в cache/thread identity только через SHA-256 без сохранения приватного текста;
- `payload/server.py` напрямую использует `compose_responses_planner_prompt(...)`;
- незавершённая tool-цепочка держит свой аккаунт, независимая новая задача обходит зарезервированный слот;
- lease-level тесты покрывают два свободных слота, закреплённое продолжение, ожидание занятого владельца, cooldown и fail-closed поведение;
- при допустимом failover старый Notion thread не переносится на другой аккаунт: полная локальная история создаёт новый thread на новом слоте;
- `tools/live_two_slot_codex_probe.py` готовит ограниченную настоящую проверку двух независимых Responses-задач и продолжения на своих слотах;
- новый `payload/delegation_dispatcher.py` принимает проверенный `DelegationRequest`, строит изолированный локальный ключ child-задачи и вызывает только выбранный адаптер Notion/Qwen; в child-контексте нет `account_id` и remote `thread_id`, поэтому affinity родителя не наследуется случайно;
- `DelegationResult` возвращает родителю только связь задачи и текст результата, provider lifecycle остаётся внутри адаптера;
- 10 тестов policy+dispatcher покрывают независимую child identity, отдельный Qwen namespace, bounded budget, fail-closed отсутствующий adapter, валидацию до provider work и текстовый результат.

Что сделал в этом запуске:
1. Прочитал OWNER_INTENT/CURRENT/handoff и сверил PR #7/#8. Свежие изменения Core сейчас только в `.circleci` и NCM28/Windows tooling; с Responses/prompt/account-pool/delegation они не пересекаются.
2. Довёл начатый provider-neutral контракт делегирования до отдельного диспетчера и добавил 5 новых регрессий `tests/test_delegation_dispatcher.py`.
3. Добавил отдельный CircleCI `delegation-contracts`, чтобы новая делегация проверялась независимо от старого Agent-набора. Первый отдельный прогон прошёл `success`.
4. Общий `agent-contracts` был красным уже до новой делегации. Разрезал его на prompt/routing и нашёл реальную причину в CI: потеряны `uvicorn/pytest/pytest-asyncio`, `regression/stubs` и `payload` в `PYTHONPATH`, плюс использовались два несуществующих имени тестов.
5. Вернул проверенную среду старого зелёного Agent workflow и исправил пути на реальные `tests/test_responses_prompt_wiring_contract.py` и `tests/test_responses_cooldown_failover.py`.
6. На exact head `61100e2b...` workflow `35f42289-d683-40ef-bd4c-ba14fa61ee79` полностью зелёный: `agent-contracts=success`, `prompt-contracts=success`, `routing-contracts=success`, `delegation-contracts=success`.
7. Обновил описание PR #8 под фактический prompt/rotation/delegation scope.
8. Provider/live traffic, production, пользовательские аккаунты и данные Notion в этом запуске не трогал.

Что ещё не завершено:
1. Нужен ровно один настоящий двухслотовый live Codex probe в уже авторизованной среде; не дублировать другой provider-run.
2. После двухслотового PASS — один bounded cooldown/failover сценарий с полной локальной историей на новом легитимном слоте и новом Notion thread.
3. Только после живого Codex-ядра подключать `DelegationDispatcher` к реальному lifecycle субагента. Notion-child должен входить в обычный foreground account-pool как независимая задача; parent получает только структурированный результат.
4. Затем добавить Qwen adapter под тот же envelope, не смешивая provider state.
5. Перед слиянием Agent-линии аккуратно синхронизировать её со свежим Core и не перетереть текущие Windows/NCM28 изменения `.circleci`.

Следующий запуск: сначала убедиться, что нет уже идущего provider-run. Если среда свободна — выполнить один bounded live two-slot Codex probe. Если live пока нельзя безопасно запускать, не наращивать лишние искусственные тесты: подготовить минимальный реальный subagent lifecycle adapter поверх уже зелёного `DelegationDispatcher`, но не включать provider delegation до живого Codex PASS.
