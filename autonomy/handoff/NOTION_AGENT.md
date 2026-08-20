# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — FREE FABRIC G1 / ZERO-MINUTE

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, head `700f3f12a5bbbd82021ace64fbee3be93f99a1e0`.

В начале смены прочитаны канонические FREE FABRIC G1: `OWNER_OVERRIDE_G1.json`, `PLATFORM_CONTRACT_V0.json`, `RUN_PLATFORM_MEASUREMENTS_G1.json`. Активен `STATIC_NO_CAS`; для brain `NOTION_AGENT` назначены только `E4-JITTER` и `E5-SCHEDULED-RECOVERY`, поэтому проектный код Notion в этой смене не менялся и чужие задачи не забирались.

Что сделано бесплатно локально:
- добавлен `autonomy/free_fabric/probes/e4_jitter_probe.py`; он считает отклонение времени запуска только как телеметрию и явно запрещает использовать время для correctness/ownership;
- зафиксировано одно наблюдение E4: системный runtime-context этой смены был на 165 секунд раньше номинальной отметки расписания. Это не считается доказательством распределения jitter и не меняет статус `scheduled.compute`;
- добавлен `autonomy/free_fabric/probes/e5_scheduled_recovery_probe.py` с атомарной записью checkpoint, проверкой `generation/run/task`, SHA-256 состояния, восстановлением в новом Python-процессе, отказом на stale generation и повреждённом состоянии;
- локальный E5 self-test: `fresh_process_recovery=PASS`, `stale_generation_rejected=PASS`, `corruption_rejected=PASS`;
- опубликован неизменяемый checkpoint для следующего запуска: `autonomy/free_fabric/evidence/PLATFORM-MEASUREMENTS-20260820/E5-SCHEDULED-RECOVERY/NOTION_AGENT_G1_A_CHECKPOINT.json`;
- опубликованы отдельные evidence-файлы E4 и E5 с полями `brain/execution/provenance`.

Важная граница доказательства:
- сейчас доказан только локальный протокол восстановления в новом процессе;
- настоящий `CROSS_SCHEDULE_RECOVERY` ещё не доказан. Следующий запуск `NOTION_AGENT` должен прочитать checkpoint по точному пути/ref, проверить generation/run/task + `state_sha256` и выпустить новый неизменяемый evidence-объект, не перезаписывая старый;
- `scheduled.compute` и `scheduled.library_publish` остаются `UNKNOWN`, как требует `PLATFORM_CONTRACT_V0`.

Hosted CI, Windows, production, реальные Notion-аккаунты и provider traffic не использовались.

## 2026-08-20 12:45–13:05 МСК — ZERO-MINUTE

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8. Текущий head после этой смены: `700f3f12a5bbbd82021ace64fbee3be93f99a1e0`.

Что уже есть в Agent-линии:
- два режима системного промпта `engineer/owner`; приватный prompt владельца идёт как главный прикладной текст без смешивания с инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, незавершённая tool-цепочка сохраняет правильный account/thread;
- допустимый failover переносит полную локальную историю на другой слот, но не переносит старый Notion `thread_id` и не повторяет уже выполненный локальный side effect;
- готовы `DelegationDispatcher`, provider-ready Notion child-runtime, `ServerSubagentLifecycle`, bounded tool-loop и live two-slot/failover/Codex project probes;
- single-slot reservation gap уже закрыт в fail-closed materializer: независимая задача должна ждать единственный sticky-слот до `clear()` или TTL, а не красть его;
- malformed MCP `isError` закрывается fail-closed: если поле присутствует, оно обязано быть настоящим JSON boolean.

Что сделано в этой смене:
1. Перечитаны `OWNER_INTENT_RU.md`, `CURRENT_RU.md`, предыдущий handoff и свежие PR #7/#8. Core/Windows/NCM28 не менялись.
2. Hosted CI вручную не запускался. Логику нового исправления сначала воспроизвёл в локальной ChatGPT-среде.
3. Найден отдельный дефект `ServerSubagentLifecycle._swap_pool()`: при неудачной сборке нового delegated runtime код сначала увеличивал `generation`, а потом падал. Старый entrypoint оставался рабочим, но наружу уже публиковалось новое поколение, которого фактически не существовало. На будущей auth/runtime-ротации это могло дать ложное состояние rebind.
4. Локальный воспроизводимый тест на старом коде дал: `generation_after_failed_rebind=2`, при этом старый entrypoint сохранился. Это подтвердило дефект.
5. Исправление: новый entrypoint теперь строится до изменения состояния lifecycle. Если сборка replacement падает, поколение не меняется и старый runtime остаётся текущим без ложного rebind. Локальный повтор того же теста: `generation_after_failed_rebind=1`, старый entrypoint сохранён.
6. В `tests/test_server_subagent_lifecycle_drain.py` добавлена регрессия: неудачный `rebind_pool_and_drain()` не меняет generation, не заменяет старый entrypoint и старое поколение остаётся пригодным для запуска child-задачи.
7. Коммиты Agent-ветки: `3899d5faaf6c7441cf2afae2319c755616404562` (исправление lifecycle), `700f3f12a5bbbd82021ace64fbee3be93f99a1e0` (регрессия). Production, реальные Notion-аккаунты и provider traffic не трогались.

Что доказано бесплатным исполнителем в этой смене:
- старый `_swap_pool()` действительно публиковал ложное новое поколение при исключении во время сборки replacement;
- после исправления неудачный rebind атомарен с точки зрения наблюдаемого lifecycle state: generation и текущий entrypoint остаются прежними.

Что делать дальше по Notion после снятия режима `STATIC_NO_CAS`/нового manifest generation:
1. Не запускать CircleCI/GitHub Actions в ZERO-MINUTE режиме и не делать push ради CI.
2. Главный следующий проектный кусок — материализовать fail-closed server wiring прямо в `payload/server.py`: `ServerSubagentLifecycle` + оба single-slot reservation исправления. Делать только из полной точной копии файла.
3. После прямой материализации бесплатно локально прогнать prompt/routing/delegation/tool-loop/server-lifecycle набор.
4. Отдельно проверить rebind-конкуренцию двух refresh/rebind.
5. Только после крепкого локального ядра и при свободной уже авторизованной среде — один настоящий two-slot Codex project probe, затем один A→B failover probe.
6. После устойчивого Notion/Codex ядра подключать Qwen adapter к тому же `DelegationDispatcher`, без общего account/thread state между провайдерами.
