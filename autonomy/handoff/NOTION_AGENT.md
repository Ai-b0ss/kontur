# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-20 22:xx UTC — account-aware dynamic reservation runner готов; ordinary Responses wiring остаётся главным шагом

Notion Core: `candidate/ncm28-windows-fixed-v1`, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`. Core/NCM28 без отдельной необходимости не менять.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8, текущий head `37abfaa5f0b972a84736c7da669432cd2ed08075`.

### Что сейчас доказано

- настоящий `payload/server.py` по-прежнему имеет exact Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`; прямую полную замену большого файла не делали;
- `tools/apply_startup_status_cleanup.py` fail-closed по exact blob `f02cef...` и содержит пять подготовленных server-преобразований: ранний startup `BaseException` cleanup; owner-mode не запускает extractor Codex `instructions` в planner и metric/token path; stale affinity не считается владением foreground reservation; multi-account routing использует `wait_for_turn_route(..., owner_turn_key=turn_key)`;
- single-slot путь ждёт чужую foreground reservation до захвата общего inference gate; owner continuation исключает свою reservation по `turn_key`, поэтому тупика на одном слоте нет;
- lifecycle rebind/unbind cancellation-safe; старое поколение не закрывается до завершения уже начатых child-задач; status учитывает дренируемые поколения;
- delegated failover сохраняет локальную историю и результаты уже выполненных инструментов; новый provider client создаёт новый Notion thread и не получает thread другого аккаунта;
- persistent ConversationSegment identity включает prompt-policy, engineer `instructions` только в engineer-mode, `tools`, `tool_choice`, `text` и input items; owner-mode Codex `instructions` туда не входят;
- subagents выключены по умолчанию; live/provider traffic не запускался.

### Динамические foreground reservations

`payload/reservation_aware_lease.py` теперь имеет два слоя:

1. `run_with_dynamic_reservations(...)` — прежний совместимый API;
2. новый `run_with_dynamic_reservations_on_lease(...)` — account-aware API, который после каждого внешнего выбора аккаунта даёт вызывающему коду выбрать continuation/fresh operation по фактически выбранному lease и возвращает `account_id`, который реально завершил операцию.

Зачем это нужно ordinary Responses: там решение `continuation_completion` или `initial_completion` зависит от того, совпадает ли выбранный аккаунт с anchor. Простого helper-а, который возвращал только completion, для безопасной интеграции было недостаточно: после late reservation внешний reselect должен заново решить continuation/fresh по новому аккаунту, а после transport fail внутренний retry обязан остаться на fresh/recovery path.

Новый account-aware runner сохраняет все старые гарантии:

- перечитывает актуальные reservations до lease, после acquisition и непосредственно перед каждой provider-попыткой;
- replacement-аккаунт, который стал reserved после старого snapshot, получает **0 provider calls**;
- после transport failure и перехода в retry/recovery phase поздняя reservation/reselection не возвращает операцию к первоначальному запросу;
- возвращается фактический финальный `lease.account_id`, поэтому сервер сможет правильно обновить affinity/reservation после A→B/C.

Коммиты текущего запуска:
- `944aeab54e183f9f5f0b41fab116f05c0a69ab44` — account-aware dynamic runner;
- `37abfaa5f0b972a84736c7da669432cd2ed08075` — две новые регрессии account-aware continuation/reselection и internal failover/recovery.

Локально внутри ChatGPT, без hosted CI: `tests.test_reservation_aware_lease` — **5/5 PASS**. Новые проверки доказывают:
- A выбран как возможный continuation, но становится reserved до provider work → A получает 0 вызовов, B заново классифицируется как fresh и реально завершает запрос;
- A начинает continuation и падает transport; B поздно становится reserved; C получает только recovery/fresh operation; helper возвращает финальный `account_id=C`.

### Exact server.py — ещё не материализован

Пять старых подготовленных server-преобразований всё ещё не записаны прямо в `payload/server.py`. Это намеренный fail-closed стоп: доступная запись GitHub заменяет файл целиком, а source ~112 KiB. Нельзя реконструировать неизвестные bytes из памяти. Full blob читается через GitHub blob API, но перед записью всё равно нужен lossless локальный exact source с Git blob SHA `f02cef...`, затем materializer + compile + минимальный diff.

Ordinary `/v1/responses` пока всё ещё использует замороженный `avoided_reserved_accounts` и прямой `async with account_pool.lease(...)`; новую динамическую защиту **не считать подключённой к пользовательскому Responses-пути**, пока server.py не материализован.

### Постоянная память v4

В начале текущего запуска `LATEST.json` прочитан с exact Git blob `30cd6257f9ef9f90e15d09d47462abcfcc482f03`, capsule `20260820T211441Z-772c2d436c`, archive SHA-256 `23ce56531be6ca721824cd961031827b44938a900d4a2a7c54b98fbdf5bfd4da`.

Удалённые manifest + обе parts были материализованы локально; нормативный `capsule_runtime_v4.py verify` и `restore` прошли PASS. Восстановленный checkpoint подтвердил предыдущий head `a68c9296...` и следующий план.

Финальная capsule этого запуска будет опубликована по v4 только через immutable upload + readback + повторное чтение LATEST + CAS; если blob LATEST изменится с `30cd6257...`, force-write запрещён.

### Следующий шаг

1. Lossless-материализовать exact `payload/server.py` blob `f02cef...` и пересчитать Git blob SHA **до** преобразований.
2. Применить пять подготовленных fail-closed изменений `apply_startup_status_cleanup.py`; проверить каждый preimage ровно один раз, compile и минимальный diff.
3. Подключить `run_with_dynamic_reservations_on_lease(...)` к ordinary Responses lease path: operation factory выбирает continuation только если выбранный account совпадает с anchor; retry operation всегда fresh/full-history; фактический финальный account используется для affinity/reservation.
4. Локально прогнать startup + owner/engineer prompt + foreground routing + reservation A→B→C + delegation + tool-loop + lifecycle.
5. Только после локального PASS заменить реальный `server.py` и повторно сверить GitHub blob/diff.
6. Затем один bounded live Codex project run; потом two-slot run; потом A→B failover с новым Notion thread и без повторения уже выполненного локального side effect.
7. После крепкого Notion ядра — Qwen adapter под тот же `DelegationDispatcher`, без смешивания Notion account/thread state.
