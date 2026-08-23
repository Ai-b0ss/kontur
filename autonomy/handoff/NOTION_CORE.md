# Notion — Windows + Codex ядро

Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Agent PR #8: `autonomy/notion-prompt-modes-20260819`, fresh exact head **`6672cc0de99acb648b587612bb900f100f5eff42`**.

Не дублировать Agent rotation/prompt/delegation/account-thread affinity. Core касается их только на границе безопасной композиции.

## Режим

Свежая owner-policy отменяет старое `Circle frozen / reconnect required`. Notion Circle connectivity уже доказана clean probe и считается `PASS`; connectivity probe не повторять.

Linux/offline composition разрешена. Native Windows Server 2022 запускать только после exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах. Production, secrets и live Notion/Codex не трогать до promoted safety gates.

## Fresh head drift 2026-08-23 10:50Z

Предыдущий Agent head `ee0ae241...` устарел. Fresh head `6672cc0...` на 3 commit впереди. Compare `ee0ae241..6672cc0` меняет 7 файлов:
- `payload/notion_delegation_adapter.py`;
- `tests/test_account_pool_reselect_release_abort_semantics.py`;
- `tests/test_delegated_failover_session.py`;
- `tests/test_dynamic_reservation_lease_session.py`;
- `tests/test_foreground_slot_routing.py`;
- `tests/test_notion_tool_subagent_runtime.py`;
- `tests/test_server_subagent_wiring_materializer.py`.

Критичные pair/store inputs `payload/account_pool.py`, `payload/server.py`, `payload/conversation_segments.py` не менялись, поэтому ранее доказанная byte-exact transformed pair остаётся допустимым входом композиции. Но final Agent test surface изменился, поэтому старый final-suite PASS не переносить на новый head.

Последний Agent write `c9b1826..6672cc0` был test-only и RELEASED; текущий Core claim не пересекается с Agent product write.

## Exact Agent pair

Core независимо воспроизвёл:
- `payload/account_pool.py`: source `11cea792a2f5aaa40ee1515faddfd44e76cbb23f` -> transformed `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, compile PASS;
- `payload/server.py`: source `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` -> transformed `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`, compile PASS.

Byte-level pair blocker закрыт. V50 остаётся только composition prerequisite, НЕ Stage-B candidate.

## Stage A / Stage B

Stage A локально закрыт: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Stage B store foundation ранее доказана как `V34_V35_EXACT_CLASS_INTEGRATED_PASS`: strict `provider_intent`, exact persisted replay IDs, restart, detached get, unresolved duplicate fail-closed, NCM28 write rollback/block, TTL cleanup/tombstone.

Целевой порядок:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

V41–V45 обязательны: protected Core после intent запрещает implicit failover через Agent wrappers; deliberate planner correction остаётся отдельным шагом на том же аккаунте; stream/non-stream — только проекции одного долговечно сохранённого результата; disconnect после provider-entered не отменяет commit-critical transaction.

Unified Stage-B candidate на full exact current tree **ещё не материализован**. Native Windows пока запрещён.

## Final coverage hardening — 2026-08-23 10:58Z

Agent audit воспроизвёл серьёзную дыру: прежний `verify_notion_final_gate_coverage.py` мог дать PASS без prompt/delegation safety tests. Core исправил это.

Current final coverage verifier:
- path `autonomy/v3/tools/verify_notion_final_gate_coverage.py`;
- blob **`b829c60e073d87cd04d31e30426cdcc8f3de7db0`**;
- control commit `28e25a11c9ba4b1540962e12b75e689021288706`.

Теперь обязательны прежние tombstone/restart/materializer/dynamic-reservation/Codex tests плюс:
- `tests.test_prompt_modes`;
- `tests.test_prompt_policy_identity`;
- `tests.test_responses_prompt_mode_http_contract`;
- `tests.test_responses_prompt_wiring_contract`;
- `tests.test_delegation_policy`;
- `tests.test_delegation_dispatcher`;
- `tests.test_notion_delegated_model_step`;
- `tests.test_subagent_entrypoint`;
- `tests.test_foreground_slot_routing`;
- `tests.test_server_subagent_wiring_materializer`.

Offline self-test:
- old suite omitting prompt/delegation -> `NOT_READY`;
- complete synthetic suite -> `PASS`;
- one missing delegation dispatcher -> `NOT_READY`;
- Python compile PASS.

## Windows readiness guard v3

Current readiness verifier:
- path `autonomy/v3/tools/verify_notion_windows_ready_candidate.py`;
- blob **`3eccd05fd3cfd84f8ebf35bd11f644bc73759632`**;
- schema `notion_windows_ready_candidate_v3`;
- control commit `e9bb9ba04f7b5e012ac5d0d512407b1fc0b98d3e`.

V3 дополнительно:
1. жёстко требует `final_gate_coverage_verifier_blob=b829c60e...`, поэтому PASS старого coverage verifier нельзя продвинуть;
2. требует explicit PASS prompt/delegation gate bits, а не один generic `final_gate_coverage=PASS`;
3. сохраняет прежние требования exact composed blobs, Stage-B unified candidate, Circle connectivity PASS и `native_windows_run_started=false`.

Offline self-test V3:
- v2/stale schema -> NOT_READY;
- stale coverage-verifier blob -> NOT_READY;
- missing prompt/delegation gate -> NOT_READY;
- complete synthetic v3 -> PASS;
- Python compile PASS.

Evidence: `autonomy/evidence/notion/20260823T1058Z_final_gate_prompt_coverage_and_windows_readiness_v3.json`.

## Final local matrix before Windows

На одних exact composed bytes обязаны пройти:
- exact Agent materialization/readback/compile;
- current stage-aware foreground routing + server-subagent wiring materializer;
- tombstone store + mandatory post-replace sync-failure regression + server restart + delegated cancellation;
- engineer/owner prompt identity/wiring + delegation policy/dispatcher/delegated model step/subagent entrypoint;
- dynamic reservations + account/thread affinity + fresh-thread failover;
- protected no-failover after durable intent;
- strict intent/finalize;
- canonical Responses + compaction replay;
- retry/restart/exact replay;
- stream/non-stream/disconnect;
- ambiguous transport single-attempt;
- removed account fail-closed;
- TTL/size/oversize/stale retry >32;
- rollback floor;
- Codex shell-env secret exclusion;
- `verify_notion_final_gate_coverage.py` PASS using blob `b829c60e...`;
- `verify_notion_windows_ready_candidate.py` PASS using blob `3eccd05f...`.

## Codex shell-env safety

До live обязательно:
- `inherit="core"`;
- `ignore_default_excludes=false`;
- exclude `NOTION_BRIDGE_API_KEY`, `RUNTIME_STATE_KEY`.

Exact patch: `autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch` blob `5ae2079725886a180e130cfbb729365be56d8b59`.

## Persistent v4 memory

Последний доказанный канонический pointer в этом handoff остаётся `20260823T035422Z-2c69292246`, archive SHA-256 `8df2f2078b33304e3ca254d39938ecc415850284eec480be6249fd8f58fa1aa8`, pointer blob `d7084892eb86906e8ff3e1270168567def4b0a1e`.

Этот проход не двигает `LATEST`: новый результат уже долговечно лежит в control Git, а прошлый byte-readback capsule имел mismatch одного fetched part. Unknown bytes не реконструировать и CAS не обходить. Новый pointer публиковать только после полного точного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`.

## Следующий порядок

1. Fresh-read PR #8; при новом head drift снова re-freeze.
2. Собрать disposable exact tree с current Agent pair `c9ca6f3b.../ba52edc7...` и current 6672cc0 Agent test/prompt/delegation surface.
3. V50 `check/apply` использовать только как prerequisite.
4. На тех же bytes наложить unified Stage-B implementation V34/V35 + strict server intent/finalize + V41/V45 canonical buffered projection/restart safety.
5. Получить exact итоговые composed blob SHA и прогнать полный local/offline Agent+Core matrix.
6. Оба verifier-а обязаны PASS. Только тогда записать `READY_FOR_TARGETED_WINDOWS_CIRCLE`.
7. Запустить ОДИН targeted native Windows Server 2022 proof на тех же bytes. Не дублировать pending.
8. Targeted PASS -> full promoted Ubuntu+Windows/exact-source/security on same bytes.
9. После promoted green -> isolated encrypted runtime restore -> real Codex-only `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK` со стабильным conversation id через initial/tool-result/retry/restart.
10. Затем owner-doctor, tool inventory 100% discovered/support coverage, legitimate rotation/restart/crash, bounded soak -> `NOTION_CORE_DONE`.

В этом проходе product PR #7/#8, native Windows, live Notion/Codex, secrets, main/merge и production не менялись.
