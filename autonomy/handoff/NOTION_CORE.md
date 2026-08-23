# Notion — Windows + Codex ядро

Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent PR #8: `autonomy/notion-prompt-modes-20260819`, fresh exact head `ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9`.

Не дублировать Agent rotation/prompt/delegation/account-thread affinity. Core касается их только на границе безопасной композиции.

## Режим

`OWNER TEMPORARY CIRCLE FREEZE — 2026-08-23` активен. Пользовательский Circle Projects сейчас не доказывает подключение `notion-agent-bridge`: видимый `free-fabric-gpt-bridge` нельзя считать Notion-проектом. Не запускать CircleCI/GitHub Actions, не двигать `ci/notion-core-windows-final-gate` и Circle-triggering product refs, не считать исторические Circle-результаты свежими.

Production, secrets и live Notion/Codex не трогать до safety gates. Финальный Windows Server 2022 gate — только после exact-local unified Stage-B green и отдельной owner-разморозки/reconnect.

## Постоянная память v4

Последний канонический `LATEST`, прочитанный из control-ветки:
- capsule `20260823T035422Z-2c69292246`;
- archive SHA-256 `8df2f2078b33304e3ca254d39938ecc415850284eec480be6249fd8f58fa1aa8`;
- `LATEST.json` blob `d7084892eb86906e8ff3e1270168567def4b0a1e`.

В этом проходе `LATEST` не менялся: при byte-readback один fetched part не совпал с hash manifest. Unknown bytes не реконструировать, force-write запрещён. Новый `LATEST` публиковать только после полного `capsule_runtime_v4.py restore -> pack -> readback -> CAS`.

## Stage A / Stage B

Stage A закрыт локально: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`. Legacy-state `unsupported/corrupt/persistence_blocked` закрывается до Notion и в `/v1/responses`, и в `/v1/responses/compact`.

Stage B store foundation ранее доказана локально как `V34_V35_EXACT_CLASS_INTEGRATED_PASS`: strict `provider_intent`, exact durable replay с сохранёнными IDs, restart, detached `get()`, duplicate unresolved fail-closed, forced NCM28 failure rollback/block, TTL cleanup + replay-unavailable tombstone.

Целевой порядок Stage B:
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

## Exact Agent materialization

Обе половины materialized Agent-pair независимо воспроизведены Core:
- `payload/account_pool.py`: source `11cea792a2f5aaa40ee1515faddfd44e76cbb23f` -> transformed **`c9ca6f3b4545e469966369a4220a6a2a60bf3697`**, compile PASS;
- `payload/server.py`: source `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` -> transformed **`ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`**, compile PASS.

Evidence: `autonomy/evidence/notion/20260823T0658Z_exact_agent_server_materialization.json`.

Прежний byte-level blocker «нет exact transformed Agent bytes» снят.

## КРИТИЧЕСКОЕ УТОЧНЕНИЕ V50 — НЕ Stage-B candidate

V50 materializer: `autonomy/evidence/notion/20260822T2043Z_v50_fixed_agent_core_composition_materializer.py`, blob `8c36e9cbca05498c43a48bc2094756ce8c854d4b`.

V50 делает полезный промежуточный слой: V48 Agent/Core composition + protected no-failover wiring + Codex shell-env patch. Но **V50 не материализует Stage-B durable replay/provider-intent/finalize** и вообще не преобразует `payload/conversation_segments.py`.

Fresh Agent `payload/conversation_segments.py` остаётся baseline v2, exact blob `553bd3496c21a7949c3a5dfa03f33b9e09293213`: нет отдельного durable `provider_intents`, exact persisted Responses replay, strict write-failure propagation и detached `get()`.

Следовательно:
- `V50_FIXED_AGENT_CORE_COMPOSITION_CHECK_PASS`/`APPLY_PASS` — только prerequisite;
- **V50 PASS запрещено трактовать как Stage-B composed PASS или Windows-ready**;
- перед Windows нужен отдельный unified exact Stage-B candidate на тех же composed bytes.

Evidence: `autonomy/evidence/notion/20260823T0758Z_v50_stage_b_scope_gap_and_windows_readiness_guard.json`.

## Fail-closed Windows readiness guard

Добавлен `autonomy/v3/tools/verify_notion_windows_ready_candidate.py`, blob `97100e7a48d28467555b39947367319f79123f1a`.

Он разрешает метку **`READY_FOR_WINDOWS_CIRCLE_AFTER_RECONNECT`** только если manifest содержит:
- exact Core/Agent heads и materializer blob;
- exact итоговые composed blobs `conversation_segments.py`, `server.py`, `account_pool.py`, `reservation_aware_lease.py`, `subagent_tombstone_store.py`;
- `stage_b_unified_candidate=PASS` и `v50_only=false`;
- PASS всей локальной матрицы: Stage A, Agent materialization/tombstone/restart/cancel/dynamic-reservation, protected no-failover, strict intent/finalize, canonical Responses+compaction replay, restart, stream/non-stream/disconnect, ambiguous transport, removed account, TTL/size/oversize/stale retry, rollback, Codex shell-env, final coverage;
- Circle остаётся frozen и новый Circle/Windows run не запускался.

Self-test:
- неполный manifest -> exit `1`, `NOTION_WINDOWS_READY_NOT_READY`;
- полный synthetic manifest -> exit `0`, `READY_FOR_WINDOWS_CIRCLE_AFTER_RECONNECT`;
- Python compile PASS.

Это новый обязательный gate перед любым объявлением Windows-ready.

## Final local coverage

Существующий coverage verifier: `autonomy/v3/tools/verify_notion_final_gate_coverage.py`, blob `0be4c5f626b92b8291c86590580ae767d6d816f6`. Нынешний обычный Agent Circle suite не включает `test_subagent_tombstone_post_replace_sync_failure.py`, поэтому сам по себе не является финальным экзаменом.

На одних unified composed bytes прогнать Agent materializer/journal/backup/recovery/tombstone/dynamic reservation; mandatory post-replace regression; tombstone store + server restart + delegated cancellation; owner/engineer prompt-policy; V41/V45 no-failover; strict intent/finalize; canonical Responses + compaction; retry/restart/exact replay; stream/non-stream/disconnect; ambiguous transport; removed persisted account; TTL/size/oversize/stale retry >32; legacy rollback floor; shell-env contract. Оба verifier-а обязаны PASS.

## Codex shell-env safety

До live обязательно:
- `inherit="core"`;
- `ignore_default_excludes=false`;
- exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.

Exact patch: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch`, blob `5ae2079725886a180e130cfbb729365be56d8b59`.

## Windows owner-doctor

Можно готовить локально заранее, но считать проверенным только после будущего native Windows gate. Один запуск должен проверять prerequisites/config без вывода секретов, поднимать bridge, гонять offline/self-tests и smoke, restart/replay/tool-result/rotation/affinity; live-фаза только после safety gates. Результат: `NOTION_WINDOWS_READY` либо первый точный blocker.

## Следующий порядок

1. Fresh-read PR #8; при head drift — re-freeze inputs.
2. Собрать byte-identical disposable tree с доказанной Agent pair `c9ca6f3b.../ba52edc7...` и frozen Core inputs.
3. V50 `check/apply` использовать только как composition prerequisite.
4. На **эти же exact bytes** наложить/собрать единый Stage-B implementation (V34/V35 store + strict server intent/finalize + canonical Responses/compaction + V41/V45 buffered projection/restart safety).
5. Получить exact итоговые composed blob SHA и прогнать полную локальную Agent+Core Stage-B матрицу; `verify_notion_final_gate_coverage.py` и `verify_notion_windows_ready_candidate.py` обязаны PASS.
6. Только после этого записать `READY_FOR_WINDOWS_CIRCLE_AFTER_RECONNECT` с exact heads/config/blobs; product ref и Circle не двигать во время freeze.
7. После явной owner-разморозки/reconnect — один disposable native Windows Server 2022 gate с exact logs/artifacts. Windows FAIL = реальный blocker.
8. После Windows PASS — bounded authorized `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK` со стабильным conversation id через initial/tool-result/retry/restart.
9. Затем native-Windows проверенный owner-facing PowerShell doctor.

В этом проходе PR #7/#8, live Notion/Codex, secrets, production и CircleCI не менялись. Существенный новый факт: V50 не является Stage-B materializer; добавлен fail-closed readiness guard, который не даст ошибочно перейти к Windows по одному V50 PASS.
