# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 16:56 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `53a11cbba2c8a3b8111a14d15636b7e0a15a08f9`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head: `edf8b289a236117e7577ae457cf9b7995d238eda`.

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
1. Заново прочитал OWNER_INTENT/CURRENT/handoff и сверил свежие PR #7/#8. Core сильно ушёл вперёд, но сравнение с Agent-веткой показывает, что его новые изменения сейчас только в `.circleci` и инструментах NCM28/Windows; `payload/server.py`, prompt-mode, account-pool и новая делегация не пересекаются.
2. Довёл начатый контракт делегирования до отдельного диспетчера `payload/delegation_dispatcher.py`. Он принимает только проверенный `DelegationRequest`, строит изолированный локальный ключ дочерней задачи и передаёт его в адаптер Notion/Qwen. В его контексте намеренно вообще нет `account_id` и remote `thread_id`, поэтому дочерняя задача не может случайно унаследовать provider-affinity родителя.
3. Добавлен структурированный `DelegationResult`: parent получает только связь `task_id/parent_turn_id/target` и текст результата, а provider lifecycle остаётся внутри адаптера.
4. Добавлены 5 тестов `tests/test_delegation_dispatcher.py`: новый Notion-child не наследует affinity родителя; Qwen идёт в отдельный adapter/namespace; отсутствующий adapter закрывается ошибкой до provider work; невалидный request не вызывает adapter; adapter обязан вернуть текстовый результат.
5. Старые 5 тестов `tests/test_delegation_policy.py` теперь включены в удалённую проверку вместе с новыми.
6. Выяснил, что общий `agent-contracts` был красным уже на предыдущем head `c01e6ded...`, то есть его текущий failure нельзя приписывать новой делегации. Чтобы не гадать без CircleCI-логов, добавил отдельный job `delegation-contracts`, который запускает только два новых набора и не требует provider traffic.
7. На head `edf8b289...` CircleCI workflow `6de1ca41-490e-4d95-82dc-52bf1188c3e6` уже стартовал: `agent-contracts` и `delegation-contracts` на момент передачи `pending`. Provider/live не запускал.
8. Обновил описание PR #8, чтобы оно отражало реальное состояние делегирования и текущие обязательные проверки.

Что ещё не завершено:
1. Снять итог workflow `6de1ca41-490e-4d95-82dc-52bf1188c3e6`. Если `delegation-contracts` зелёный, новый dispatcher-контракт доказан отдельно; если общий `agent-contracts` снова красный, разрезать именно старый набор и найти конкретный регресс, не смешивая его с делегацией.
2. Нужен ровно один настоящий двухслотовый live Codex probe в уже авторизованной среде; не дублировать другой provider-run.
3. После двухслотового PASS — один bounded cooldown/failover сценарий с полной локальной историей на новом легитимном слоте и новом Notion thread.
4. Только после живого Codex-ядра подключать `DelegationDispatcher` к реальному lifecycle субагента. Notion-child должен входить в обычный foreground account-pool как независимая задача; parent получает только структурированный результат.
5. После этого добавить Qwen adapter под тот же envelope, не смешивая provider state.
6. Перед слиянием Agent-линии аккуратно синхронизировать её со свежим Core и сохранить текущие Windows/NCM28 изменения `.circleci`.

Следующий запуск: первым делом проверить статусы `edf8b289...`. При зелёном `delegation-contracts` не расширять искусственные тесты без причины; заняться либо конкретным падением общего `agent-contracts`, либо одним разрешённым live two-slot probe, если provider-среда свободна. Core Windows-файлы не трогать.
