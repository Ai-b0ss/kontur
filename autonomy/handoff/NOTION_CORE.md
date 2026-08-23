# Notion — Windows + Codex ядро

Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent PR #8: `autonomy/notion-prompt-modes-20260819`, fresh exact head `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`.

Не дублировать Agent rotation/prompt/delegation/account-thread affinity. Core касается их только на границе безопасной композиции.

## Режим

`OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23` активен. Не запускать CircleCI, не двигать Circle-triggering product refs и не использовать `[ci skip]` как обход. Исторический digest `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` не перезапускать и не считать PASS.

Production, секреты и live Notion/Codex не трогать до safety gates. Финальный Windows Server 2022 gate — только после exact-local composed green и отдельной owner-разморозки, через disposable `ci/notion-core-windows-final-gate` с exact logs/artifacts.

## Постоянная память v4

Текущий проверенный `LATEST`:
- capsule `20260823T035422Z-2c69292246`;
- archive SHA-256 `8df2f2078b33304e3ca254d39938ecc415850284eec480be6249fd8f58fa1aa8`;
- `LATEST.json` blob `d7084892eb86906e8ff3e1270168567def4b0a1e`;
- `PREVIOUS` = `20260823T030353Z-815af453c1`.

Перед упаковкой предыдущая capsule `20260823T030353Z-815af453c1` была реально восстановлена каноническим `capsule_runtime_v4.py` blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`: manifest/parts/archive/workspace прошли точную проверку. Новая capsule упакована тем же runtime; все четыре part и manifest после публикации перечитаны и совпали с локально рассчитанными Git blob SHA (`9dbcd006...`, `92881cf6...`, `5f9ae1bc...`, `c36de5be...`, manifest `1a3789a2...`). Старый `LATEST` сохранён как `PREVIOUS`, затем новый указатель переключён через CAS от точного parent blob `4135a8419792e7f4de3220f39a141c88b79fde69` и повторно должен читаться как `d7084892eb86906e8ff3e1270168567def4b0a1e`.

LATEST/PREVIOUS/CAS обязательны. Unknown bytes не реконструировать; force-write запрещён.

## Stage A / Stage B store

Stage A закрыт: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`. Legacy-state `unsupported/corrupt/persistence_blocked` закрывается до Notion и в `/v1/responses`, и в `/v1/responses/compact`.

Stage B store foundation зелёная: `V34_V35_EXACT_CLASS_INTEGRATED_PASS` — strict `provider_intent`, exact durable replay с сохранёнными IDs, restart, detached `get()`, duplicate unresolved fail-closed, forced NCM28 failure rollback/block, TTL cleanup + replay-unavailable tombstone.

Целевой порядок:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

## Agent no-replay boundary и fresh exact capsule

Fresh exact Agent head `ee0ae241...` содержит fix `a22c1ff43c6e997a863a7cd9e022243341388566` и усиленные restart/tombstone regressions. Fresh `NOTION_AGENT.md` сообщает exact local tombstone/restart/cancellation cluster PASS. Без нового воспроизводимого дефекта этот модуль не полировать.

Core независимо восстановил byte-exact свежую Agent capsule `20260823T023849Z-863c6be6bb`: archive SHA-256 `4291103723b0c01f316bedd3c01e5f0616208cc827e35ead81e6c96b0f33ee56`, 13/13 parts и все workspace-файлы совпали с manifest. Capsule содержит текущий `delegated_prompt_policy` candidate и его тесты, но **не содержит materialized `payload/account_pool.py` + `payload/server.py`**. То есть prompt-policy handoff доказан exact bytes, а product-pair byte bridge всё ещё отсутствует.

Обязательные exact blobs:
- `payload/subagent_tombstone_store.py` `c2a3f8e74a94b15325423bfdb8f3437141233996`;
- `tests/test_subagent_tombstone_post_replace_sync_failure.py` `0dc3e95cb987da326b63712c981138e8f1c976e1`;
- `tests/test_delegated_cancellation_lifecycle.py` `142ec6c64366c195aca8c8d8d615bd17062a6592`;
- `tests/test_subagent_tombstone_store.py` `7c383e234cfa8828db753caa89145f11546d0d2f`;
- `tests/test_server_subagent_tombstone_restart.py` `aba8b3dd4dc181d1f78cb6fdfd3b85fc7ce1c7ee`.

## V50 exact composition

Materializer: `autonomy/evidence/notion/20260822T2043Z_v50_fixed_agent_core_composition_materializer.py`, blob `8c36e9cbca05498c43a48bc2094756ce8c854d4b`.

Он замораживает exact Agent head, Core preimages, tombstone/regression cluster, V48 frozen Agent toolchain, V41/V45 no-failover и Codex shell-env patch. Сам V50 компилировался/CLI-smoke PASS, но **composed PASS ещё не объявлен**: нужен exact byte-identical checkout/handoff.

## Exact transformed Agent pair — текущий узкий blocker

Agent доказал ожидаемые transformed hashes:
- `payload/account_pool.py` -> `c9ca6f3b4545e469966369a4220a6a2a60bf3697`;
- `payload/server.py` -> `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`.

Fresh Core в 03:45Z снова вызвал `fetch_blob` на оба SHA в `Ai-b0ss/notion-agent-bridge` и получил 404. Свежая Agent capsule `20260823T023849Z-863c6be6bb` также не содержит pair bytes. Значит hashes доказаны, но **сами transformed bytes пока не переданы Core долговечно**; это единственный текущий byte-level blocker перед V50 composed-local run.

Чтобы следующий exact-checkout-capable Agent pulse не тратил ещё одну смену на ручной handoff, добавлен готовый exporter: `autonomy/evidence/notion/20260823T0345Z_exact_agent_pair_blob_exporter.py`, control commit `3c11195071ef9342dc76b2fb519d779cca81c225`, Git blob `ad3731fdadc6a440f1c1e67390c7cd9d0f272cc1`. Он проверяет exact Agent head, опционально запускает canonical Agent materializer `--check`+apply, требует ровно ожидаемые два Git blob SHA, сохраняет только unreferenced objects через `git hash-object -w`, делает byte-roundtrip через `git cat-file` и проверяет отсутствие движения refs. Synthetic self-test прошёл normal persistence, byte roundtrip, no-ref-movement, negative mismatch rejection; Python compile PASS. Handoff NOTION_AGENT опубликован в issue #9 comment `5384081532`.

Evidence/gate manifest старой точки: `autonomy/evidence/notion/20260822T2350Z_exact_pair_byte_handoff_blocker_and_gate_manifest.json`, commit `f737b9ab159bb73abf2283b365472890d96df8a7`.

## V41–V45

- V41: `AccountLease.run(..., allow_failover=True)`; default сохраняет Agent failover, protected Core после intent использует `false`.
- V42: protected transport error выходит напрямую и не попадает в старый outer retry через `AccountPoolExhausted`.
- V43: protected mode обязателен для initial/continuation Responses, planner correction и compaction.
- V44: stream/non-stream — только проекции одного уже долговечно сохранённого canonical Responses object; disconnect после provider-entered не отменяет commit-critical task.
- V45: `allow_failover=false` проходит через `DynamicReservationLeaseSession.run_selected/run` и one-shot wrappers.

## Codex shell-env safety

До live обязательно:
- `inherit="core"`;
- `ignore_default_excludes=false`;
- exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.

Exact patch: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`, blob `5ae2079725886a180e130cfbb729365be56d8b59`.

## Обязательная composed матрица

На одних и тех же composed bytes прогнать:
- Agent materializer/journal/backup/recovery/tombstone/dynamic reservation;
- `tests/test_subagent_tombstone_post_replace_sync_failure.py` явно;
- tombstone store + server restart + delegated cancellation lifecycle;
- current delegated owner/engineer prompt-policy candidate + tests;
- V41/V45 no-failover;
- Stage-B strict intent/finalize;
- canonical Responses + compaction;
- retry/restart/exact replay;
- stream/non-stream/disconnect;
- ambiguous transport;
- removed persisted account без ghost reservation/подмены;
- TTL/size/oversize/stale retry >32;
- legacy rollback floor;
- shell-env contract.

Fresh `.circleci/config.yml` PR #8 blob `e6bab5c300b2240cfbc68e30bb9a83c67ecc0cd5` **не включает** `tests/test_subagent_tombstone_post_replace_sync_failure.py` в обычные Agent suites. Будущий disposable final gate обязан включить regression явно; зелёный gate без него не является приёмкой.

## Windows owner-doctor

После composed + native Windows green подготовить простой PowerShell doctor. Один запуск должен проверить Python/Node/Codex prerequisites и конфигурацию без вывода секретов, безопасно поднять bridge, прогнать offline/self-tests и smoke, проверить restart/replay/tool-result/rotation/affinity, а при разрешённой live-фазе — bounded `Codex -> bridge -> Notion` smoke. Результат: `NOTION_WINDOWS_READY` либо первый точный blocker. Doctor сам должен пройти тот же native Windows final gate до выдачи владельцу.

## Следующий порядок

1. Fresh-read PR #8; при head drift — re-freeze inputs.
2. На exact checkout запустить exporter с materialization; readback обоих unreferenced blobs обязан дать `c9ca6f3b...` / `ba52edc7...` без движения product ref.
3. Core забирает exact transformed pair bytes и на byte-identical disposable tree запускает V50 `check`, затем `--apply`, readback/compile.
4. На тех же bytes прогнать полный Agent+Core cluster, включая свежий delegated prompt-policy candidate; при FAIL — минимальный root-cause fix.
5. Сохранить exact composed bytes долговечно; product ref не двигать во время Circle freeze.
6. После явной owner-разморозки: fast-forward exact materialization/readback; один disposable native Windows Server 2022 gate с exact logs/artifacts и обязательным post-replace regression.
7. Windows FAIL = реальный blocker, повтор только после релевантного изменения.
8. После Windows PASS — bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, stable conversation id через initial/tool-result/retry/restart.
9. Затем native-Windows проверенный owner-facing PowerShell doctor.

В текущем Core-проходе product PR #7/#8, live Notion/Codex, secrets, production и CircleCI не менялись. Точный exporter опубликован и передан Agent; новый Core v4 checkpoint опубликован через CAS; transformed pair bytes пока остаются единственным непосредственным byte-level blocker перед V50.
