# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — продуктовая смена: single-slot deadlock найден до материализации

Notion Core: `candidate/ncm28-windows-fixed-v1`, PR #7, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head после этой смены `b518d0a9c349f8530d680bc46c35bc8752ddd8de`.

Владелец явно вернул этого исполнителя к продуктовой работе Notion Agent; FREE FABRIC-эксперименты здесь больше не являются задачей этой автоматизации.

Главная новая находка: прежний fail-closed materializer для single-slot reservation был логически опасен. Он заставлял независимую задачу ждать sticky-reservation уже внутри `handle_openai_responses`, то есть после захвата единственного `responses_inference_gate`. В таком порядке независимая задача могла удерживать gate, пока ждёт reservation, а настоящий владелец незавершённой tool-chain не мог снова войти через тот же gate, чтобы закончить цепочку и снять reservation. Получался тупик до TTL.

Исправлено на Agent-ветке:
- ожидание single-slot reservation перенесено ДО захвата `responses_inference_gate`;
- `responses_inference_slot(...)` получает `turn_key` и на одном аккаунте ждёт только чужие sticky-reservations;
- владелец своей reservation исключается по `owner_turn_key` и может сразу продолжить собственную tool-chain;
- multi-account логика внутри `handle_openai_responses` оставлена прежней (`account_pool.size > 1`), чтобы не смешивать два разных механизма;
- TTL по-прежнему освобождает брошенную reservation;
- оба места входа Responses (stream и non-stream) обязаны передавать `turn_key` в inference slot;
- materializer по-прежнему fail-closed по точным preimage/count anchors.

Дополнительно усилен startup wiring:
- `ConversationSegmentStore`, `ServerSubagentLifecycle` и bind нового lifecycle теперь полностью строятся до публикации новых server globals;
- при любой ошибке/отмене до публикации новый pool закрывается через `except BaseException`;
- только после успешной сборки публикуются `account_pool`, `subagent_lifecycle`, `conversation_segments`;
- shutdown сохраняет порядок `unbind_and_drain -> обязательный account_pool.aclose -> очистка BRIDGE_AUTH_SECRET`.

Локально на hosted Python отдельно проверена семантика нового reservation-примитива: чужая задача при pool_size=1 действительно ждёт, владелец собственной reservation входит сразу, брошенная reservation снимается по TTL. Hosted CI/CircleCI/GitHub Actions не запускались.

Коммиты этой смены в PR #8: `677824675ff7aff386275e761a1d9355a0ccaa1f`, `26e5e05e7a94e54d5f9261e8b2393fd74c902cb4`, `34b0d81c6ab82b3305a74cc3b345d0309a29bddd`, `b518d0a9c349f8530d680bc46c35bc8752ddd8de`.

Что остаётся следующим:
1. Материализовать именно этот уже исправленный wiring в реальный `payload/server.py`. Не применять старую версию materializer: она могла создать single-slot deadlock.
2. После материализации локально прогнать prompt/routing/delegation/tool-loop/lifecycle и отдельный сценарий «owner reservation + unrelated waiter + owner continuation» на настоящем server path.
3. Только после крепкого локального PASS — один bounded live Codex project run, затем two-slot run и реальный A→B failover без переноса старого Notion thread и без повторения уже выполненного локального side effect.
4. NCM28/Windows Core не менять без отдельной необходимости.

Техническое ограничение текущей ChatGPT-среды: доступный GitHub write-tool заменяет файл целиком и не умеет применить patch к большому `payload/server.py`; поэтому в этой смене опасный материализатор сначала исправлен и усилен, но сам большой server-файл ещё не перезаписан вслепую. Следующий исполнитель должен материализовать точный diff только при наличии полной локальной копии файла, а не реконструировать `server.py` кусками.

## Предыдущая проектная точка Notion Agent

В Agent-линии уже есть:
- два режима системного промпта `engineer/owner`; приватный prompt владельца идёт как главный прикладной текст без смешивания с инженерной персоной;
- независимые foreground-задачи распределяются по свободным легитимным слотам, незавершённая tool-цепочка сохраняет правильный account/thread;
- допустимый failover переносит полную локальную историю на другой слот, но не переносит старый Notion `thread_id` и не повторяет уже выполненный локальный side effect;
- готовы `DelegationDispatcher`, provider-ready Notion child-runtime, `ServerSubagentLifecycle`, bounded tool-loop и live two-slot/failover/Codex project probes;
- malformed MCP `isError` закрывается fail-closed: если поле присутствует, оно обязано быть настоящим JSON boolean;
- исправлен `ServerSubagentLifecycle._swap_pool()`: неудачная сборка replacement больше не публикует ложное новое generation; старый runtime и generation остаются текущими.
