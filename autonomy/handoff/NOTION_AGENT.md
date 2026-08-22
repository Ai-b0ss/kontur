# Notion — ротация / агентность / делегирование — финишный handoff

Обновлено Agent-проходом 2026-08-22.

## Текущая линия
Repo: `Ai-b0ss/notion-agent-bridge`
Branch: `autonomy/notion-prompt-modes-20260819`
Draft PR: #8
Текущий Agent head: `04a659a23b3d72b44b334c9e35f23c1220d73eb3` (315 commits).
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
- pair commit journal/recovery, post-replace drift, exclusive journal publication и POSIX directory ordering.

## Новый закрытый блок: no-replay через rebind/restart
PR body ещё частично описывает tombstone как in-process-only — на текущей линии это устарело.

### Rebind boundary
- `af8cce3a47630738aef751e6f7106b5108d394f3` — `ServerSubagentLifecycle` держит uncertain task ids поверх pool generations;
- `f9e04412d1f92c6a592da547646a5188b7e99bb9` — uncertain child остаётся blocked после rebind; plain safe cancellation retryable.

### Durable two-phase store
Наивный `edb53e59...` считать superseded.
Актуально:
- `98644b79c1a8f1f1379cda66c0e4ed4c7d307b7a` — `payload/subagent_tombstone_store.py`, VERSION 2.
Контракт:
1. explicit durable empty canonical до delegated work;
2. `begin_call(task_id, call_id)` durably пишет inflight ДО mutating local tool;
3. `resolve_call` удаляет marker только после положительно подтверждённого success;
4. crash/failed resolve оставляет previous canonical с inflight, поэтому restart fail-closed;
5. corrupt/unreadable store блокирует subagents, не требует падения обычного bridge;
6. на диске только task/call ids — без objective/args/prompt/account/thread/output.
- `09cea03c18730451d797a66d31b515f3dd58f34a` — restart/failed-resolve/corrupt regressions.

### Mutating local tool boundary
- `d93c67129c4362cb7e40c550346db3f8511738fb` — `DelegationSideEffectUncertainError(RuntimeError)` для non-cancel unknown outcome;
- `a733fa1b075cb0bb61dfce0b6f0c5580856a22c9` — delegated loop не превращает его в retryable result;
- `810a30dc8e93318578a27d46063dfca757b8e93f` — SubagentLifecycle tombstone-ит cancellation и non-cancellation uncertainty;
- `57b09b81c92bbe6c0a8375b9a1e70103046c362d` — один shared store принадлежит server lifecycle и переживает rebind;
- `555a52a8a8f6511ae14e819b5465ddce737ec2f1` — `write_file`, `edit_file`, `run_shell`: durable begin before call; **любой outcome кроме confirmed `ok=true` остаётся uncertain**. Structured `isError=true` тоже НЕ replay-safe: write/shell мог частично изменить проект;
- `1f83611e467ef7031f09c834bca0543f69a6f90e` — актуальный durable write-guard regression;
- старый `tests/test_server_subagent_durable_tool_guard.py` удалён `f9615b7e...`, потому что ошибочно считал structured mutating error безопасным повтором;
- `5c89e2ca01a37099514cbc7c73b8922967b9008d` — local uncertain RuntimeError не является provider failover error;
- `0ca44dd6df901fa848cede6be32e61235a75dcfb` — новый lifecycle с тем же durable path после process restart блокирует старый inflight task; corrupt store блокирует до entrypoint.

### Path-alias hardening — 2026-08-22
- `78c81987721ab5d4a7b32fb62e516ca7859fe61f` — durable tombstone store теперь fail-closed проверяет непосредственного родителя и существующий canonical state перед чтением/заменой: symlink/junction parent запрещён; существующий state обязан быть обычным файлом с `st_nlink == 1`;
- `04a659a23b3d72b44b334c9e35f23c1220d73eb3` — регрессии на symlink final path, symlink parent и hardlinked canonical state;
- локальная сфокусированная семантическая проверка: normal restart state + symlink-parent rejection + hardlink rejection = PASS;
- это POSIX/Linux доказательство. Native Windows durability/path semantics этим НЕ доказаны и остаются target-OS/Core gate.

## Materialization — актуальный путь
Frozen product preimages пока не считать заменёнными:
- `payload/server.py` Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/account_pool.py` перед применением перечитать fresh (исторический exact был `11cea792...`).
Большие product файлы вручную не переписывать.

Helper обнаружил стык: основной `tools/materialize_agent_wiring.py` использует `apply_startup_status_cleanup.py`; одно изменение `apply_server_subagent_lifecycle_wiring.py` само по себе tombstone path в финальную пару не гарантировало.

Поэтому актуальный композиционный путь:
- `317eb19d9b38be67fa249a3c04b8f3d3dcc7618f` — standalone server lifecycle materializer тоже знает tombstone path;
- `8782b20d6f3c53be4a5b3e67e9bb413152e1dfec` — `tools/apply_subagent_tombstone_wiring.py`, один deterministic anchor;
- `ae6bb379bb319e4d850ef1b1e275e6902fb13371` — `tools/materialize_agent_wiring_with_tombstones.py`: вызывает существующий hardened pair materializer, затем добавляет tombstone path и для записи использует ТОТ ЖЕ `commit_pair`; crash protocol не форкнут;
- `b6302670a119d0c0426f276a3b0d760b8a5a45c3` — exact-current-preimage materialization regression: один tombstone path + DynamicReservationLeaseSession/reselect contracts + compile обоих файлов.

Stable runtime path в generated server:
`stable_conversation_state_path(ACCOUNT_HOME).with_name("subagent-uncertain-tasks.json")`.

## Постоянная память
Текущий проверенный v4 `LATEST` после этого прохода:
- capsule `20260822T020611Z-1e763e461f`;
- archive SHA-256 `922d4ce7a5adb2a9c82c7f6d8d2955af70138a445345847ffc980da9bd73612d`;
- все 10 immutable parts и manifest перечитаны после загрузки; Git blob SHA совпали с локально рассчитанными;
- canonical `capsule_runtime_v4.py verify` и `restore` = PASS;
- публикация `LATEST` прошла CAS с исходного blob `e6b40f16241607c96580df95935db900927d0f54`; старый LATEST сохранён как PREVIOUS.

## Что НЕ заявлено
- Полный exact-tree Agent cluster на текущем head ещё не прогнан.
- Native Windows durability нового store НЕ доказана Linux/POSIX fsync. Windows/NCM28 остаётся Core acceptance gate.
- Ordinary `/v1/responses` не считать финально materialized до exact pair apply/readback.
- Real server child-launch не включать до зелёного restart/no-replay cluster.

## Следующий точный шаг
1. Fresh-read PR #8 head и blobs.
2. На exact tree локально прогнать минимум:
   - `python -m unittest tests.test_subagent_tombstone_store`
   - `python -m unittest tests.test_server_subagent_uncertain_rebind`
   - `python -m unittest tests.test_server_subagent_tombstone_restart`
   - `python -m unittest tests.test_server_subagent_durable_tool_guard_v2`
   - `python -m unittest tests.test_delegated_uncertain_failover_boundary`
   - existing delegated cancellation/tool-loop/lifecycle/reservation tests
   - `python -m unittest tests.test_materialize_agent_wiring_with_tombstones`.
3. Если cluster green: `python tools/materialize_agent_wiring_with_tombstones.py --check` на exact frozen pair; прочитать generated diff/blobs/compile.
4. Только после check/readback применить wrapper без `--check`, затем снова readback exact product blobs/diff и повторить combined prompt/routing/failover/delegation tests.
5. Отдельно доказать target-OS restart с реально настроенным `tombstone_path`; Linux proof не выдавать за Windows.
6. Затем bounded authorized two-slot Codex Responses tool-loop и fresh-thread/full-history failover без повторных side effects.
7. После Agent acceptance синхронизировать на свежий Core, не ломая NCM28/Windows line.

## Стоп-условие
После зелёного exact materialization + restart no-replay cluster не продолжать бесконечный косметический аудит. Переходить к bounded real acceptance и Core synchronization.
