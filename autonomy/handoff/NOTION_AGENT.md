# Notion — ротация / агентность / делегирование — финишный handoff

Обновлено Agent-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/notion-agent-bridge`
Branch: `autonomy/notion-prompt-modes-20260819`
Draft PR: #8
Текущий Agent head: `093e4865b1db8519b3537471b57a5379477e78dc`.
Core/NCM28 PR #7 `candidate/ncm28-windows-fixed-v1` без отдельной Core-необходимости не менять.

На каждом запуске сначала восстановить собственный v4 `LATEST/PREVIOUS` по нормативному протоколу, затем перечитать fresh PR head/blobs. Не force-write product/control state и не реконструировать неизвестные bytes.

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

## Exact materializer/recovery — актуальный закрытый блок
Канонический путь: `tools/materialize_agent_wiring_with_tombstones.py` поверх `tools/materialize_agent_wiring.py`.

Ранее уже закрыто:
- recovery выполняется ДО exact-source transform, поэтому crash-состояние `new/old` не блокирует собственное восстановление старым blob guard;
- `--check` остаётся read-only и при незавершённой транзакции закрывается отказом;
- journal/backups проверяются как локальные обычные приватные single-link файлы;
- финальная очистка повторно сверяет journal и оба product-файла, сохраняя recovery evidence при конкурентной записи;
- поздний journal, появившийся между initial preflight и implicit recovery внутри `commit_pair()`, повторно проверяется;
- `_recover_before_materialize()` повторно проверяет journal непосредственно перед base recovery и не допускает late symlink/hardlink/junction/weakened-permission подмену.

### Новый дефект и исправление 2026-08-22 — backup read/restore TOCTOU
Найден следующий реальный TOCTOU-разрыв в базовом recovery. `_validated_backup_path(...)` проверял recovery backup, но затем код снова обращался к нему по имени через `read_bytes()` и позже `os.replace(...)`. Между проверкой и чтением/переносом путь можно было заменить на другой inode, symlink или hardlink и заставить recovery использовать уже не те байты, которые были проверены.

Исправление:
- `c849fdbf5de378598a087b3e8e4ffeb7be08d0de` — `tools/materialize_agent_wiring.py` теперь открывает backup через descriptor (`O_NOFOLLOW`, где доступно), проверяет regular-file/single-link и совпадение `st_dev/st_ino` с путём до и после чтения; rollback выполняется из проверенного snapshot в новый приватный fsync'd temp inode, а не переносом исходного backup-path;
- `093e4865b1db8519b3537471b57a5379477e78dc` — `tests/test_materialize_agent_wiring_backup_snapshot.py`: normal private backup, late symlink swap и late hardlink swap после первоначальной path validation.

Сфокусированная локальная семантическая проверка новой границы: **PASS 3/3** — обычный snapshot читается, поздний symlink и hardlink закрываются отказом. Это НЕ полный exact-tree Agent cluster и не основание запускать CircleCI final gate.

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
Fresh read после текущих Agent-коммитов подтвердил, что frozen product preimages всё ещё НЕ заменены:
- `payload/server.py` Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/account_pool.py` Git blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

Обычный `/v1/responses` поэтому пока не считать финально переведённым на `DynamicReservationLeaseSession`.

Актуальный путь:
- `tools/apply_account_pool_dynamic_reservation.py` — `reselect_avoiding(...)`, transport-evidence fail-closed;
- `tools/apply_startup_status_cleanup.py` — exact `server.py` transform: owner-mode isolation, startup cleanup, owner-aware reservations, `LeaseTransportContext`, dynamic lease session и fresh operation после фактической смены аккаунта;
- `tools/apply_subagent_tombstone_wiring.py` — deterministic tombstone-path wiring;
- `tools/materialize_agent_wiring.py` — парная транзакция, journal/backups/recovery/race guards, теперь также descriptor-bound backup snapshot recovery;
- `tools/materialize_agent_wiring_with_tombstones.py` — композиционный wrapper с recovery ДО exact transform и повторной проверкой journal на каждом base recovery boundary.

Большие product-файлы вручную не переписывать.

## Постоянная память
На старте этого прохода свежий `LATEST`:
- Git blob `61476d3576d1e21620561065539a75bfc8be57e9`;
- capsule `20260822T115721Z-b86fdeba34`;
- archive SHA-256 `3ecf3be2cb2cc1811eb1fcba0db20f2f80e20bc303c71f2751ef25c23d6586a5`.

`PREVIOUS`:
- Git blob `3e9df623570ce10d045b4282f5cf72a3f2ba6b69`;
- capsule `20260822T110022Z-cbfca25e9d`;
- archive SHA-256 `95e62a4a88f9b2ff284edf554de6f55bfe3d7eb57e16bb9589ad89fc4073fa31`.

В текущем tool surface не удалось завершить нормативную byte-exact передачу GitHub connector → hosted Python для частей ни `LATEST`, ни `PREVIOUS`: ручное копирование/декодирование давало несовпадение с manifest. По protocol v2 неизвестные bytes НЕ реконструировались, новый `LATEST` не публиковался и оба указателя оставлены нетронутыми. Это не доказательство повреждения capsule: это ограничение текущей передачи байтов. Следующий запуск обязан снова попытаться штатный v4 restore; при фактически невалидном `LATEST` — `PREVIOUS`; при невозможности обоих exact GitHub source остаётся recovery floor.

## CircleCI final evidence
Политика: `autonomy/ci/CIRCLECI_GATE_POLICY.md`.
Использовать только disposable ref `ci/notion-agent-final-gate`, не обычную PR #8 ветку.
Gate должен дать два независимых доказательства на одном exact Agent SHA:
1. exact Linux Agent safety cluster;
2. отдельный materialized `server.py + account_pool.py` rehearsal.

В этом проходе CircleCI НЕ запускался: полного exact-tree локального cluster/materializer preflight ещё нет. Старые зелёные Agent runs не являются доказательством текущего head.

## Что НЕ заявлено
- Полный exact-tree Agent cluster на `093e4865b1db8519b3537471b57a5379477e78dc` ещё не прогнан.
- Native Windows durability нового store не доказана Linux/POSIX проверками.
- Ordinary `/v1/responses` не считать materialized до exact pair apply/readback.
- Живой Codex/Notion acceptance на текущем head не выполнялся.
- Production, секреты и live provider state не менялись.

## Следующий точный шаг
1. Нормативно восстановить v4 `LATEST/PREVIOUS`, затем fresh-read PR #8 head и оба product blobs; при чужих новых изменениях не перетирать их.
2. Получить exact tree локально без реконструкции неизвестных байтов.
3. Прогнать полный локальный Agent cluster, включая prompt/routing/reservations/delegation/tool-loop/lifecycle/no-replay и materializer recovery regressions, в том числе новый backup-snapshot TOCTOU test.
4. `python tools/materialize_agent_wiring_with_tombstones.py --check` на exact blobs `11cea792... + f02cef6a...`.
5. Если green — применить парную транзакцию, перечитать оба product blobs/diff/compile и повторить combined tests уже на materialized source.
6. Отдельно доказать: `A transport fail → B late-reserved → 0 provider calls through B → C fresh recovery → old thread не переносится → transport evidence closes on C → completed local side effect не повторяется`.
7. Только после крепкого локального PASS — один bounded CircleCI final gate на `ci/notion-agent-final-gate`; сохранить exact gate SHA/result/artifacts здесь. Не повторять green gate без релевантного изменения байтов.
8. После зелёного exact materialization/restart/no-replay cluster прекратить косметический аудит и перейти к bounded authorized Codex/Notion acceptance, затем синхронизировать Agent на свежий Core без поломки NCM28/Windows line.
