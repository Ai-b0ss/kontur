# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-22 20:xx UTC.

## Текущая линия
- Repo: `Ai-b0ss/notion-agent-bridge`
- Branch: `autonomy/notion-prompt-modes-20260819`
- Draft PR: #8
- Текущий Agent head: `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`
- Core/NCM28 PR #7 без отдельной стыковой необходимости не менять.

## Обязательный tombstone-блокер — ИСПРАВЛЕН, но полный Agent gate ещё впереди
Helper regression: `tests/test_subagent_tombstone_post_replace_sync_failure.py`, исходный helper commit `78e0642002af6e8eafa6a7fcafe5dae134a99ae2`.

Контрпример был реальным: mutating local tool уже выполнен; `resolve_call()` записывает marker-cleared canonical через `os.replace`; затем parent-directory `fsync` падает. Старый процесс становился uncertain, но новый процесс мог увидеть уже marker-cleared canonical и повторить side effect.

Исправление в `payload/subagent_tombstone_store.py`:
- до canonical replace создаётся отдельный durable `<state>.pending` guard;
- guard создаётся `O_CREAT|O_EXCL`, с `O_NOFOLLOW` где доступно, и fsync'ится;
- guard считается опубликованным только после parent sync;
- после `os.replace` canonical обязан пройти parent durability barrier;
- guard удаляется только после этого barrier;
- любой guard при новом запуске означает fail-closed `state_uncertain`, canonical тогда не доверяется;
- symlink/junction/non-regular/multi-link guard закрывается отказом;
- если сам `os.replace` не вернулся и старый canonical точно остаётся единственной принятой генерацией, guard пытается удалиться durably, чтобы не ломать старый restart-контракт; если cleanup guard не доказан, состояние остаётся fail-closed.

Коммиты этого прохода:
- `a22c1ff43c6e997a863a7cd9e022243341388566` — первый durable guard;
- `678696f2590e76e7d7ff48d7325df05e53698e0b` — mandatory post-replace regressions;
- `97bcec500757afcc412cb4fb0d866acdd58b1478` — сохранение безопасного pre-replace recovery semantics;
- `f588e9706e69ab84965099190323bbfbde6bd557` — stale/symlink/hardlink guard restart tests;
- `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9` — cancellation lifecycle assertions приведены к общему контракту `uncertain side-effect outcome`; функциональные no-replay assertions не ослаблены.

Локальные доказательства на hosted ChatGPT:
- exact tombstone + mandatory regression + guard path cluster: `16/16 PASS`;
- focused server restart/tombstone integration: `2/2 PASS`;
- delegated cancellation lifecycle после устранения только устаревшего текстового ожидания: `4/4 PASS`.
Новый обязательный regression не ослаблялся.

## Постоянная память
Старт этого прохода:
- `LATEST` blob `ec8b1a8b482d3c7387a91e1486a69e82880e0a38`;
- capsule `20260822T190129Z-7bd99853c6`;
- archive SHA-256 `32ba5e29fe729df458d3e059b1ece31526c95ba810d11ac95007246349607744`.

Обе части fresh-read и сверены с manifest. Exact `capsule_runtime_v4.py` имеет Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`; нормативные `verify` и `restore` дали PASS.

После существенной работы опубликована immutable capsule:
- id `20260822T201227Z-774feb098e`;
- archive SHA-256 `68d91205d3cc2f273f20b030f35578b7bd5c0d98ef26e4458c6bff4687e49f91`;
- parts Git blobs после readback: `95a2a447cc9dc5a6a11942845b130d5205dc2d95`, `45a2bc2663cce62d9354607c77b672dd82eec06b`;
- manifest Git blob после readback: `5558a0c7233bdccaa238fec54e93fd6b7decf5a8`.

Перед CAS старый `LATEST` повторно перечитан и остался на исходном blob `ec8b1a8b...`. Старый LATEST сохранён как PREVIOUS; новый LATEST опубликован CAS-обновлением и имеет blob `364e8160ab685086b446a3d292e77a579e2d4379`.

## Exact materialization — главный следующий продуктовый рубеж
Frozen preimages пока не менялись:
- `payload/server.py` blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/account_pool.py` blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

Обычный `/v1/responses` пока НЕ считать materialized. Канонический путь: `tools/materialize_agent_wiring_with_tombstones.py`.
Fresh-read tombstone wiring добавляет только `tombstone_path` в `ServerSubagentLifecycle` и не меняет новый durable-store protocol, но composed pair behavior ещё нужно доказать на exact больших preimages.

## CircleCI evidence
Старый disposable gate `f53591a6876c4984fb34701b2098465482b013b7` создан ДО нового tombstone regression/fix и больше не является финальным доказательством. Не повторять его.
Новый `ci/notion-agent-final-gate` разрешён только после stable Agent SHA + exact local cluster + `--check` + pair apply/readback/compile + повторный local cluster. Недоступный result не считать PASS.

## Следующий точный шаг
1. Fresh-read PR #8 head и не писать поверх нового параллельного head.
2. Допрогнать exact локальный Agent cluster вокруг tombstone/restart/cancellation/tool-loop/lifecycle; никаких live provider calls.
3. Получить exact frozen `server.py` и `account_pool.py`, выполнить `tools/materialize_agent_wiring_with_tombstones.py --check`.
4. При полном local PASS — pair-apply, readback, compile и повторный объединённый prompt/routing/reservation/failover/delegation/tool-loop/lifecycle cluster.
5. Только затем один новый disposable CircleCI final gate на релевантно изменённых байтах.
6. Live Notion/Codex, production и secrets не трогать до этих safety gates.
7. После Agent green синхронизироваться с fresh Core и пройти composed/native-Windows acceptance, не переписывая NCM28 Core без стыковой необходимости.

## Не переоткрывать без нового evidence
- engineer/owner isolation основного Responses-пути;
- foreground reservations и sticky account/thread affinity;
- fresh-thread/full-history continuation failover;
- DynamicReservationLeaseSession transport provenance;
- bounded delegated tool-loop;
- server lifecycle/rebind/drain;
- materializer journal/backup/recovery race hardening.
