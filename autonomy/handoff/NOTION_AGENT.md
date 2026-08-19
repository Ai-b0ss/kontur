# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-19 18:46 МСК

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7. При начале запуска handoff указывал Core `eef8bc7994bd6898f4963ffc5791ba9db7c57c0f`; PR #8 всё ещё основан на старом Core SHA `a62833f...`, поэтому перед слиянием нужна аккуратная синхронизация без перезаписи NCM28/CircleCI.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Новый head после этого запуска: `b331d13d50f5abce33cefb7e3f451c8168a92e71`.

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
- provider-neutral `DelegationRequest`/`DelegationDispatcher`, `SubagentLifecycle` и `NotionDelegationAdapter` отделяют child-задачу от provider state родителя и заводят её в обычный пул как новую независимую работу;
- на прежнем exact head `61100e2b...` CircleCI был зелёным для prompt/routing/delegation contract-набора.

Что сделал в этом запуске:
1. Перечитал OWNER_INTENT/CURRENT/handoff и заново сверил PR #8 и актуальные файлы agent-ветки.
2. Не стал запускать provider traffic вслепую: доступного надёжного сигнала, что другой живой прогон не идёт, в этом интерфейсе нет.
3. Реализовал следующий независимый кусок из прошлого handoff: `payload/subagent_entrypoint.py`. Это явная точка запуска будущих субагентов, выключенная по умолчанию. Она не знает account id/thread id, только переводит `SubagentLaunch` в нейтральный `DelegationRequest` и передаёт его существующему bounded `SubagentLifecycle`.
4. Добавил возможность безопасного включения через runtime predicate без пересоздания объекта. По умолчанию любой запуск завершается до обращения к adapter/provider.
5. Добавил `tests/test_subagent_entrypoint.py`: проверка выключенного по умолчанию режима до provider call, сохранения независимой conversation identity, runtime-toggle и ограничения параллелизма.
6. Новые файлы не трогают `server.py`, account-pool, Windows/NCM28, production или реальные аккаунты. Текущий exact head `b331d13d...` ещё не называю удалённо зелёным: свежего результата CircleCI для этих двух новых commit в доступном интерфейсе нет.

Что ещё не завершено:
1. Нужен зелёный удалённый contract-run на exact head `b331d13d...`, включая новый `tests.test_subagent_entrypoint`.
2. Затем ровно один настоящий двухслотовый live Codex probe в уже авторизованной среде, только если доказано отсутствие другого provider-run.
3. После двухслотового PASS — один bounded cooldown/failover сценарий с полной локальной историей на новом легитимном слоте и новом Notion thread.
4. После живого Codex PASS подключить `NotionDelegationAdapter` к `SubagentEntryPoint`: `reserved_account_ids` брать из реального реестра foreground reservations, а child runner должен использовать `context.conversation_key` как новую независимую локальную цепочку. Сам entry point уже готов и по умолчанию выключен.
5. Затем добавить Qwen adapter под тот же `DelegationDispatcher`, не смешивая Notion account/thread state.
6. Перед слиянием Agent-линии синхронизировать её со свежим Core и сохранить его CircleCI/NCM28 изменения.

Следующий запуск: сначала проверить удалённые контракты exact head `b331d13d...`. Если live среда свободна — один bounded two-slot Codex probe. Если live запуск всё ещё нельзя безопасно начать, следующий полезный кусок — end-to-end тест `SubagentEntryPoint -> lifecycle -> dispatcher -> NotionDelegationAdapter -> настоящий NotionAccountPool` на fake Notion clients, чтобы доказать два child одновременно на разных свободных слотах и исключение sticky parent reservation без provider traffic.
