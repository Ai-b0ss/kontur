# Notion — ротация / агентность / делегирование — финишный handoff

Обновлено Agent-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/notion-agent-bridge`
Branch: `autonomy/notion-prompt-modes-20260819`
Draft PR: #8
Текущий Agent head: `60ea23501cda46a6244311174b1db4e27f596c2c` (324 commits на момент фиксации).
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
- cancellation during started local tool становится uncertain, safe pre-side-effect cancellation остаётся retryable;
- durable two-phase no-replay store для mutating local tools поверх rebind/restart;
- path-alias hardening durable tombstone store на POSIX/Linux;
- canonical child launch boundary: lifecycle валидирует и канонизирует identity до tombstone/pool/provider state.

## Новый закрытый блок: recovery до exact materialization
Коммиты Agent-ветки:
- `b6264cddc0168570069e9b96d265ec35df405b7a` — исправлен `tools/materialize_agent_wiring_with_tombstones.py`;
- `60ea23501cda46a6244311174b1db4e27f596c2c` — добавлены регрессии `tests/test_materialize_agent_wiring_entry_recovery.py`.

Найденный дефект: канонический wrapper сначала вызывал exact-source transform и только потом попадал в `commit_pair()`, где жил recovery. После аварии между заменой `account_pool.py` и `server.py` checkout становился `new/old`; exact old-blob guard первого transform падал раньше, чем recovery вообще мог выполниться. То есть заявленная crash-recovery ветка была недостижима из реального CLI.

Теперь:
1. до чтения/transform wrapper проверяет наличие канонического transaction journal;
2. обычный apply сначала вызывает базовый `recover_interrupted_commit(...)` под тем же guard финализации;
3. смешанная пара `new/old` сначала возвращается к exact `old/old`, после чего применяется обычная exact materialization;
4. если восстановлена уже полностью закоммиченная `new/new` пара, wrapper валидирует cross-file contract + tombstone wiring + compile и завершает работу без второго transform;
5. `--check` остаётся строго read-only: при незавершённой транзакции выдаёт `AGENT_WIRING_INTERRUPTED_TRANSACTION_PRESENT` и ничего не меняет;
6. если journal существует лексически, но базовый recovery не смог его разрешить, новый fresh transaction не начинается: `AGENT_WIRING_INTERRUPTED_TRANSACTION_UNRESOLVED`.

Локальная сфокусированная семантическая проверка этих четырёх веток: **PASS 4/4**. Это НЕ полный exact-tree Agent cluster и не основание запускать финальный Circle gate.

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
- `tools/materialize_agent_wiring_with_tombstones.py` — композиционный wrapper, теперь с recovery ДО exact transform.

Большие product файлы вручную не переписывать. Следующий проход должен уже материализовать exact-пару после полного локального Agent cluster, а не продолжать боковой аудит при отсутствии нового воспроизводимого дефекта.

## Постоянная память
Старт этого прохода восстановлен нормативным `capsule_runtime_v4.py` из:
- стартовый `LATEST` blob `0b96ad1d5f90d18acf77cfc61968e8dd3781cad1`;
- capsule `20260822T073131Z-f03f8ff412`, archive SHA-256 `a098e467a44c6f1357d0ae45b67606a890986d6b2e9fe1e13f2567b9935abe34`;
- `verify` и `restore` — PASS; unknown bytes не реконструировались.

После работы создана и нормативно локально проверена новая v4 capsule:
- `LATEST` → `20260822T080735Z-394fbafc55`;
- archive SHA-256 `a5a2458939274e7a52779c65f9758ac70cf4c6e6887e2d1b9703deafdf4ff900`;
- 2 immutable parts;
- после загрузки обе parts и manifest перечитаны из GitHub, их Git blob SHA совпали с локальными байтами;
- `LATEST` опубликован только CAS-обновлением с exact стартового blob `0b96ad1d...`; force-write не использовался;
- `PREVIOUS` теперь сохраняет предыдущий валидный `LATEST` → `20260822T073131Z-f03f8ff412`.

## CircleCI final evidence
Политика: `autonomy/ci/CIRCLECI_GATE_POLICY.md`.
Использовать только disposable ref `ci/notion-agent-final-gate`, не обычную PR #8 ветку.
Gate должен дать два независимых доказательства на одном exact Agent SHA:
1. exact Linux Agent safety cluster;
2. отдельный materialized `server.py + account_pool.py` rehearsal.

В этом проходе CircleCI НЕ запускался: полного exact-tree локального cluster/materializer preflight ещё нет. Старые зелёные Agent runs не являются доказательством текущего head.

## Что НЕ заявлено
- Полный exact-tree Agent cluster на `60ea235...` ещё не прогнан.
- Native Windows durability нового store не доказана Linux/POSIX проверками.
- Ordinary `/v1/responses` не считать materialized до exact pair apply/readback.
- Живой Codex/Notion acceptance на текущем head не выполнялся.
- Production, секреты и live provider state не менялись.

## Следующий точный шаг
1. Fresh-read PR #8 head и оба product blobs; при чужих новых изменениях не перетирать их.
2. Получить exact tree локально без реконструкции неизвестных байтов.
3. Прогнать локальный Agent cluster, включая prompt/routing/reservations/delegation/tool-loop/lifecycle/no-replay и новую entry-recovery регрессию.
4. `python tools/materialize_agent_wiring_with_tombstones.py --check` на exact blobs `11cea792... + f02cef6a...`.
5. Если green — применить парную транзакцию, перечитать оба product blobs/diff/compile и повторить combined tests уже на materialized source.
6. Отдельно доказать: `A transport fail → B late-reserved → 0 provider calls through B → C fresh recovery → old thread не переносится → transport evidence closes on C → completed local side effect не повторяется`.
7. Только после крепкого локального PASS — один bounded CircleCI final gate на `ci/notion-agent-final-gate`; сохранить exact gate SHA/result/artifacts в handoff. Не повторять green gate без релевантного изменения байтов.
8. После зелёного exact materialization/restart/no-replay cluster прекратить косметический аудит и перейти к bounded authorized Codex/Notion acceptance, затем синхронизировать Agent на свежий Core без поломки NCM28/Windows line.
