# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 21:48 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `510a03203a76fe33551c29a4933f1518f6c786de`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Свежий head после этого запуска: `84039a5d1c46aae4c50e012ec11225ba90938df9`.

Что уже доказано раньше:
- два режима системного промпта `engineer` и `owner`;
- приватный `owner_system_prompt` идёт первым прикладным текстом без переписывания и без большой конкурирующей инженерной персоны;
- нейтральный `runtime_context` отделён от прикладного prompt;
- prompt/runtime policy входит в cache/thread identity только через SHA-256, приватный текст там не хранится;
- `payload/server.py` напрямую использует общую prompt-policy;
- незавершённая tool-цепочка держит свой аккаунт, независимая новая задача обходит зарезервированный слот;
- при допустимом failover старый Notion thread не переносится через другой аккаунт: полная локальная история создаёт новый thread на новом допустимом слоте;
- `DelegationRequest`/`DelegationDispatcher`, `SubagentLifecycle`, `SubagentEntryPoint`, `NotionDelegationAdapter` и `notion_subagent_runtime` отделяют child-задачу от provider state родителя;
- предыдущий основной Agent-набор prompt/routing/delegation был зелёным в CircleCI;
- в ветке есть настоящий Codex CLI project probe, но live/provider запуск пока намеренно не дублировался.

Что сделал в этом запуске:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff, заново сверил PR #7/#8 и свежие head.
2. Не трогал Windows/NCM28 и не менял `.circleci/config.yml`: Core продолжает активно менять эту область.
3. Переделал `DelegatedToolLoopRunner` на локальную `DelegatedToolLoopSession`. История child-задачи, уже выполненные tool-result, использованные `call_id` и счётчик модельных ходов теперь живут в одной session и не создаются заново при каждом provider-вызове.
4. Счётчик модельных ходов увеличивается только после валидного ответа модели. Если конкретный слот падает до ответа, повтор на другом допустимом слоте не съедает бюджет.
5. Локальный tool-result добавляется в историю до следующего модельного запроса. Поэтому если слот A становится недоступен после уже выполненного `write_file`/`bash`, повтор через слот B продолжает ту же локальную историю и не запускает локальный side effect повторно.
6. `NotionDelegationAdapter` теперь создаёт stateful child-session один раз ДО `lease.run`. Если `AccountLease.run()` допустимо переключает client A→B, он вызывает одну и ту же `session.run`, а не создаёт child заново. Для простых старых runner сохранена совместимость.
7. Добавил регрессию в `tests/test_delegated_tool_loop.py`: после одного локального write слот A падает, слот B получает уже готовый tool-result; write выполняется ровно один раз.
8. Добавил отдельный adapter-level тест `tests/test_delegated_failover_session.py`: fake lease намеренно делает A→B внутри одного `lease.run`; проверяется та же session, один side effect и сохранение `avoid_account_ids` родительского слота.
9. На exact head `84039a5d...` CircleCI автоматически стартовал workflow `03524c2f-36a6-44e3-bbf0-ae7dd2dcfc36`; старые `agent/prompt/routing/delegation` jobs пока `pending`. Важно: новый failover-тест всё ещё не включён в эти четыре job, поэтому их будущий green нельзя выдавать за доказательство нового stateful retry.
10. Provider/live traffic, production, реальные аккаунты и NCM28 не трогались.

Главное новое понимание:
- опасный сценарий «AccountLease повторил весь child-loop после смены аккаунта и повторил локальные side effects» теперь закрыт архитектурно на уровне session;
- session специально не содержит remote Notion `thread_id`. На новом provider-client полный локальный transcript должен создавать/ребейзить свежий remote thread этого нового легитимного слота. Нельзя переносить старый thread между аккаунтами.

Что ещё не завершено:
1. Нужен удалённый PASS именно новых `test_delegated_tool_loop.py` + `test_delegated_failover_session.py` и предыдущих subagent/runtime тестов. Не перетирать Core `.circleci/config.yml`; лучше отдельный временный Agent-only proof, когда это можно сделать без конфликта, либо другой уже имеющийся исполнитель.
2. Проверить реальную реализацию `model_step`: при client A→B она обязана использовать полный локальный history как rebase и создать новый remote Notion thread на B, а не пытаться продолжить thread A.
3. После этого подключить `DelegatedToolLoopRunner` к настоящему `NotionDelegationAdapter`/`SubagentEntryPoint` и реальному `foreground_account_reservations.active_account_ids`.
4. Затем один ограниченный настоящий two-slot Codex/CLI run в уже авторизованной среде, только после проверки отсутствия другого provider-run.
5. После двухслотового PASS — один bounded cooldown/failover сценарий: локальный tool уже выполнен на A, A уходит в cooldown, B получает полную локальную history, создаёт новый Notion thread и продолжает без повторения side effects.
6. После устойчивого Notion/Codex ядра — Qwen adapter под тот же `DelegationDispatcher`, без общего account/thread state.

Следующий запуск: сначала снять результат текущего CircleCI и свежий Core head. Если `.circleci/config.yml` всё ещё занят, не ждать: исследовать/доказать настоящий delegated `model_step` rebase на новом client и добавить тест, который отдельно фиксирует «новый слот = новый remote thread + полная локальная history», не запуская provider traffic.
