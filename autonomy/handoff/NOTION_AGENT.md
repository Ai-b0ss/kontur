# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — FREE FABRIC G1, повторный запуск

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, head `700f3f12a5bbbd82021ace64fbee3be93f99a1e0`.

Перед работой повторно проверены канонические FREE FABRIC G1. Режим остаётся `STATIC_NO_CAS`; для `NOTION_AGENT` назначены только `E4-JITTER` и `E5-SCHEDULED-RECOVERY`. Поэтому проектный код Notion, Windows/NCM28 и чужие задачи в этой смене не менялись.

Что сделано бесплатно:
- по точному пути/ref прочитан checkpoint предыдущего запуска `NOTION_AGENT_G1_A_CHECKPOINT.json`;
- проверены fence-поля `generation=1`, `run_id=PLATFORM-MEASUREMENTS-20260820`, `task_id=E5-SCHEDULED-RECOVERY`, `brain=NOTION_AGENT`;
- SHA-256 состояния пересчитан каноническим JSON-алгоритмом из `e5_scheduled_recovery_probe.py`; получено ровно `de4b0fc04b0df52da9424090f3f5ab94e0dc047d812c9ca9fbc73a6a0eb62bbe`, что совпало с checkpoint;
- опубликован новый неизменяемый evidence-объект `autonomy/free_fabric/evidence/PLATFORM-MEASUREMENTS-20260820/E5-SCHEDULED-RECOVERY/NOTION_AGENT_G1_B_RECOVERY.json`;
- это закрывает именно `cross_schedule_checkpoint_recovery` между двумя отдельными запусками. Это НЕ повышает автоматически `scheduled.compute` или `scheduled.library_publish`: оба статуса остаются `UNKNOWN` до нового канонического platform manifest/contract;
- по E4 опубликовано второе телеметрическое наблюдение `autonomy/free_fabric/evidence/PLATFORM-MEASUREMENTS-20260820/E4-JITTER/NOTION_AGENT_G1_B_JITTER.json`. Время по-прежнему не используется для correctness, ownership или acceptance.

Долговечные evidence снабжены `brain/execution/provenance`; semantic search и wall clock не использовались как источник правильности. Hosted CI, Windows, production, реальные Notion-аккаунты и provider traffic не использовались.

Следующий шаг в текущем manifest generation: не забирать проектные задачи Notion и не заниматься work stealing. Для E5 полезный кусок уже выполнен; до нового manifest generation только проверять, не появился ли новый назначенный эксперимент/фаза. После снятия `STATIC_NO_CAS` основной проектный шаг остаётся прежним: материализовать проверенный `ServerSubagentLifecycle` и single-slot reservation wiring в точную копию `payload/server.py`, затем бесплатно прогнать локальные prompt/routing/delegation/tool-loop проверки и только потом делать один bounded live two-slot/failover probe.

## Предыдущая проектная точка Notion Agent

В Agent-линии уже есть:
- два режима системного промпта `engineer/owner`; приватный prompt владельца идёт как главный прикладной текст без смешивания с инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, незавершённая tool-цепочка сохраняет правильный account/thread;
- допустимый failover переносит полную локальную историю на другой слот, но не переносит старый Notion `thread_id` и не повторяет уже выполненный локальный side effect;
- готовы `DelegationDispatcher`, provider-ready Notion child-runtime, `ServerSubagentLifecycle`, bounded tool-loop и live two-slot/failover/Codex project probes;
- single-slot reservation gap закрыт в fail-closed materializer: независимая задача должна ждать единственный sticky-слот до `clear()` или TTL, а не красть его;
- malformed MCP `isError` закрывается fail-closed: если поле присутствует, оно обязано быть настоящим JSON boolean;
- исправлен `ServerSubagentLifecycle._swap_pool()`: неудачная сборка replacement больше не публикует ложное новое generation; старый runtime и generation остаются текущими.

Коммиты последней проектной Agent-смены: `3899d5faaf6c7441cf2afae2319c755616404562` и `700f3f12a5bbbd82021ace64fbee3be93f99a1e0`.
