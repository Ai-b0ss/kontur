# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-22.

## Текущая линия
- Repo: `Ai-b0ss/notion-agent-bridge`
- Branch: `autonomy/notion-prompt-modes-20260819`
- Draft PR: #8
- Текущий Agent head: `eaa7e812cb502649fb5291143070b33bfc94380e`
- Core/NCM28 PR #7 `candidate/ncm28-windows-fixed-v1` без отдельной стыковой необходимости не менять.

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

## Новый продуктовый фикс этого прохода — descriptor-bound tombstone read
Найден реальный TOCTOU-разрыв в `payload/subagent_tombstone_store.py`: `_assert_existing_path_safe()` проверял канонический файл состояния, но затем `_load_or_initialize()` снова читал его по имени через `Path.read_text()`. Между проверкой и чтением путь можно было заменить symlink/другим inode и заставить no-replay state загрузить уже не те байты.

Исправление:
- `4d018c0dc80f3cf840b3aa8a070d73496e556160` — чтение состояния теперь привязано к реально открытому descriptor: `O_NOFOLLOW`, где доступно; `fstat`; regular-file/single-link check; совпадение `st_dev/st_ino` с canonical path до и после чтения; invalid UTF-8 закрывается как uncertain state.
- `eaa7e812cb502649fb5291143070b33bfc94380e` — регрессия `test_state_path_swap_after_preflight_is_rejected_without_following_target`: после успешного preflight путь подменяется symlink непосредственно перед `os.open`; store обязан закрыться как uncertain и не доверять внешнему файлу.

Сфокусированная локальная семантическая проверка на ChatGPT hosted машине: **PASS** для обычного descriptor-bound read и late symlink swap. Это не заменяет полный exact-tree Agent cluster.

## Exact materializer/recovery — актуальный блок
Канонический путь: `tools/materialize_agent_wiring_with_tombstones.py` поверх `tools/materialize_agent_wiring.py`.

Уже закрыто:
- recovery выполняется ДО exact-source transform, поэтому crash-состояние `new/old` не блокирует собственное восстановление старым blob guard;
- `--check` read-only и при незавершённой транзакции закрывается отказом;
- journal/backups проверяются как локальные обычные приватные single-link файлы;
- финальная очистка повторно сверяет journal и оба product-файла, сохраняя recovery evidence при конкурентной записи;
- поздний journal между initial preflight и implicit recovery повторно проверяется;
- `_recover_before_materialize()` повторно проверяет journal непосредственно перед base recovery;
- recovery backup читается descriptor-bound и rollback выполняется из отдельного приватного snapshot, поэтому late symlink/hardlink swap backup-path не подсовывает непроверенные bytes.

## Materialization — главный незакрытый продуктовый рубеж
Fresh read на старте и после текущих Agent-коммитов подтвердил frozen preimages:
- `payload/server.py` Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/account_pool.py` Git blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

Обычный `/v1/responses` поэтому пока не считать финально переведённым на `DynamicReservationLeaseSession`.

Актуальный путь:
- `tools/apply_account_pool_dynamic_reservation.py` — `reselect_avoiding(...)`, transport-evidence fail-closed;
- `tools/apply_startup_status_cleanup.py` — exact `server.py` transform: owner-mode isolation, startup cleanup, owner-aware reservations, `LeaseTransportContext`, dynamic lease session и fresh operation после фактической смены аккаунта;
- `tools/apply_subagent_tombstone_wiring.py` — deterministic tombstone-path wiring;
- `tools/materialize_agent_wiring.py` — парная транзакция, journal/backups/recovery/race guards;
- `tools/materialize_agent_wiring_with_tombstones.py` — композиционный wrapper с recovery ДО exact transform и повторной проверкой journal на каждом base recovery boundary.

Большие product-файлы вручную не переписывать.

## Постоянная память
Стартовый `LATEST` этого прохода:
- Git blob `61476d3576d1e21620561065539a75bfc8be57e9`;
- capsule `20260822T115721Z-b86fdeba34`;
- archive SHA-256 `3ecf3be2cb2cc1811eb1fcba0db20f2f80e20bc303c71f2751ef25c23d6586a5`;
- manifest ожидает 2 части: 2048 и 792 символа.

Части и manifest были fresh-read через GitHub connector, но текущая среда не предоставляет byte-exact мост из connector response в hosted filesystem/runtime. Нормативный `capsule_runtime_v4.py restore` поэтому в этом проходе не подменялся ручным восстановлением. Новый `LATEST/PREVIOUS` не публиковались и исходный pointer не менялся. Это ограничение transport/tool surface, а не доказательство повреждения capsule. По protocol v2 exact GitHub source остаётся recovery floor, поэтому продуктовая работа продолжена.

## CircleCI final evidence
Политика: `autonomy/ci/CIRCLECI_GATE_POLICY.md`.
Использовать только disposable ref `ci/notion-agent-final-gate`, не обычную PR #8 ветку.
Gate должен дать два доказательства на одном exact Agent SHA:
1. exact Linux Agent safety cluster;
2. отдельный materialized `server.py + account_pool.py` rehearsal.

В этом проходе CircleCI НЕ запускался: полного exact-tree локального cluster/materializer preflight на `eaa7e812...` ещё нет. Старые зелёные Agent runs не являются доказательством текущего head.

## Что НЕ заявлено
- Полный exact-tree Agent cluster на `eaa7e812cb502649fb5291143070b33bfc94380e` ещё не прогнан.
- Native Windows durability нового tombstone store не доказана Linux/POSIX проверками.
- Ordinary `/v1/responses` не считать materialized до exact pair apply/readback.
- Живой Codex/Notion acceptance на текущем head не выполнялся.
- Production, секреты и live provider state не менялись.

## Следующий точный шаг
1. Снова попытаться нормативно восстановить v4 `LATEST/PREVIOUS`; при невозможности byte-exact bridge не реконструировать bytes, использовать exact GitHub source recovery floor.
2. Получить exact tree локально без реконструкции неизвестных байтов.
3. Прогнать полный локальный Agent cluster: prompt/routing/reservations/delegation/tool-loop/lifecycle/no-replay/materializer regressions, включая новый tombstone late-swap test и backup-snapshot TOCTOU test.
4. `python tools/materialize_agent_wiring_with_tombstones.py --check` на exact blobs `11cea792... + f02cef6a...`.
5. Если green — применить парную транзакцию, перечитать оба product blobs/diff/compile и повторить combined tests уже на materialized source.
6. Отдельно доказать: `A transport fail → B late-reserved → 0 provider calls through B → C fresh recovery → old thread не переносится → transport evidence closes on C → completed local side effect не повторяется`.
7. Только после крепкого локального PASS — один bounded CircleCI final gate на `ci/notion-agent-final-gate`; сохранить exact gate SHA/result/artifacts здесь. Не повторять green gate без релевантного изменения байтов.
8. После зелёного exact materialization/restart/no-replay cluster прекратить косметический аудит и перейти к bounded authorized Codex/Notion acceptance, затем синхронизировать Agent на свежий Core без поломки NCM28/Windows line.
