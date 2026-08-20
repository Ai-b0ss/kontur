# Notion — ротация, агентность, prompt-mode и делегирование

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

Что делать дальше:
1. Не запускать CircleCI/GitHub Actions в ZERO-MINUTE режиме и не делать push ради CI.
2. Главный следующий кусок — материализовать уже fail-closed server wiring прямо в `payload/server.py`: `ServerSubagentLifecycle` + оба single-slot reservation исправления. Делать только из полной точной копии файла; не переписывать большой server по памяти или кусками.
3. После прямой материализации постоянные single-slot проверки должны работать на настоящем `ForegroundAccountReservations` из `server.py`, без зависимости от materializer. Затем бесплатно локально прогнать prompt/routing/delegation/tool-loop/server-lifecycle набор.
4. При следующем исследовании lifecycle отдельно проверить rebind-конкуренцию: если два refresh/rebind идут одновременно, каждый drain должен ждать именно своё старое поколение и не закрывать pool, который уже стал текущим для более нового поколения.
5. Только после крепкого локального ядра и при свободной уже авторизованной среде — один настоящий two-slot Codex project probe, затем один A→B failover probe без переноса старого Notion thread и без повторного локального side effect.
6. После устойчивого Notion/Codex ядра подключать Qwen adapter к тому же `DelegationDispatcher`, без общего account/thread state между провайдерами.
