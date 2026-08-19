# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 17:58 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, свежий head `eef8bc7994bd6898f4963ffc5791ba9db7c57c0f`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head: `0671ebc5e91ced79f145b4b2082ce11601778a34`.

Что уже доказано раньше:
- режимы системного промпта `engineer` и `owner`;
- приватный `owner_system_prompt` идёт первым прикладным текстом без переписывания и без большой конкурирующей Codex-персоны;
- нейтральный `runtime_context` отделён от прикладного prompt;
- prompt/runtime policy входит в cache/thread identity только через SHA-256 без сохранения приватного текста;
- `payload/server.py` напрямую использует `compose_responses_planner_prompt(...)`;
- незавершённая tool-цепочка держит свой аккаунт, независимая новая задача обходит зарезервированный слот;
- lease-level тесты покрывают два свободных слота, закреплённое продолжение, ожидание занятого владельца, cooldown и fail-closed поведение;
- при допустимом failover старый Notion thread не переносится на другой аккаунт: полная локальная история создаёт новый thread на новом слоте;
- `tools/live_two_slot_codex_probe.py` готовит ограниченную настоящую проверку двух независимых Responses-задач и продолжения на своих слотах;
- provider-neutral `DelegationRequest`/`DelegationDispatcher` уже отделяют child-задачу от provider state родителя;
- на прежнем exact head `61100e2b...` CircleCI `35f42289-d683-40ef-bd4c-ba14fa61ee79` был полностью зелёным для prompt/routing/delegation contract-набора.

Что сделал в этом запуске:
1. Перечитал OWNER_INTENT/CURRENT/handoff и сверил PR #7/#8. Core ушёл на 71 commit вперёд от старой базы Agent, но новые Core-файлы по-прежнему относятся к `.circleci` и NCM28/Windows tooling; `payload/server.py`, prompt-mode, account-pool и delegation product files Core не менял.
2. Добавил `payload/subagent_lifecycle.py`: реальный локальный жизненный цикл дочерних задач с ограничением параллелизма, уникальной активной `task_id`, очисткой состояния при отмене/ошибке и параллельным `run_many` с сохранением порядка результатов. В lifecycle нет account/thread provider state.
3. Добавил `payload/notion_delegation_adapter.py`: Notion-child теперь можно завести в обычный `NotionAccountPool` как новую независимую foreground-работу. У него нет preferred account родителя; перед lease исключаются аккаунты, зарезервированные незавершёнными foreground tool-цепочками; cooldown/failover остаётся обязанностью обычного пула.
4. Расширил существующий `tests/test_delegation_dispatcher.py`, который уже входит в `delegation-contracts`: теперь он проверяет параллельный child lifecycle, запрет дублировать активную child identity и важную связку `dispatcher -> NotionDelegationAdapter -> pool lease` с `preferred_account_id=None` и исключением sticky parent account.
5. Добавил более полный отдельный `tests/test_subagent_lifecycle.py` с bounded parallelism, cancellation cleanup и fail-before-provider для дублей в batch.
6. Provider/live traffic, production, реальные аккаунты и пользовательские данные Notion не трогал. Новый exact head ещё не называю удалённо зелёным: в доступном интерфейсе нет результата свежего CircleCI-прогона после последних commit.

Что ещё не завершено:
1. Нужен ровно один настоящий двухслотовый live Codex probe в уже авторизованной среде; не дублировать другой provider-run.
2. После двухслотового PASS — один bounded cooldown/failover сценарий с полной локальной историей на новом легитимном слоте и новом Notion thread.
3. Новый `NotionDelegationAdapter` надо подключить к фактическому subagent entry point только после живого Codex PASS: `reserved_account_ids` брать из `foreground_account_reservations.active_account_ids`, а child runner должен использовать `context.conversation_key` как новую независимую локальную цепочку.
4. Затем подключить Qwen adapter под тот же `DelegationDispatcher`, не смешивая Notion account/thread state.
5. Перед слиянием Agent-линии синхронизировать её со свежим Core `eef8bc79...`; сейчас PR #8 `mergeable=false`, поскольку Core сильно продвинул `.circleci`/NCM28 линию. Не перетирать Core-конфигурацию ради Agent.

Следующий запуск: сначала снять свежий CircleCI результат exact head `0671ebc5...`. Если contract-набор зелёный и нет уже идущего provider-run — один bounded live two-slot Codex probe. Если live среда занята/недоступна, следующий независимый продуктовый кусок — подключить `NotionDelegationAdapter` к отдельному, выключенному по умолчанию subagent entry point без provider запуска и добавить end-to-end тест `lifecycle -> dispatcher -> adapter -> real NotionAccountPool` на fake clients.
