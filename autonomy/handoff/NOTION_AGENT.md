# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 22:57 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `b3d75d96fba7dff4b84b7d0aa19f7c7ce63451a7`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Свежий head после этого запуска: `07798da1078fb34fc41d9e344b1f1ef92e3e5ec7`.

Что уже доказано раньше:
- два режима системного промпта `engineer` и `owner`;
- приватный `owner_system_prompt` идёт первым прикладным текстом без переписывания и без большой конкурирующей инженерной персоны;
- нейтральный `runtime_context` отделён от прикладного prompt;
- prompt/runtime policy входит в cache/thread identity только через SHA-256, приватный текст там не хранится;
- `payload/server.py` напрямую использует общую prompt-policy;
- незавершённая tool-цепочка держит свой аккаунт, независимая новая задача обходит зарезервированный слот;
- при допустимом failover старый Notion thread не переносится через другой аккаунт: полная локальная история создаёт новый thread на новом допустимом слоте;
- `DelegationRequest`/`DelegationDispatcher`, `SubagentLifecycle`, `SubagentEntryPoint`, `NotionDelegationAdapter` и `notion_subagent_runtime` отделяют child-задачу от provider state родителя;
- в ветке есть настоящий Codex CLI project probe, но live/provider запуск пока намеренно не дублировался.

Что сделал в этом запуске:
1. Перечитал `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, этот handoff и заново сверил PR #7/#8. В начале Agent был на `5098f89c...`, Core — на `73361762...`; к концу Core ушёл до `b3d75d96...`, но мои изменения не заходят в Windows/NCM28.
2. Закрыл недостающую provider-часть для delegated child-loop: добавил `payload/notion_delegated_model_step.py`.
3. Реальный Notion `model_step` теперь хранит remote thread только для конкретного provider-client внутри одной child-сессии. На том же клиенте продолжение идёт инкрементально через его `thread_id`.
4. При допустимом A→B failover новый клиент B НЕ получает `thread_id` A. Он получает полный локальный transcript, включая уже выполненный tool-result, и создаёт собственный новый Notion thread.
5. Если A падает на provider-вызове уже после локального `write_file`/другого side effect, provider-state не продвигается, бюджет модельных ходов не тратится повторно, а B продолжает ту же локальную child-session. Локальный tool повторно не запускается.
6. Нашёл и сразу закрыл ещё один скрытый риск: remote-thread state раньше мог пережить окончание child-задачи внутри долгоживущего `model_step`. Теперь `DelegatedToolLoopRunner.start_session()` умеет получать session-scoped model-step через `start_session(context)`, а `NotionDelegatedModelStep` хранит thread map только внутри этой child-сессии. Даже повторное использование того же `task_id` позже начинает свежий remote thread.
7. Генерируемый локальный `call_id` для Notion JSON tool-call теперь детерминирован через SHA-256, а не через process-randomized `hash()`.
8. Добавил `build_notion_tool_subagent_entrypoint(...)` в `payload/notion_subagent_runtime.py`. Это первая provider-ready композиция `NotionDelegatedModelStep → DelegatedToolLoopRunner → NotionDelegationAdapter → обычный account pool → SubagentEntryPoint`. Родительский account/thread state туда не передаётся, а источник `reserved_account_ids` остаётся обязательным.
9. Добавлены проверки:
   - `tests/test_notion_delegated_model_step.py`: same-client incremental thread, A→B full-history rebase без старого thread, независимые child-context, повтор того же task id после завершения не воскресит старый thread;
   - `tests/test_notion_tool_subagent_runtime.py`: полный путь через настоящий builder + fake lease A→B, один локальный side effect, обязательный avoid родительской reservation, B получает полный history без `thread_id` A.
10. Расширил Agent-only `delegation-contracts` в CircleCI этими тестами и предыдущими stateful failover-тестами. Это затрагивает только Agent-ветку; Windows jobs по-прежнему отфильтрованы на Core-ветку.
11. На exact head `07798da1...` все четыре Agent CircleCI job ЗЕЛЁНЫЕ: workflow `4d35bdd6-420a-42fe-a2dc-bf3b19edbfbe`; `agent-contracts` job `fe1f2161-0981-4be6-bea0-94b1ef3fbc2d`, `prompt-contracts` `eba652e8-c2dc-4785-8f23-f2a2df0d1fef`, `routing-contracts` `509e1e6a-493f-438d-b76d-adf9ead1f714`, `delegation-contracts` `0159121f-942f-4d28-b9f9-f730a756a0e6`.
12. Provider/live traffic, production, реальные Notion-аккаунты и NCM28 не трогались.

Главное новое понимание:
- безопасный failover субагента должен разделять два состояния: локальная child-session живёт через смену аккаунта, а remote Notion thread живёт только внутри конкретного provider-клиента этой child-session;
- новый слот не «продолжает чужой thread», а получает полный локальный transcript и создаёт свой remote thread;
- завершённая child-session должна уничтожать remote-thread map. Иначе повтор task id может случайно воскресить старый provider context;
- provider-ready runtime для Notion теперь можно собрать без участия родительского account/thread affinity: нужен обычный пул, локальный tool executor, каталог tools и `foreground_account_reservations.active_account_ids` как источник занятых слотов.

Что ещё не завершено:
1. Подключить `build_notion_tool_subagent_entrypoint(...)` к настоящему серверному lifecycle только после выбора безопасного локального tool executor/catalog. Сам entrypoint должен остаться выключенным по умолчанию.
2. Источник reservations при реальном подключении — существующий `foreground_account_reservations.active_account_ids`; не создавать второй реестр занятости.
3. Один ограниченный настоящий two-slot Codex/CLI run в уже авторизованной среде, только после проверки отсутствия другого provider-run: две независимые foreground-задачи на разных свободных легитимных слотах, tool-result continuation на владельце.
4. После этого один bounded cooldown/failover: локальный tool уже выполнен на A, A уходит в cooldown, B получает полный локальный history, создаёт новый Notion thread и продолжает без повторения side effects.
5. После устойчивого Notion/Codex ядра — Qwen adapter под тот же `DelegationDispatcher`, без общего account/thread state.

Следующий запуск: сначала снять свежий Core head и проверить, нет ли уже другого provider-run. Не добавлять ещё синтетических уровней вокруг уже зелёного delegated A→B. Либо аккуратно подключить provider-ready builder к реальному server lifecycle с disabled-by-default gate и существующими foreground reservations, либо, если авторизованная среда свободна, перейти к одному настоящему two-slot Codex project run.
