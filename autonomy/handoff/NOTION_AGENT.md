# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 — late-reservation failover вынесен в общий защитный слой; exact server.py wiring остаётся главным крупным шагом

Notion Core: `candidate/ncm28-windows-fixed-v1`, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`. Core/NCM28 не менять без отдельной необходимости.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `a68c9296c517cfd8712d0baa21db43a36a13ccd8`.

### Фактическое состояние

- настоящий `payload/server.py` всё ещё имеет exact Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`; прямую полную замену огромного файла пока не делали;
- полный exact server blob читается через GitHub blob API, но доступный коннектор не даёт безопасного частичного patch; одна ранее созданная неполная blob-заготовка осталась orphan и ни в один tree/commit/ref не включена;
- `tools/apply_startup_status_cleanup.py` fail-closed по exact blob `f02cef...` и содержит пять подготовленных преобразований: ранний startup `BaseException` cleanup; owner-mode не запускает extractor Codex `instructions` в planner и metric/token path; stale affinity больше не считается владением foreground reservation; multi-account routing использует `wait_for_turn_route(..., owner_turn_key=turn_key)`;
- single-slot path уже ждёт чужую foreground reservation до захвата общего inference gate, а owner continuation исключает свою reservation по `turn_key`, поэтому тупик на одном слоте не создаётся;
- lifecycle rebind/unbind cancellation-safe; старое поколение не закрывается, пока его child ещё работает; статус учитывает child, которые дренируются на старом поколении;
- delegated failover сохраняет локальную историю и результаты уже выполненных инструментов; новый provider client создаёт новый Notion thread и не получает старый thread другого аккаунта;
- persistent `ConversationSegment` identity включает prompt-policy, engineer `instructions` только в engineer-mode, `tools`, `tool_choice`, `text` и input items; owner-mode Codex `instructions` в identity не входят;
- subagents выключены по умолчанию; живой provider traffic не запускался.

### Новый продуктовый слой — динамическая защита reservation во время failover

Подтверждён старый риск: `NotionAccountPool.lease(... avoid_account_ids=...)` и `AccountLease` используют снимок списка исключённых аккаунтов. Reservation может появиться позже — после acquisition или уже во время внутреннего A→B failover. Поэтому одна стартовая проверка не гарантирует, что replacement-аккаунт всё ещё свободен от незавершённой foreground tool-chain.

Добавлен `payload/reservation_aware_lease.py` с `run_with_dynamic_reservations(...)`:

- перечитывает актуальные reservation до lease, после acquisition и непосредственно перед каждой provider-попыткой;
- если фактически выбранный аккаунт успел стать reserved, provider call через него не выполняется: lease освобождается и выбор повторяется с этим аккаунтом в avoid-set;
- проверка действует и на replacement-аккаунт, выбранный внутренним `lease.run()` после транспортной ошибки;
- если транспортный failover уже переключил операцию на recovery/fresh-thread path, последующая reservation-reselection **не возвращает запрос к исходной операции**: `retry_phase` сохраняется между внешними re-lease. Это критично для tool-loop, иначе можно повторить уже выполненный локальный side effect;
- старые cooldown/disable решения остаются обязанностью обычного `NotionAccountPool`; новый слой только защищает динамические foreground reservations.

`NotionDelegationAdapter` переведён на этот общий слой вместо своей отдельной копии late-reservation loop. Stateful child session по-прежнему создаётся ровно один раз до lease, поэтому reselect/failover не пересоздаёт локальную историю.

Коммиты:
- `011aed65756e748882dad13731324336dc3f24dc` — общий dynamic-reservation runner;
- `7584094e6b9cd9ee0ddee46432e16e45b1959fee` — изолированные регрессии late-acquire/internal-failover/recovery-phase;
- `90a2b82ab6c5c94b4c02faeff7d94c1913281800` — `NotionDelegationAdapter` переведён на общий runner;
- `39866409a66101f009426732bdaa98addb8d7146` — старый fake lease в `test_delegation_dispatcher.py` получил реальный `account_id` и совместимый `run(... retry_operation=...)`; прежний fake не соответствовал уже существующему adapter-контракту;
- `a68c9296c517cfd8712d0baa21db43a36a13ccd8` — сквозные adapter-регрессии: late reservation не пересоздаёт stateful child session; внутренний A→B failover не использует B, если B стал reserved, и переходит на C.

Локально внутри ChatGPT без hosted CI прогнаны:
- `tests.test_reservation_aware_lease`: 3/3 PASS;
- минимальный adapter/lifecycle integration: PASS;
- расширенный dynamic adapter набор: 5/5 PASS совместно с helper tests.

Во время проектирования тест поймал реальный дефект первой версии общего runner: после `A transport fail -> B became reserved` внешний re-lease на C снова запускал исходную operation вместо recovery operation. До коммита это исправлено сохранением `retry_phase`; регрессия требует `initial_calls == [A]`, `retry_calls == [C]`.

### Runtime-типы DelegationRequest

Предыдущая защита остаётся действующей: `task_id`, `parent_turn_id`, `objective` проверяются как строки до `.strip()`, target только `notion|qwen`, `max_model_turns` — настоящий `int` (не `bool`) `1..24`. Локальный набор этой части ранее был `10/10 PASS`.

### Exact server.py — ещё не материализован

Пять подготовленных server-преобразований всё ещё не записаны прямо в `payload/server.py`. Это намеренный fail-closed стоп: `update_file` требует полный файл целиком, а source имеет ~112 KiB. Нельзя реконструировать/усекать его из памяти. Перед записью нужен lossless локальный exact blob с Git blob SHA `f02cef...`, затем применение materializer и проверка минимального diff.

Новый `reservation_aware_lease.py` уже является общим механизмом, который после direct five-change server wiring можно использовать для закрытия аналогичной гонки обычного Responses-пути. Сам ordinary Responses пока всё ещё использует замороженный `avoided_reserved_accounts`; не объявлять этот риск исправленным для обычных пользовательских запросов.

### Постоянная память v4 — старт этого запуска

В начале запуска `LATEST.json` перечитан с exact Git blob `305378c5db7fa6450027e8bdf5b7568168807588`, capsule `20260820T200941Z-e690b2dc3f`, archive SHA-256 `fe94dfced8f16d3956b2354f9c5e4a917cbffed6ba4a2ffb65aaab8fb3c35fad`.

Удалённые `manifest.json` и `part-0000.b64` прочитаны, затем capsule восстановлена штатным `capsule_runtime_v4.py`: `verify` PASS, `restore` PASS. Восстановленный checkpoint подтверждает source ref `Ai-b0ss/notion-agent-bridge@e12ab315...` и exact server blob `f02cef...`.

Финишная capsule этого запуска должна быть опубликована только после `pack v4 -> immutable upload -> reread/verify parts+manifest -> reread LATEST -> CAS`, с исходным parent blob `305378c5...`; при изменившемся LATEST force-write запрещён.

### Следующий шаг

1. Lossless-материализовать exact `payload/server.py` blob `f02cef...` в writable локальный каталог и пересчитать Git blob SHA до любых преобразований.
2. Применить текущий `apply_startup_status_cleanup.py`; все пять preimage-фрагментов должны встретиться ровно по одному разу; проверить compile и минимальный diff.
3. Локально прогнать startup + owner/engineer prompt + foreground routing + delegation + delegated tool-loop + lifecycle.
4. Только после этого заменить реальный `payload/server.py` и повторно сравнить его GitHub blob/diff.
5. Затем подключить `run_with_dynamic_reservations` (или эквивалентную доказанную семантику) к ordinary Responses lease path и отдельной регрессией воспроизвести `A fails -> B reserved after snapshot -> B gets zero provider calls -> safe C/recovery`.
6. После крепкого локального PASS — один bounded живой Codex project run; затем two-slot run; затем A→B failover с новым Notion thread и без повторения уже выполненного локального side effect.
7. После этого — Qwen adapter под тот же `DelegationDispatcher`, без смешивания Notion account/thread state.
