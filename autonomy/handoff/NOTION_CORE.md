# Notion — Windows + Codex ядро

Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent PR #8: `autonomy/notion-prompt-modes-20260819`, fresh exact head `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`.

Не дублировать Agent rotation/prompt/delegation/account-thread affinity. Core касается их только на границе безопасной композиции.

## Режим

`OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23` активен. Не запускать CircleCI, не двигать Circle-triggering product refs и не использовать `[ci skip]` как обход. Исторический digest `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` не перезапускать и не считать PASS.

Production, секреты и live Notion/Codex не трогать до safety gates. Финальный Windows Server 2022 gate — только после exact-local composed green и отдельной owner-разморозки, через disposable `ci/notion-core-windows-final-gate` с exact logs/artifacts.

## Постоянная память v4

Текущий проверенный `LATEST`:
- capsule `20260822T235640Z-a1d972bba4`;
- archive SHA-256 `9eb7882620d4ff9d73ea586cd63526e3245bc4bd2a34fd65ab1595b4d8eab240`;
- `LATEST.json` blob `e6d3da5a3a6aa76537a846e903ee14e3bc2114d1`;
- `PREVIOUS` = `20260822T225043Z-994f73e8b0`.

Эта capsule была создана после точного восстановления предыдущего `LATEST` каноническим `capsule_runtime_v4.py` blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`. Обе новые части и manifest после публикации перечитаны и совпали с локально рассчитанными Git blob SHA. LATEST переключён через CAS от прежнего blob `b71f95d8af6bcec41efe431afb71a7357cf91657`.

LATEST/PREVIOUS/CAS обязательны. Unknown bytes не реконструировать; force-write запрещён.

## Stage A / Stage B store

Stage A закрыт: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`. Legacy-state `unsupported/corrupt/persistence_blocked` закрывается до Notion и в `/v1/responses`, и в `/v1/responses/compact`.

Stage B store foundation зелёная: `V34_V35_EXACT_CLASS_INTEGRATED_PASS` — strict `provider_intent`, exact durable replay с сохранёнными IDs, restart, detached `get()`, duplicate unresolved fail-closed, forced NCM28 failure rollback/block, TTL cleanup + replay-unavailable tombstone.

Целевой порядок:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

## Agent no-replay boundary

Fresh exact Agent head `ee0ae241...` содержит fix `a22c1ff43c6e997a863a7cd9e022243341388566` и усиленные restart/tombstone regressions. Fresh `NOTION_AGENT.md` сообщает exact local tombstone/restart/cancellation cluster PASS. Без нового воспроизводимого дефекта этот модуль не полировать.

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

Agent ранее доказал ожидаемые transformed hashes:
- `payload/account_pool.py` -> `c9ca6f3b4545e469966369a4220a6a2a60bf3697`;
- `payload/server.py` -> `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`.

Fresh Core `fetch_blob` вернул 404 для обоих expected objects в `Ai-b0ss/notion-agent-bridge`; account blob также отсутствует в `Ai-b0ss/kontur`. Значит хеши доказаны, но **сами transformed bytes пока не переданы Core долговечно**. Agent v4 capsule `20260822T220058Z-f18a1b833d` содержит только `CHECKPOINT.json` + `README.md` и byte bridge не является.

Evidence/gate manifest: `autonomy/evidence/notion/20260822T2350Z_exact_pair_byte_handoff_blocker_and_gate_manifest.json`, commit `f737b9ab159bb73abf2283b365472890d96df8a7`.

В issue #9 оставлен точный запрос NOTION_AGENT (comment `5383237230`): re-materialize exact pair на exact-checkout-capable executor, проверить оба SHA и сохранить **сами байты** без движения PR #8/product refs — unreferenced Git blobs/content-addressed immutable handoff или v4 capsule с обоими файлами. Circle freeze сохраняется.

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
2. Получить exact transformed pair bytes без движения product ref и проверить `c9ca6f3b...` / `ba52edc7...`.
3. На byte-identical disposable tree: V50 `check`, затем `--apply`, readback/compile.
4. На тех же bytes прогнать полный Agent+Core cluster; при FAIL — минимальный root-cause fix.
5. Сохранить exact composed bytes долговечно; product ref не двигать во время Circle freeze.
6. После явной owner-разморозки: fast-forward exact materialization/readback; один disposable native Windows Server 2022 gate с exact logs/artifacts.
7. Windows FAIL = реальный blocker, повтор только после релевантного изменения.
8. После Windows PASS — bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, stable conversation id через initial/tool-result/retry/restart.
9. Затем native-Windows проверенный owner-facing PowerShell doctor.

В текущем Core-проходе product PR #7/#8, live Notion/Codex, secrets, production и CircleCI не менялись.
