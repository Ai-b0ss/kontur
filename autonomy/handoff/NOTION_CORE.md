# Notion — Windows + Codex ядро

Core: `Ai-b0ss/notion-agent-bridge:candidate/ncm28-windows-fixed-v1`, PR #7, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent integration boundary: draft PR #8 `autonomy/notion-prompt-modes-20260819`, fresh exact head `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`.

Не дублировать Agent rotation/prompt/delegation/account-thread affinity. Core касается их только на границе безопасной композиции.

## Режим и Windows

Сначала exact-source локальные проверки. Production, секреты и живой Notion/Codex не трогать до safety gates.

`OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23` остаётся активным: не запускать CircleCI, не двигать Circle-triggering product refs, не использовать `[ci skip]` как неподтверждённый обход. Исторический digest workflow `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` не перезапускать; его пять старых checks не считать текущим PASS.

Финальный native Windows Server 2022 gate допустим только после exact-local composed green и явной owner-разморозки, через disposable `ci/notion-core-windows-final-gate` с exact logs/artifacts.

## Постоянная память v4

Fresh canonical `LATEST` на старте текущего прохода:
- capsule `20260822T225043Z-994f73e8b0`;
- archive SHA-256 `d4f5faba83a711f656eed95973ffa49e9d5b11575947bc1b4d60fe0bb796230a`;
- pointer blob `b71f95d8af6bcec41efe431afb71a7357cf91657`.

LATEST/PREVIOUS/CAS обязательны. Unknown bytes не реконструировать; force-write запрещён.

## Stage A — закрыт

`V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Legacy-state v2 `unsupported/corrupt/persistence_blocked` после load/get закрывается до обращения к Notion и в `/v1/responses`, и в `/v1/responses/compact`. Новый durable-state epoch нельзя вводить без этого rollback floor.

## Stage B store — зелёная основа

`V34_V35_EXACT_CLASS_INTEGRATED_PASS`:
- отдельный strict `provider_intent`;
- exact durable replay с сохранёнными `response_id/item_id/call_id`;
- restart;
- detached `get()`;
- duplicate unresolved fail-closed;
- forced NCM28 final-write failure сохраняет intent и блокирует persistence;
- TTL cleanup + replay-unavailable tombstone.

Целевой порядок Core:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

## Agent no-replay boundary — исправлен

Fresh exact Agent head `ee0ae241...` содержит fix `a22c1ff43c6e997a863a7cd9e022243341388566` и усиленные regression/restart проверки. Fresh `NOTION_AGENT.md` сообщает exact local tombstone/restart/cancellation cluster PASS. Без нового воспроизводимого дефекта этот модуль не полировать.

Обязательные exact blobs следующей композиции:
- `payload/subagent_tombstone_store.py` — `c2a3f8e74a94b15325423bfdb8f3437141233996`;
- `tests/test_subagent_tombstone_post_replace_sync_failure.py` — `0dc3e95cb987da326b63712c981138e8f1c976e1`;
- `tests/test_delegated_cancellation_lifecycle.py` — `142ec6c64366c195aca8c8d615bd17062a6592`;
- `tests/test_subagent_tombstone_store.py` — `7c383e234cfa8828db753caa89145f11546d0d2f`;
- `tests/test_server_subagent_tombstone_restart.py` — `aba8b3dd4dc181d1f78cb6fdfd3b85fc7ce1c7ee`.

## V50 — текущий exact composition materializer

`autonomy/evidence/notion/20260822T2043Z_v50_fixed_agent_core_composition_materializer.py`
Git blob `8c36e9cbca05498c43a48bc2094756ce8c854d4b`.

V50 замораживает exact Agent head, Core preimages, tombstone/regression cluster, V48 frozen Agent toolchain, V41/V45 no-failover composition и Codex shell-env patch. `py_compile`/CLI smoke были зелёными, но **V50 composed PASS ещё не объявлен**: нужен exact checkout или exact byte handoff.

## Exact transformed Agent pair — текущий блокер байтов

Ранее Agent точно доказал ожидаемые transformed hashes:
- `payload/account_pool.py` -> `c9ca6f3b4545e469966369a4220a6a2a60bf3697`;
- `payload/server.py` -> `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`.

В текущем Core-проходе fresh `GitHub.fetch_blob` показал, что эти два ожидаемых объекта **не существуют как fetchable Git blobs** в `Ai-b0ss/notion-agent-bridge`; account blob также отсутствует в `Ai-b0ss/kontur`. То есть хеши доказаны, но exact transformed bytes всё ещё не переданы Core долговечно.

Fresh Agent v4 capsule `20260822T220058Z-f18a1b833d` содержит только `CHECKPOINT.json` + `README.md`, поэтому тоже не является byte bridge.

Новый durable evidence + будущий gate manifest:
`autonomy/evidence/notion/20260822T2350Z_exact_pair_byte_handoff_blocker_and_gate_manifest.json`
(control commit `f737b9ab159bb73abf2283b365472890d96df8a7`).

В `kontur#9` оставлен точный запрос NOTION_AGENT: re-materialize pair на exact-checkout-capable executor, проверить эти два SHA и сохранить **сами байты** без движения PR #8/product refs — через unreferenced Git blobs/content-addressed immutable handoff или v4 capsule с обоими файлами. Circle freeze обязателен.

## V41–V45 и серверная граница

- V41: `AccountLease.run(..., allow_failover=True)`; default сохраняет Agent failover, protected Core после intent использует `false`.
- V42: protected transport error выходит напрямую и не попадает в старый outer retry через `AccountPoolExhausted`.
- V43: protected mode обязателен для initial/continuation Responses, planner correction и compaction.
- V44: stream/non-stream — только проекции одного уже долговечно сохранённого canonical Responses object; disconnect после provider-entered не отменяет commit-critical task.
- V45: `allow_failover=false` проходит через `DynamicReservationLeaseSession.run_selected/run` и one-shot wrappers.

## Codex shell-env safety — обязательно до live

Fresh exact current source:
- `tools/run_real_codex_cli_project_probe.py` blob `2f6d5873606975771b5ab418d5f9d45cd602304c`;
- `tests/test_real_codex_cli_probe_contract.py` blob `2958fac16ecf6ded815c6dfc12aa1060319a62e8`.

Обязательный exact patch:
`autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`, blob `5ae2079725886a180e130cfbb729365be56d8b59`.

До live требуется:
- `inherit="core"`;
- `ignore_default_excludes=false`;
- exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.

## Обязательная composed матрица

На одних и тех же composed bytes обязательно прогнать:
- Agent pair materializer/journal/backup/recovery/tombstone/dynamic reservation;
- `tests/test_subagent_tombstone_post_replace_sync_failure.py` явно;
- tombstone store + server restart + delegated cancellation lifecycle;
- V41/V45 protected no-failover;
- Stage-B strict intent/finalize;
- canonical Responses + compaction;
- retry/restart/exact replay;
- stream/non-stream/disconnect;
- ambiguous transport;
- removed persisted account без ghost reservation/подмены;
- TTL/size/oversize/stale retry >32;
- legacy/rollback floor;
- shell-env contract.

Текущая `.circleci/config.yml` PR #8 blob `e6bab5c300b2240cfbc68e30bb9a83c67ecc0cd5` **не включает** `tests/test_subagent_tombstone_post_replace_sync_failure.py` в обычные Agent suites. Поэтому будущий disposable final gate обязан включить regression явно; зелёный gate без него не является финальной приёмкой.

## Windows owner-doctor — обязательный финишный артефакт

После composed + native Windows green подготовить простой PowerShell owner doctor. Один запуск на домашнем Windows должен:
- проверить Python/Node/Codex prerequisites и локальную конфигурацию без вывода секретов;
- безопасно поднять bridge;
- прогнать offline/self-tests и минимальный разрешённый smoke;
- проверить restart/replay/tool-result/rotation/affinity;
- при разрешённой live-фазе выполнить bounded `Codex -> bridge -> Notion` smoke;
- вывести `NOTION_WINDOWS_READY` либо первый точный blocker.

Doctor должен сам пройти native Windows final gate до выдачи владельцу.

## Следующий порядок

1. Fresh-read PR #8. При новом head — re-freeze inputs; не патчить на догадках.
2. Получить exact transformed pair bytes без движения product ref и проверить `c9ca6f3b...` / `ba52edc7...`.
3. На exact checkout/byte-identical disposable tree: V50 `check`, затем `--apply`, readback/compile.
4. На тех же bytes прогнать полный Agent+Core cluster выше; при FAIL — только минимальный root-cause fix.
5. Сохранить exact composed bytes долговечно через v4/CAS/content-addressed handoff; product ref не двигать во время Circle freeze.
6. После явной owner-разморозки: fast-forward exact product materialization/readback; затем один disposable `ci/notion-core-windows-final-gate` на Windows Server 2022 с exact logs/artifacts.
7. Windows FAIL считать реальным blocker; повтор только после релевантных изменений.
8. После Windows PASS — bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, с stable conversation id через initial/tool-result/retry/restart.
9. Затем native-Windows проверенный owner-facing PowerShell doctor.

Product PR #7/#8, live Notion/Codex, secrets, production и CircleCI в текущем Core-проходе не менялись.
