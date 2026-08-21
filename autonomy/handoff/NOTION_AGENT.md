# Notion — ротация, агентность, prompt-mode и делегирование

## 2026-08-21 00:xx UTC — ordinary Responses wiring подготовлен без потери transport provenance

Notion Core: `candidate/ncm28-windows-fixed-v1`, head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`. Core/NCM28 без отдельной необходимости не менять.

Рабочая ветка агентности: `autonomy/notion-prompt-modes-20260819`, draft PR #8.

### Постоянная память предыдущего запуска

Капсула `20260820T231109Z-95c1c452e1`, archive SHA-256 `e8517462e9b041be4a9164d80cf497170137b6dabd51af87a512d67da3c6c0b0`. В текущем запуске она повторно восстановлена нормативным `capsule_runtime_v4.py`: `verify=PASS`, `restore=PASS`; обе части и manifest были прочитаны отдельно, а стартовый Git blob `LATEST.json` — `a3aea2089c11699d1305dbe032e79ae106c75044`.

### Что сделано в продуктовой ветке ранее

#### 1. Динамический reservation helper сохраняет lease-level metadata

`payload/reservation_aware_lease.py` принимает `lease_kwargs` и переносит их через каждый внешний reselect. Это нужно ordinary Responses, потому что `LeaseTransportContext` нельзя терять при включении динамической защиты: иначе безопасная ротация молча отключила бы transport evidence.

Защищённые routing-параметры (`preferred_account_id`, `wait_for_preferred_if_busy`, `avoid_account_ids`) нельзя подменить через `lease_kwargs`.

Коммиты:
- `680457a197910ae47b25931b36b4db069a546d79` — lease metadata;
- `5761d57a01cbcba0f7e5aa9285456daf6480581c` — регрессии metadata/reselection.

#### 2. Добавлен `DynamicReservationLeaseSession`

Одноразового helper-а оказалось недостаточно для реального `handle_openai_responses()`: после первой успешной модельной реплики сервер может сделать 1–3 correction rounds через тот же lease. Если поздняя reservation или transport fail возникает на correction round, нельзя заново проигрывать уже успешную первую модельную реплику.

`DynamicReservationLeaseSession` живёт на протяжении всего серверного lease-scope:
- `run_selected(...)` для первого раунда заново решает continuation/fresh после внешнего A→B reselect;
- обычный `run(...)` для correction rounds не переигрывает уже завершённые раунды;
- transport retry остаётся recovery/fresh path после дополнительных reservation-reselect;
- `session.account_id` всегда отражает фактический текущий слот для последующей affinity/reservation записи.

Коммиты:
- `5e73106628487dd109aaa576236feba94ec73cf1` — session;
- `0baee81c29927b5673729443fac56d3af3c4b9de` — multi-round tests;
- `c1f18054f47e24b32125e965f10a4ca9a6c2f8c2` — исправленный точный тайминг late-reservation regression.

Локально внутри ChatGPT воспроизведено: первый раунд на A выполняется ровно один раз; correction на A падает transport; B становится reserved до provider call; recovery идёт на C; первый раунд не повторяется.

#### 3. Дыра transport evidence при A→B(reserved)→C закрывается in-lease reselection

При внутреннем transport fail `AccountLease` хранит pending transport evidence до успешного recovery. Если helper просто закрывает lease после того, как replacement B оказался reserved, pending evidence теряется вместе со старым lease.

Поэтому session предпочитает in-lease hook `reselect_avoiding(...)`: reserved replacement освобождается как routing correction, без failure/cooldown accounting, а тот же `AccountLease` продолжает recovery на C и закрывает исходный pending transport event успехом C.

`payload/reservation_aware_lease.py` уже умеет этот fast path и имеет консервативный fallback для старых/fake leases.

Коммиты:
- `fc8a82a3074cb68a6e5aef80d26c94ce89f3edb0` — in-lease reselect support;
- `876de349d82e23f1a3740f15d196c0c8142859e5` — контракт: один outer lease, A transport, B получает 0 provider calls, C recovery, pending marker закрывается только на C.

Для настоящего `AccountLease` подготовлен fail-closed materializer `tools/apply_account_pool_dynamic_reservation.py`, exact source blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

#### 4. Exact ordinary `/v1/responses` wiring подготовлен в server materializer

Настоящий `payload/server.py` всё ещё имеет exact Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`; большой файл напрямую не перезаписывался.

`tools/apply_startup_status_cleanup.py` одним fail-closed преобразованием exact blob готовит:
- импорт `DynamicReservationLeaseSession`;
- owner-aware snapshot `active_account_ids(owner_turn_key=...)`;
- startup/owner-mode/metric/reservation-policy исправления;
- multi-account route с owner turn exemption;
- замену direct `account_pool.lease(...)` на `DynamicReservationLeaseSession(...)`;
- перенос точного `LeaseTransportContext` через `lease_kwargs`;
- `run_selected(...)` для первого Responses round, чтобы replacement account никогда не получил чужой Notion thread;
- последующие correction `lease.run(...)` остаются внутри той же logical session.

Коммиты:
- `6ab53a33751e84f2b51ab32eea9cf037e46e4540` — exact server wiring materializer;
- `ac6c7c4585c80966fe4638b659f25ceff100769b` — fail-closed materializer contract.

## 2026-08-21 00:02 UTC — найден и закрыт ещё один provenance gap при неудачном reselect

Fresh PR #8 после работы: head `20e754321d9d0d0c83c13490a040f03b9fc62fb5`.

При ревью exact `AccountLease` обнаружен отдельный случай: после A transport fail session может попасть на B, увидеть позднюю foreground reservation и вызвать `reselect_avoiding(...)`. Если после освобождения B безопасный C уже недоступен либо ожидание нового слота отменено, старый вариант оставлял `_pending_transport_failure` без recovery outcome: provider failure A был записан, но финальное состояние восстановления не фиксировалось.

Materializer усилен:
- при исчерпании безопасных слотов pending transport event закрывается `final_success=False, retry_scheduled=False`;
- то же делается при любом `BaseException` во время `_acquire(...)`, включая отмену ожидания;
- reserved B по-прежнему не получает `_record_failure` и cooldown, потому что это routing correction, а не ошибка провайдера;
- при успешном B→C reselect pending evidence не закрывается преждевременно и остаётся до настоящего результата C.

Коммиты текущего запуска:
- `9413e528dbacc86ad8ae35a392b21bc5e41b6bf0` — fail-closed завершение transport evidence при сорванном reservation reselect;
- `20e754321d9d0d0c83c13490a040f03b9fc62fb5` — расширенный materializer contract.

### Что ещё НЕ считать закрытым

- Реальный `payload/server.py` blob `f02cef...` пока не заменён материализованной версией.
- Реальный `payload/account_pool.py` blob `11cea...` пока не заменён материализованной версией.
- Следовательно ordinary пользовательский `/v1/responses` ещё работает на старом frozen reservation snapshot; dynamic session подготовлен, но не активен в реальном server source.
- Новый abort-path пока подтверждён fail-closed materializer contract, но ещё должен пройти вместе с материализованным exact `account_pool.py` и локальным исполняемым сценарием.
- Hosted CI не запускался; live Notion/Codex/provider traffic не использовался; production не трогался.

### Следующий точный шаг

1. Lossless получить exact `payload/account_pool.py` blob `11cea...`, применить свежий `apply_account_pool_dynamic_reservation.py`, проверить blob preimage, compile и минимальный diff.
2. Lossless получить exact `payload/server.py` blob `f02cef...`, применить `apply_startup_status_cleanup.py`, проверить все девять preimage ровно по одному разу, compile и минимальный diff.
3. Локально прогнать вместе: reservation/session/materializer, prompt-mode, foreground routing, cooldown/failover, delegation/tool-loop/lifecycle.
4. Обязательные сценарии: (а) A continuation → transport fail → B поздно reserved → B 0 provider calls → C fresh/recovery → старый thread A не переносится → transport evidence A закрывается на C → local tool не повторяется; (б) тот же путь, но C недоступен/ожидание отменено → pending transport evidence закрывается неуспешным recovery outcome, B не считается failed.
5. Только после локального PASS записать материализованные `account_pool.py` и `server.py` в продуктовую ветку и повторно сверить Git blob/diff.
6. Затем один bounded live Codex project run; потом two-slot run; потом реальный A→B/C failover. Никаких повторных side effects.
7. После крепкого Notion ядра — Qwen adapter под тот же `DelegationDispatcher`, без смешивания Notion account/thread state.
