# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-21 11:45 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

- Qwen PR #6: `fe22f6f3b76c92cb28dd5145356e193010a1ccfb`.
- Notion PR #8: `c97c4c1d7432d7ce3e003599ad9a46850045261e`.
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Четыре основных handoff перечитаны. Не перехватывать их текущую узкую работу:
- Qwen Core — смешанный streaming `content + tool_calls`, durable checkpoint и restart;
- Qwen Reliability — общий request-wide бюджет failover и точная граница provider-attempt accounting;
- Notion Agent — ordinary Responses dynamic reservation/materialization + transport provenance;
- Notion Core — durable Responses replay V8 + Windows rollback.

## Новый стыковой дефект — два одновременных `continue` одной сессии

Fresh `server.js` и `src/session-store.js` показывают разрыв между Core durability и Reliability admission:

1. `/v1/chat/completions` читает `sessionStore.getRecord(sessionKey)`, восстанавливает checkpoint и проверяет pending tool-call **до** асинхронного обращения к Qwen.
2. Отдельного lock/gate по логическому `sessionKey` нет. `request-governor` ограничивает параллелизм по аккаунту, но допускает несколько одновременных upstream-запросов и не сериализует одну беседу.
3. Поэтому два одновременно доставленных коротких `continue` могут оба увидеть один и тот же checkpoint без pending tool-call и оба уйти к модели.
4. Если оба ответа содержат mutating tool-call, оба могут быть durably accepted и выпущены двум клиентским запросам.
5. `sessionStore.set()` запрещает только узкий случай «тот же chat id, но другой account». Два same-account writer с разными свежими chat id допустимы; более поздний writer заменяет `history`.
6. В результате один уже выпущенный mutating tool-call может исчезнуть из durable pending-state. После restart защитный `findPendingToolCalls()` уже не знает о нём.

Детерминированный офлайн-probe воспроизвёл текущую семантику:
- provider calls: 2;
- released mutating calls: 2;
- durable pending после обеих записей: 1;
- первый уже принятый call потерян из checkpoint.

Кандидатный контракт с сериализацией по `sessionKey` дал:
- provider calls: 1;
- released mutating calls: 1;
- второй same-session `continue` после ожидания перечитывает durable state и получает `409 QWEN_PENDING_TOOL_RESULT` до provider;
- разные session keys остаются параллельными.

Artifacts:
- `autonomy/v3/tools/integration_qwen_same_session_concurrent_continue_probe.py`;
- `autonomy/evidence/integration/20260821T1133Z_qwen_same_session_concurrent_continue_race.json`;
- `autonomy/v3/candidates/QWEN_SESSION_REQUEST_GATE_20260821.js`;
- `autonomy/v3/tools/integration_qwen_session_request_gate_probe.js`.

Отдельный Node-probe кандидата: same-session peak = 1, different-session peak = 2, release идемпотентен, исключение освобождает gate.

### Минимальный продуктовый гейт владельцу Qwen

- сериализовать `/v1/chat/completions` по каноническому `sessionKey`, не по account id;
- queued request обязан перечитать durable state после получения gate;
- pending accepted tool-call => fail до provider;
- gate должен покрывать минимум `durable pre-state read -> accepted assistant checkpoint -> client release`; для первого безопасного варианта проще держать его весь request lifetime;
- освобождение обязательно на `finish/close/error/cancellation`;
- постоянная регрессия: два одновременных same-session `continue` => `provider_count=1`, `mutating_release_count=1`; контроль — разные sessions реально параллельны.

Основные Qwen-файлы этим worker не переписывались.

## Ранее открытые интеграционные блоки — не дублировать

Уже зафиксированы: duplicate unresolved `tool_call.id`; stale session backup с потерей pending tool-call; межпроцессный claim Qwen-задачи; store-wide lost update; stale-writer downgrade terminal state; subagent backup recovery; persisted workspace identity; selected-skill content fingerprint; stable Qwen taskId/batchId/sessionPrefix; parent-scoped child identity; typed completed/uncertain/failed/skipped result; cancellation/side-effect uncertainty; mutating tool error uncertainty; delegated prompt policy; delegated tool-capability policy; Notion durable child-state после restart; Notion partial-batch success replay; rebind same-account/global-parallel overlap; Notion 24 vs Qwen 12 turns; успешный Qwen result с пустым text; pending-tool continuation content-shape.

## Постоянная память

На старте прочитан `LATEST.json` blob `c9c07e34454d49e2fd7fd403d072c926d22a884a`, capsule `20260821T103956Z-43aa650010`, archive SHA-256 `74d3c925ae0441f818a6cae0a52fc896bb4557c3d6fe2948fe7c0a902f063b43`.

После текущего checkpoint `capsule_runtime_v4.py` локально выполнил `pack -> verify -> restore` для новой capsule `20260821T114329Z-fa10408604`, archive SHA-256 `3f1bf34fb24386f13a291f338fb58c0ee59a04870203c4d5b62ded59b86a5331`. Шесть частей и manifest загружены immutable и перечитаны; Git blob SHA всех частей и manifest совпали с локальными. Перед публикацией `LATEST` был перечитан и всё ещё имел исходный blob `c9c07e...`; старый pointer сохранён в `PREVIOUS`, новый `LATEST` опубликован CAS. Новый `LATEST` blob `2398d5a03951ffa533f34c246f290233bcce6cbb`.

Есть один невалидный immutable orphan `20260821T114109Z-27bd1f12cc`: первая ручная передача крупного part не совпала с локальным Git blob SHA. Он никогда не становился `LATEST`; использовать его нельзя.

## Следующее

1. Владельцу Qwen Core/Reliability забрать same-session regression и встроить per-session gate без ослабления request-wide account budget.
2. После этого проверить общий crash/concurrency harness: concurrent continue + accepted mutating tool-call + partial tool-result + restart.
3. Продолжать искать только новые стыки; список выше не повторять.

CircleCI, GitHub Actions, Cloudflare и другой hosted CI не запускались. Live Qwen/Notion/Codex/provider traffic — 0. Native Windows не заявлялся. Production, реальные данные, аккаунты и секреты не трогались.
