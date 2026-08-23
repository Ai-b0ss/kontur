# Notion — Windows + Codex ядро

Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent PR #8: `autonomy/notion-prompt-modes-20260819`, fresh exact head `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`.

Не дублировать Agent rotation/prompt/delegation/account-thread affinity. Core касается их только на границе безопасной композиции.

## Режим

`OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23` активен. Не запускать CircleCI/GitHub Actions, не двигать Circle-triggering product refs и не использовать `[ci skip]` как обход. Исторический Windows digest `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` не перезапускать и не считать PASS.

Production, секреты и live Notion/Codex не трогать до safety gates. Финальный Windows Server 2022 gate — только после exact-local composed green и отдельной owner-разморозки, через disposable `ci/notion-core-windows-final-gate` с точными logs/artifacts.

## Постоянная память v4

Канонический проверенный `LATEST` остаётся:
- capsule `20260823T035422Z-2c69292246`;
- archive SHA-256 `8df2f2078b33304e3ca254d39938ecc415850284eec480be6249fd8f58fa1aa8`;
- `LATEST.json` blob `d7084892eb86906e8ff3e1270168567def4b0a1e`;
- `PREVIOUS` = `20260823T030353Z-815af453c1`.

Новый `LATEST` без полного byte-exact `capsule_runtime_v4.py restore -> pack -> readback -> CAS` не публиковать. Последняя попытка восстановления текущей capsule из connector-text была остановлена fail-closed на несовпадении part; unknown bytes не исправлялись вручную.

## Stage A / Stage B

Stage A закрыт: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`. Legacy-state `unsupported/corrupt/persistence_blocked` закрывается до Notion и в `/v1/responses`, и в `/v1/responses/compact`.

Stage B store foundation зелёная: `V34_V35_EXACT_CLASS_INTEGRATED_PASS` — strict `provider_intent`, exact durable replay с сохранёнными IDs, restart, detached `get()`, duplicate unresolved fail-closed, forced NCM28 failure rollback/block, TTL cleanup + replay-unavailable tombstone.

Целевой порядок:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

V41–V45 обязательны: protected Core после intent запрещает неявный failover, включая dynamic reservation wrappers; осознанная planner correction остаётся отдельным шагом на том же аккаунте; stream/non-stream — только проекции одного уже долговечно сохранённого canonical response; disconnect после provider-entered не отменяет commit-critical transaction.

## Fresh Agent exact boundary

Fresh Agent head `ee0ae241...` содержит no-replay fix `a22c1ff43c6e997a863a7cd9e022243341388566` и restart/tombstone regressions.

Обязательные exact blobs текущего Agent-кластера:
- `payload/subagent_tombstone_store.py` `c2a3f8e74a94b15325423bfdb8f3437141233996`;
- `tests/test_subagent_tombstone_post_replace_sync_failure.py` `0dc3e95cb987da326b63712c981138e8f1c976e1`;
- `tests/test_delegated_cancellation_lifecycle.py` `142ec6c64366c195aca8c8d8d615bd17062a6592`;
- `tests/test_subagent_tombstone_store.py` `7c383e234cfa8828db753caa89145f11546d0d2f`;
- `tests/test_server_subagent_tombstone_restart.py` `aba8b3dd4dc181d1f78cb6fdfd3b85fc7ce1c7ee`.

Fresh Agent capsule `20260823T023849Z-863c6be6bb` ранее восстановлена byte-exact, но materialized `payload/account_pool.py + payload/server.py` в ней отсутствуют.

## Exact Agent materialization — новый факт 2026-08-23 06Z

Core независимо материализовал **точный `payload/account_pool.py`** без checkout и без догадок:
- exact source blob из PR #8: `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- exact transformer `tools/apply_account_pool_dynamic_reservation.py`: `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- оба локальных preimage readback Git blob SHA совпали с GitHub;
- transformer применён к точному preimage;
- результат: 48066 bytes, Git blob SHA **`c9ca6f3b4545e469966369a4220a6a2a60bf3697`**;
- этот SHA ровно совпал с ранее доказанным Agent expected transformed SHA;
- Python compile PASS.

Вердикт: `EXACT_ACCOUNT_POOL_TRANSFORM_REPRODUCED_PASS`.

Evidence: `autonomy/evidence/notion/20260823T0605Z_exact_account_pool_materialization.json`.

Начат content-addressed handoff без движения refs: первые три base64-text chunk blobs точного результата проверены как `ac568fdd...`, `c243825f...`, `3aa80cb4...`. **Это пока неполный набор; из него файл не восстанавливать.** Неудачные пробные blobs остаются unreferenced и игнорируются.

Непосредственный byte-level blocker сузился: exact transformed `account_pool.py` теперь независимо доказан Core; всё ещё нужны полные durable bytes пары, прежде всего `payload/server.py` с ожидаемым SHA `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`, после чего можно запускать V50 на одних composed bytes.

## V50 / финальный тестовый gate

V50 materializer: `autonomy/evidence/notion/20260822T2043Z_v50_fixed_agent_core_composition_materializer.py`, blob `8c36e9cbca05498c43a48bc2094756ce8c854d4b`.

Agent expected transformed pair:
- `payload/account_pool.py` -> `c9ca6f3b4545e469966369a4220a6a2a60bf3697` — теперь независимо воспроизведён Core;
- `payload/server.py` -> `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298` — exact bytes ещё не переданы Core.

Exporter для full-checkout Agent pulse: `autonomy/evidence/notion/20260823T0345Z_exact_agent_pair_blob_exporter.py`, blob `ad3731fdadc6a440f1c1e67390c7cd9d0f272cc1`. Он сохраняет только unreferenced objects и проверяет отсутствие движения refs.

Fail-closed coverage verifier: `autonomy/v3/tools/verify_notion_final_gate_coverage.py`, blob `0be4c5f626b92b8291c86590580ae767d6d816f6`. Он требует реальный запуск tombstone/restart/cancellation/materializer/dynamic-reservation/Codex-probe регрессий и Stage-B `durable_replay/provider_intent` cluster. Нынешний обычный Agent Circle suite не включает `test_subagent_tombstone_post_replace_sync_failure.py`, поэтому сам по себе не является финальным экзаменом.

## Codex shell-env safety

До live обязательно:
- `inherit="core"`;
- `ignore_default_excludes=false`;
- exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.

Exact patch: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`, blob `5ae2079725886a180e130cfbb729365be56d8b59`.

## Обязательная composed матрица

На одних composed bytes прогнать Agent materializer/journal/backup/recovery/tombstone/dynamic reservation; mandatory post-replace regression; tombstone store + server restart + delegated cancellation; owner/engineer prompt-policy; V41/V45 no-failover; strict intent/finalize; canonical Responses + compaction; retry/restart/exact replay; stream/non-stream/disconnect; ambiguous transport; removed persisted account; TTL/size/oversize/stale retry >32; legacy rollback floor; shell-env contract. `verify_notion_final_gate_coverage.py` обязан PASS.

## Windows owner-doctor

После composed + native Windows green подготовить простой PowerShell doctor. Один запуск проверяет Python/Node/Codex prerequisites и конфигурацию без вывода секретов, безопасно поднимает bridge, гоняет offline/self-tests и smoke, проверяет restart/replay/tool-result/rotation/affinity, а при разрешённой live-фазе — bounded `Codex -> bridge -> Notion` smoke. Результат: `NOTION_WINDOWS_READY` либо первый точный blocker. Doctor обязан пройти тот же native Windows final gate.

## Следующий порядок

1. Fresh-read PR #8; при head drift — re-freeze inputs.
2. Довести exact byte handoff Agent pair: account_pool уже воспроизведён; получить/материализовать exact `server.py` -> `ba52edc7...` без движения product ref.
3. На byte-identical disposable tree запустить V50 `check`, затем `--apply`, readback/compile.
4. На тех же bytes прогнать полный Agent+Core Stage-B cluster; coverage verifier обязан PASS перед composed-green.
5. Сохранить exact composed bytes долговечно; product ref не двигать во время Circle freeze.
6. Только после явной owner-разморозки — один disposable native Windows Server 2022 gate с exact logs/artifacts. Windows FAIL = реальный blocker.
7. После Windows PASS — bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK` со стабильным conversation id через initial/tool-result/retry/restart.
8. Затем native-Windows проверенный owner-facing PowerShell doctor.

В текущем проходе PR #7/#8, live Notion/Codex, secrets, production и CircleCI не менялись. Существенный новый факт — exact Agent `account_pool.py` independently reproduced to the expected transformed Git blob; immediate blocker narrowed to full durable pair bytes, especially transformed `server.py`.
