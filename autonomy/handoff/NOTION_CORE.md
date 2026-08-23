# Notion — Windows + Codex ядро

Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent PR #8: `autonomy/notion-prompt-modes-20260819`, fresh exact head `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`.

Не дублировать Agent rotation/prompt/delegation/account-thread affinity. Core касается их только на границе безопасной композиции.

## Режим

`OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23` активен. Не запускать CircleCI/GitHub Actions, не двигать Circle-triggering product refs и не использовать `[ci skip]` как обход. Исторический Windows digest `1cd6d894-1abb-4ec0-91e5-1cab7e6a48b3` не перезапускать и не считать PASS.

Production, secrets и live Notion/Codex не трогать до safety gates. Финальный Windows Server 2022 gate — только после exact-local composed green и отдельной owner-разморозки, через disposable `ci/notion-core-windows-final-gate` с точными logs/artifacts.

## Постоянная память v4

Последний доказанно целый канонический `LATEST`, записанный до этого прохода:
- capsule `20260823T035422Z-2c69292246`;
- archive SHA-256 `8df2f2078b33304e3ca254d39938ecc415850284eec480be6249fd8f58fa1aa8`;
- `LATEST.json` blob `d7084892eb86906e8ff3e1270168567def4b0a1e`;
- `PREVIOUS` = `20260823T030353Z-815af453c1`.

Новый `LATEST` без полного byte-exact `capsule_runtime_v4.py restore -> pack -> readback -> CAS` не публиковать. Unknown bytes не реконструировать.

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

## Exact Agent materialization — pair independently reproduced by Core

### `payload/account_pool.py`
- exact source blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- exact transformer `tools/apply_account_pool_dynamic_reservation.py` `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- transformed result 48066 bytes, Git blob SHA **`c9ca6f3b4545e469966369a4220a6a2a60bf3697`**;
- Python compile PASS;
- matches the independently expected Agent transformed SHA.

Verdict: `EXACT_ACCOUNT_POOL_TRANSFORM_REPRODUCED_PASS`.

### `payload/server.py` — новый факт этого прохода
- exact source blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes;
- source readback SHA-256 `a364cdf0a88ac2f318616b4b633f6f10b6d156b85c8668d4d54b5d884ae28310`;
- exact startup/dynamic-reservation transformer `2ed85ece7d3323b1619ec0963d3021c1623d0e0a`;
- exact tombstone wiring transformer `40ab3a448e33fb8a8c3ce045ef31a815d0554823`;
- transformed result 115707 bytes, Git blob SHA **`ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`**;
- transformed SHA-256 `5c8f96ac56576c5ffd89eb6292944e053bd7671b8b8cebc6093978006da6227b`;
- Python compile PASS;
- result exactly matches the independently expected Agent transformed SHA.

Verdict: **`EXACT_AGENT_SERVER_TRANSFORM_REPRODUCED_PASS`**.

Evidence: `autonomy/evidence/notion/20260823T0658Z_exact_agent_server_materialization.json`.

Следствие: прежний byte-level blocker «нет точных transformed server bytes» снят как вопрос воспроизводимости. Обе половины Agent pair теперь независимо воспроизведены Core до ожидаемых Git blob SHA. Следующий шаг — не новая архитектурная разведка, а V50 same-byte composition.

## V50 / финальный локальный gate

V50 materializer: `autonomy/evidence/notion/20260822T2043Z_v50_fixed_agent_core_composition_materializer.py`, blob `8c36e9cbca05498c43a48bc2094756ce8c854d4b`.

V48 frozen composition materializer: `autonomy/evidence/notion/20260822T1840Z_v48_frozen_agent_toolchain_composition_materializer.py`, blob `dab975abd730481d0986b38cb2b2fb2d816e4244`.

Agent expected transformed pair теперь обе независимо воспроизведены:
- `payload/account_pool.py` -> `c9ca6f3b4545e469966369a4220a6a2a60bf3697`;
- `payload/server.py` -> `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`.

Fail-closed coverage verifier: `autonomy/v3/tools/verify_notion_final_gate_coverage.py`, blob `0be4c5f626b92b8291c86590580ae767d6d816f6`. Нынешний обычный Agent Circle suite не включает `test_subagent_tombstone_post_replace_sync_failure.py`, поэтому сам по себе не является финальным экзаменом.

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
2. Собрать byte-identical disposable tree с уже доказанной Agent pair `c9ca6f3b.../ba52edc7...` и frozen Core inputs.
3. Запустить V50 `check`, затем `--apply`, readback/compile.
4. На тех же bytes прогнать полный Agent+Core Stage-B cluster; coverage verifier обязан PASS перед composed-green.
5. Сохранить exact composed bytes долговечно; product ref не двигать во время Circle freeze.
6. Только после явной owner-разморозки — один disposable native Windows Server 2022 gate с exact logs/artifacts. Windows FAIL = реальный blocker.
7. После Windows PASS — bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK` со стабильным conversation id через initial/tool-result/retry/restart.
8. Затем native-Windows проверенный owner-facing PowerShell doctor.

В этом проходе PR #7/#8, live Notion/Codex, secrets, production и CircleCI не менялись. Существенный новый факт — exact transformed Agent `server.py` независимо воспроизведён Core до ожидаемого Git blob; обе половины Agent pair теперь известны и подтверждены.
