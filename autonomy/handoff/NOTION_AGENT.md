# Notion — ротация / агентность / делегирование — финишный handoff

Обновлено Agent-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/notion-agent-bridge`
Branch: `autonomy/notion-prompt-modes-20260819`
Draft PR: #8
Текущий Agent head: `f58f0123b370ad786d337337eb03a6a4ce9963b3` (322 commits).
Core/NCM28 PR #7 `candidate/ncm28-windows-fixed-v1` без отдельной Core-необходимости не менять.
На каждом запуске сначала восстановить собственный v4 LATEST/PREVIOUS по нормативному протоколу, затем перечитать fresh PR head/blobs. Не force-write при CAS конфликте.

## Уже закрыто — не исследовать заново
- engineer/owner prompt policy и owner isolation;
- foreground reservations и sticky account/thread affinity;
- single-slot owner re-entry / unrelated wait;
- continuation failover только через fresh replacement thread + complete local history;
- `DynamicReservationLeaseSession`: late reservation/reselection не переигрывает завершённые model rounds;
- transport provenance через A→B(reserved)→C и fail-closed abort;
- provider-neutral `DelegationRequest` / `DelegationDispatcher` без parent account/thread ids;
- stateful Notion child session не повторяет objective/completed local tools при legitimate provider failover;
- atomic tool-batch validation и bounded child model turns;
- cancellation during started local tool становится uncertain, а safe pre-side-effect cancellation остаётся retryable;
- pair commit journal/recovery, post-replace drift, exclusive journal publication и POSIX directory ordering;
- durable two-phase no-replay store для mutating local tools поверх rebind/restart;
- path-alias hardening durable tombstone store на POSIX/Linux.

## Новый закрытый блок: canonical child launch boundary
Коммиты:
- `ab5c547e0819fed041d7532526bc8948c5cd62a2` — `ServerSubagentLifecycle.launch()` теперь сначала строит и валидирует `DelegationRequest`, затем передаёт дальше уже канонический `SubagentLaunch`;
- `f58f0123b370ad786d337337eb03a6a4ce9963b3` — регрессия lifecycle/rebind обновлена под канонический identity и добавлена проверка malformed runtime `task_id`.

Контракт:
1. `task_id`, `parent_turn_id`, `objective`, target и budget валидируются ДО tombstone/pool/provider state;
2. downstream entrypoint получает уже canonical identities (`strip()` aliases не живут дальше lifecycle boundary);
3. tombstone/no-replay lookup работает по тому же canonical `task_id`;
4. runtime `task_id=None` больше не падает сырым `AttributeError`, а закрывается через `DelegationPolicyError` до provider work;
5. локальная семантическая проверка boundary: **PASS 3/3** — canonical downstream identity, malformed task id fail-closed, whitespace alias не обходит uncertain-task lookup.

## Durable no-replay — актуальное состояние
`payload/subagent_tombstone_store.py` VERSION 2:
- durable empty canonical создаётся до delegated work;
- `begin_call(task_id, call_id)` пишет inflight ДО mutating local tool;
- `resolve_call` удаляет marker только после подтверждённого success;
- crash/failed resolve оставляет inflight и restart fail-closed;
- corrupt/unreadable store блокирует subagents, обычный bridge может продолжить;
- на диске только task/call ids — без prompt/args/account/thread/output.

Mutating local tools `write_file`, `edit_file`, `run_shell`: любой outcome кроме подтверждённого `ok=true` остаётся uncertain; локальная uncertainty не считается provider failover error.

Path hardening на POSIX/Linux:
- symlink/junction final path запрещён;
- symlink/junction parent/ancestor запрещён;
- existing state должен быть обычным файлом с `st_nlink == 1`.
Native Windows semantics этим не доказаны и остаются отдельным target-OS/Core gate.

## Materialization — главный незакрытый продуктовый рубеж
Frozen product preimages всё ещё НЕ заменены:
- `payload/server.py` Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/account_pool.py` Git blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

Обычный `/v1/responses` поэтому пока не считать финально переведённым на `DynamicReservationLeaseSession`.

Актуальный путь:
- `tools/apply_account_pool_dynamic_reservation.py` — `reselect_avoiding(...)`, transport-evidence fail-closed;
- `tools/apply_startup_status_cleanup.py` — exact `server.py` transform: owner-mode isolation, startup cleanup, owner-aware reservations, `LeaseTransportContext`, dynamic lease session и fresh operation после фактической смены аккаунта;
- `tools/apply_subagent_tombstone_wiring.py` — deterministic tombstone-path wiring;
- `tools/materialize_agent_wiring.py` — парная транзакция, journal/backups/recovery/race guards;
- `tools/materialize_agent_wiring_with_tombstones.py` — композиционный wrapper поверх того же pair transaction.

Большие product файлы вручную не переписывать. Следующий проход должен уже материализовать exact-пару, а не продолжать боковой аудит при отсутствии нового воспроизводимого дефекта.

## Постоянная память
Текущий проверенный v4 `LATEST`:
- capsule `20260822T054449Z-620952bc2f`;
- archive SHA-256 `67f0ea8a9761fdc88cb105dbca8a7d12238deaf3910fb738dce40d7ce5c386bd`;
- локальные `pack → verify → restore` = PASS;
- все 5 immutable parts и manifest после загрузки перечитаны; их Git blob SHA совпали с локально рассчитанными;
- публикация `LATEST` прошла CAS с исходного blob `aa8a3537bee846da7e40fc89da30379e795cdd0f`;
- прежний LATEST `20260822T040635Z-e00776b282` сохранён в `PREVIOUS`.

Важно: первая попытка capsule `20260822T054240Z-19a641cb04` была оставлена immutable и НЕ опубликована, потому что readback `part-0002.b64` не совпал с локальным Git blob. Не использовать её как pointer target.

## Что НЕ заявлено
- Полный exact-tree Agent cluster на текущем head ещё не прогнан.
- Native Windows durability нового store не доказана Linux/POSIX проверками.
- Ordinary `/v1/responses` не считать materialized до exact pair apply/readback.
- Живой Codex/Notion acceptance на текущем head не выполнялся.

## Следующий точный шаг
1. Fresh-read PR #8 head и оба product blobs; при чужих новых изменениях не перетирать их.
2. Получить exact tree локально без реконструкции неизвестных байтов.
3. Прогнать локальный Agent cluster, включая prompt/routing/reservations/delegation/tool-loop/lifecycle/no-replay.
4. `python tools/materialize_agent_wiring_with_tombstones.py --check` на exact blobs `11cea792... + f02cef6a...`.
5. Если green — применить парную транзакцию, перечитать оба product blobs/diff/compile и повторить combined tests уже на materialized source.
6. Отдельно доказать: `A transport fail → B late-reserved → 0 provider calls through B → C fresh recovery → old thread не переносится → transport evidence closes on C → completed local side effect не повторяется`.
7. Только после крепкого локального PASS — один bounded authorized Codex/Notion project probe, затем two-slot и failover acceptance.
8. После Agent acceptance синхронизировать на свежий Core без поломки NCM28/Windows line.

## Стоп-условие
После зелёного exact materialization + restart/no-replay cluster не продолжать косметический аудит. Переходить к bounded real acceptance и Core synchronization.
