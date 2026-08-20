# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — delegation envelope hardened; exact server.py wiring остаётся следующим крупным шагом

Notion Core: `candidate/ncm28-windows-fixed-v1`, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`. Core/NCM28 не менять без отдельной необходимости.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `e12ab315cb365650f56dc1e48551f04e55e5276c`.

### Фактическое состояние

- настоящий `payload/server.py` всё ещё имеет exact Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`; прямую полную замену огромного файла пока не делали;
- полный exact blob сервера уже удалось получить через GitHub blob API, но его lossless-перенос в локальную файловую систему ещё не закрыт: одна попытка записи попала в каталог без прав на запись; продуктовый файл от этого не менялся;
- `tools/apply_startup_status_cleanup.py` fail-closed по exact blob `f02cef...` и содержит пять подготовленных преобразований: ранний startup `BaseException` cleanup; owner-mode не запускает extractor Codex `instructions` в planner и metric/token path; stale affinity больше не считается владением foreground reservation; multi-account routing использует `wait_for_turn_route(..., owner_turn_key=turn_key)`;
- single-slot path уже ждёт чужую foreground reservation до захвата общего inference gate, а owner continuation исключает свою reservation по `turn_key`, поэтому тупик на одном слоте не создаётся;
- lifecycle rebind/unbind cancellation-safe; старое поколение не закрывается, пока его child ещё работает; статус учитывает child, которые дренируются на старом поколении;
- delegated failover сохраняет локальную историю и результаты уже выполненных инструментов; новый provider client создаёт новый Notion thread и не получает старый thread другого аккаунта;
- `NotionDelegationAdapter` перепроверяет живые foreground reservations до lease, после lease и перед каждой provider-попыткой, включая внутренний failover;
- persistent `ConversationSegment` identity уже включает prompt-policy, engineer `instructions` только в engineer-mode, `tools`, `tool_choice`, `text` и input items; owner-mode Codex `instructions` в identity не входят;
- subagents выключены по умолчанию; живой provider traffic не запускался.

### Новый исправленный дефект — runtime-типы DelegationRequest

`DelegationRequest` — dataclass, поэтому type hints сами по себе не защищали runtime. До этого `validate_delegation_request()` мог:

- упасть обычным `AttributeError` на `task_id=None`, `parent_turn_id=7` или `objective=None`, вместо контролируемого `DelegationPolicyError`;
- принять `max_model_turns=1.5` как допустимый бюджет;
- принять `True` как `1`, потому что `bool` является подклассом `int` в Python.

Исправлено в `payload/delegation_policy.py`:

- `task_id`, `parent_turn_id`, `objective` обязаны быть строками до вызова `.strip()`;
- target обязан быть строкой и одним из `notion|qwen`;
- `max_model_turns` обязан быть настоящим `int`, но не `bool`, и лежать в диапазоне `1..24`;
- после проверки сохраняется прежняя канонизация identity/objective и независимость child от parent affinity.

Добавлены регрессии в `tests/test_delegation_policy.py` на неверные runtime-типы и ложные числовые бюджеты. Локальный exact тестовый набор: `10/10 PASS`. Локальные Git blob SHA совпали с записанными в PR: `delegation_policy.py=cc50fc7373578262e6051e76716563a98f8f4935`, `test_delegation_policy.py=8b32bf59d6f188ae950d5fc4b1365840cbb94981`.

Коммиты:
- `c3ca6c84183fe2f603c82b48b7060cf3899829fa` — runtime validation;
- `e12ab315cb365650f56dc1e48551f04e55e5276c` — регрессии.

Hosted CI/GitHub Actions/CircleCI/Cloudflare/production не использовались.

### Найденный следующий риск для аудита после server wiring

Обычный Responses-путь снимает `avoided_reserved_accounts` один раз до `account_pool.lease()`. `AccountLease` затем копирует этот set, а внутренний `_switch_account()` использует ту же замороженную копию. Поэтому reservation, появившаяся уже после первоначального снимка, теоретически может быть не замечена при внутреннем failover обычного Responses-запроса. Делегированный путь уже защищён от аналогичной гонки динамической перепроверкой. Этот пункт пока не исправлялся: сначала нужно закрыть пять известных exact-server изменений и локальный полный PASS.

### Постоянная память v4

В начале запуска `LATEST.json` прочитан с exact parent blob `92ecb7aba999cab3e720c0ce5d942b17dd519724` и указывал на `20260820T193511Z-6967dc082e` (`archive_sha256=2dc30d948a7649db8cef8b333ae2261b4180c5dbd80faa3642417199c0e10c0d`). Capsule восстановлена штатным `capsule_runtime_v4.py` и прошла verify/restore.

После работы создана capsule `20260820T200941Z-e690b2dc3f`, source ref `Ai-b0ss/notion-agent-bridge@e12ab315cb365650f56dc1e48551f04e55e5276c`, archive SHA-256 `fe94dfced8f16d3956b2354f9c5e4a917cbffed6ba4a2ffb65aaab8fb3c35fad`.

- локальные `pack -> verify -> restore`: PASS;
- immutable part и manifest загружены и перечитаны обратно;
- remote Git blob SHA совпали с локальными bytes: `part=856593f4e16bc805b3501aa20f888bf3b0fc889b`, `manifest=310bae2b8f82f1228711f87614b1046414064eb4`;
- перед CAS `LATEST` был перечитан и остался на исходном blob `92ecb7...`;
- старый LATEST сохранён в PREVIOUS;
- новый LATEST опубликован CAS-обновлением, content blob `305378c5db7fa6450027e8bdf5b7568168807588`.

### Следующий шаг

1. Lossless-материализовать exact `payload/server.py` blob `f02cef...` в новый writable локальный каталог и обязательно пересчитать Git blob SHA до любых преобразований.
2. Применить текущий `apply_startup_status_cleanup.py`; он обязан увидеть exact `f02cef...` и все пять preimage-фрагментов ровно по одному разу.
3. Локально прогнать `test_startup_status_cleanup.py`, `test_server_subagent_wiring_materializer.py`, `test_server_subagent_lifecycle_drain.py`, prompt-mode/identity, foreground routing, delegation, delegated tool-loop, failover и lifecycle tests.
4. Только после lossless PASS заменить `payload/server.py`; exact diff должен содержать только пять подготовленных узких изменений без постороннего удаления/переформатирования.
5. Затем отдельно проверить гонку обычного Responses failover против reservation, появившейся после первого snapshot; исправлять только при воспроизводимом тесте.
6. После крепкого локального PASS — один bounded живой Codex project run; затем two-slot run; затем A→B failover с новым Notion thread и без повторения уже выполненного локального side effect.
7. После этого — Qwen adapter под тот же `DelegationDispatcher`, без смешивания Notion account/thread state.
