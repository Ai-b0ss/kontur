# Notion — ротация / агентность / делегирование — handoff

Обновлено Agent-проходом 2026-08-22 20:xx UTC.

## Текущая линия
- Repo: `Ai-b0ss/notion-agent-bridge`
- Branch: `autonomy/notion-prompt-modes-20260819`
- Draft PR: #8
- Текущий Agent head: `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`
- Core/NCM28 PR #7 без отдельной стыковой необходимости не менять.

## No-replay / tombstone — свежо доказано локально
Контроллером ранее отмеченный дефект post-replace parent-sync уже исправлен product commit `a22c1ff43c6e997a863a7cd9e022243341388566`; позднейшие tests `678696f...`, `f588e970...` и текущий `ee0ae241...` входят в fresh head.

На exact current head в этом проходе заново прогнан локальный кластер без provider traffic:
- `tests/test_subagent_tombstone_post_replace_sync_failure.py` — `6/6 PASS`;
- `tests/test_subagent_tombstone_store.py` + mandatory post-replace cluster — `16/16 PASS`;
- плюс `tests/test_delegated_cancellation_lifecycle.py` — `20/20 PASS`;
- плюс `tests/test_server_subagent_tombstone_restart.py` — итог `22/22 PASS`.

Для server restart теста provider-facing runtime подменён тестовыми объектами ровно в предусмотренных самим тестом точках; assertions требуют ноль provider/tool calls до безопасного допуска. Новый обязательный no-replay regression не ослаблялся.

Tombstone-модуль без нового серьёзного воспроизводимого контрпримера считать закрытым и не продолжать микрозакаливание: следующий приоритет — composition/materialization.

## Постоянная память v4
Старт этого прохода:
- `LATEST` blob `364e8160ab685086b446a3d292e77a579e2d4379`;
- capsule `20260822T201227Z-774feb098e`;
- archive SHA-256 `68d91205d3cc2f273f20b030f35578b7bd5c0d98ef26e4458c6bff4687e49f91`.

Обе части и manifest fresh-read; exact `capsule_runtime_v4.py` использован нормативно; `verify` и `restore` дали PASS.

Первая новая capsule `20260822T205347Z-6c62174765` после upload была отвергнута: readback Git blob `part-0000` не совпал с локальным. Указатели на неё не публиковались.

Затем создана capsule меньшими частями и полностью сверена:
- id `20260822T205544Z-b2e41b5f6e`;
- archive SHA-256 `16a874dd73b85c712883163ce74b53ff514a52156934d67365398549b734352d`;
- local `pack -> verify -> restore` — PASS;
- uploaded parts Git blobs после readback: `c565102604d82ca0f5eba42ce005ed9d1da1a55e`, `49abb8ee2fe256cee733a20b7a8a06da1c2d7acc`, `7eded8bc55abe1ae750c36d31693f5e789c4d0d6`, `f1e784e9873992d4bbbaf0b29bfe47b8f40b4a31`, `371a9895d4bc9cd200536ccf926ed9f30346f1ae` — все совпали с локально вычисленными;
- manifest Git blob `d572456144e80489c5f9b72d4b54163a7d7d18e4` — совпал с локальным.

Перед CAS `LATEST` повторно перечитан и остался на исходном blob `364e8160...`. Старый LATEST сохранён как PREVIOUS; новый LATEST опубликован только CAS-обновлением и имеет blob `90a8168349608a23f287ab6569ef108046b82f52`.

## Exact materialization — главный текущий рубеж
Frozen product preimages пока не менялись:
- `payload/server.py` blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`;
- `payload/account_pool.py` blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`.

Обычный `/v1/responses` пока НЕ считать materialized.

Fresh-read canonical tooling:
- `tools/materialize_agent_wiring_with_tombstones.py` blob `859039a5e408bc84e7046372cdb509131eb37a97`;
- `tools/apply_account_pool_dynamic_reservation.py` blob `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- `tools/apply_startup_status_cleanup.py` blob `2ed85ece7d3323b1619ec0963d3021c1623d0e0a`.

Account-pool half already independently proven locally on exact preimage:
- local source Git blob exactly `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`;
- all six exact anchors matched once;
- transformed source compiled;
- local transformed Git blob `c9ca6f3b4545e469966369a4220a6a2a60bf3697`;
- `reselect_avoiding` present exactly once; pending transport-recovery routing semantics present.

Server half is NOT yet honest-local-materialized: exact GitHub source remains `f02cef6a...`, but the manually transferred 112KB local candidate had different Git blob and therefore was rejected as evidence. Do not use that candidate, do not fake `--check`, do not reconstruct unknown bytes by memory. Need a lossless exact local byte transfer of `payload/server.py` first.

Fresh server helper proves intended minimal composition once exact bytes are available: repeated-cancellation-safe startup cleanup, owner mode never inspects dormant Codex `instructions`, metrics obey the same isolation, foreground reservation owner exemption by `turn_key`, `DynamicReservationLeaseSession`, transport context, and continuation/fresh choice after actual account selection so old Notion thread never crosses slots.

## CircleCI
Старый disposable Agent gate `f53591a6876c4984fb34701b2098465482b013b7` создан до актуальных no-replay bytes и не является финальным доказательством. Не повторять его.

Новый `ci/notion-agent-final-gate` допустим только после:
1. exact local server/account pair;
2. `materialize_agent_wiring_with_tombstones.py --check`;
3. pair apply + readback + compile;
4. объединённого локального prompt/routing/reservation/failover/delegation/tool-loop/lifecycle/tombstone PASS на стабильном SHA.
Linux gate не заменяет последующий Core native-Windows proof.

## Следующий точный шаг
1. Fresh-read PR #8 head; при новом параллельном head не писать поверх него.
2. Получить lossless exact локальную копию `payload/server.py` blob `f02cef6a...`; `account_pool.py` exact copy уже доказана.
3. Выполнить `tools/materialize_agent_wiring_with_tombstones.py --check` на frozen exact pair.
4. Pair-apply, readback и compile обоих файлов.
5. Прогнать совместный локальный cluster: engineer/owner prompt isolation, reservations, account/thread affinity, transport failover, delegation, delegated tool-loop/no-replay, lifecycle/rebind/drain, tombstone restart.
6. Если green — зафиксировать exact Agent head/blobs/tests в этом handoff и `kontur#9`, затем один disposable final Agent gate.
7. После Agent green передать Core свежие Agent blobs/tests и пройти composed/native-Windows acceptance. NCM28 не переписывать без стыковой необходимости.
8. Live Notion/Codex, production и secrets до этих gates не трогать.

## Не переоткрывать без нового evidence
- tombstone post-replace no-replay boundary;
- engineer/owner isolation основного Responses-пути;
- foreground reservations и sticky account/thread affinity;
- fresh-thread/full-history continuation failover;
- DynamicReservationLeaseSession transport provenance;
- bounded delegated tool-loop;
- server lifecycle/rebind/drain;
- materializer journal/backup/recovery race hardening.
