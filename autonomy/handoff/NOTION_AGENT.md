# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 20:45 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `84fcd1e5b84f2ede0e5719198f8082f5b838eccc`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Свежий head после этого запуска: `51a575693e438be1fb69fac0824b03a573db286e`.

Что уже доказано раньше:
- два режима системного промпта `engineer` и `owner`;
- приватный `owner_system_prompt` идёт первым прикладным текстом без переписывания и без большой конкурирующей инженерной персоны;
- нейтральный `runtime_context` отделён от прикладного prompt;
- prompt/runtime policy входит в cache/thread identity только через SHA-256, приватный текст там не хранится;
- `payload/server.py` напрямую использует общую prompt-policy;
- незавершённая tool-цепочка держит свой аккаунт, независимая новая задача обходит зарезервированный слот;
- при допустимом failover старый Notion thread не переносится через другой аккаунт: полная локальная история создаёт новый thread на новом допустимом слоте;
- `DelegationRequest`/`DelegationDispatcher`, `SubagentLifecycle`, `SubagentEntryPoint`, `NotionDelegationAdapter` и `notion_subagent_runtime` отделяют child-задачу от provider state родителя;
- предыдущий основной Agent-набор prompt/routing/delegation был зелёным в CircleCI.

Что появилось непосредственно перед этим запуском:
- Agent-ветка дошла до `8f1ad301...`;
- добавлен настоящий `tools/run_real_codex_cli_project_probe.py` и контракт его Codex-конфигурации/секретной границы;
- это уже проверка реального Codex CLI через Responses bridge, а не только прямой вызов внутренней Python-функции.

Что сделал в этом запуске:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff, заново сверил PR #7/#8 и свежие head.
2. Не трогал Windows/NCM28 и не менял `.circleci/config.yml`, потому что Core продолжает активно менять общий CI-файл.
3. Добавил `payload/delegated_tool_loop.py` — изолированный ограниченный model/tool-loop для дочерней задачи. Он принимает `DelegationContext` + уже выбранный пулом provider-client, хранит только локальную историю child-задачи и вообще не принимает account id или remote thread id родителя.
4. Tool-loop возвращает ошибки локального инструмента модели как нейтральный `tool_execution_failed`, без текста исключения/пути/секретов, чтобы child мог сам исправить вызов и продолжить вместо обрыва всей задачи.
5. Добавил `tests/test_delegated_tool_loop.py` с четырьмя контрактами:
   - два child одновременно не смешивают локальную историю и используют разные `context.conversation_key`;
   - ошибка инструмента попадает обратно в model-loop, после чего child может сделать исправленный вызов и завершиться;
   - `max_model_turns` остаётся жёстким потолком;
   - повторное использование одного `call_id` завершает child fail-closed.
6. Текущий CircleCI на exact head `51a57569...` зелёный для существующих `agent-contracts`, `prompt-contracts`, `routing-contracts`, `delegation-contracts`. Важно: новые `test_delegated_tool_loop.py` и предыдущие три subagent/runtime теста пока не входят в эти job, поэтому этот зелёный статус не выдавать за доказательство новых тестов.
7. Provider/live traffic, production, реальные аккаунты и NCM28 не трогались.

Важное техническое наблюдение для следующего шага:
- `NotionDelegationAdapter` сейчас вызывает `lease.run(lambda client: runner(context, client))` без отдельного `retry_operation`.
- `AccountLease.run()` при допустимом failover может повторно вызвать всю operation на новом аккаунте. Для многоходового child-loop нельзя бездумно начинать child с нуля после уже выполненных локальных инструментов: это может повторить side effects.
- Поэтому перед живым подключением нового `DelegatedToolLoopRunner` нужен stateful retry-контракт: при смене допустимого слота сохранять полную локальную child-history, создавать новый Notion thread на новом аккаунте и продолжать с этой history, а не повторять objective с нуля. Это тот же принцип, который уже доказан для основного foreground Responses failover.

Что ещё не завершено:
1. Не конфликтуя с Core, получить удалённый запуск для новых subagent/runtime/tool-loop тестов. Если `.circleci/config.yml` всё ещё занят, не переписывать его поверх Core; можно сделать отдельный временный Agent-only proof branch/config после снятия Core-изменений.
2. Реализовать stateful retry для delegated child-loop: один локальный `conversation_key` и одна history переживают допустимую смену аккаунта; remote Notion thread на новом аккаунте всегда новый.
3. После этого подключить child runner к `NotionDelegationAdapter` и к реальному `foreground_account_reservations.active_account_ids`.
4. Затем один ограниченный настоящий two-slot Codex/CLI run в уже авторизованной среде, только после проверки отсутствия другого provider-run.
5. После двухслотового PASS — один bounded cooldown/failover сценарий с полной локальной history и новым Notion thread другого допустимого слота.
6. После устойчивого Notion/Codex ядра — Qwen adapter под тот же `DelegationDispatcher`, без общего account/thread state.

Следующий запуск: сначала сверить свежие head и результат Core. Если общий CI-файл всё ещё занят — не ждать: реализовать stateful delegated retry/session поверх `DelegatedToolLoopRunner` и тест с fake lease, который намеренно меняет client A→B после первого tool-result и доказывает, что локальная child-history не откатывается и side effect не повторяется.
