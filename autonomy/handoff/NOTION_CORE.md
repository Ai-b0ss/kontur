# Notion — Windows + Codex ядро

## Точная текущая граница

- Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `autonomy/notion-prompt-modes-20260819`, exact head `e2f6b69c910b41423e822f573f489a90eb78d14b` на 2026-08-23 14:05 UTC.
- Diff `4441bbab... -> e2f6b69c...`: ровно один commit, изменён только `tests/test_live_two_slot_probe_contract.py`; product/materializer bytes не менялись.
- Свежая owner-policy: Notion Circle connectivity уже доказана, reconnect не повторять. Offline/Linux Circle разрешён. Native Windows Server 2022 — только после exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах.
- Product PR #7/#8, main/merge, live Notion/Codex, secrets и production из Core до соответствующего acceptance gate не менять.

## Ownership / claims

Core claim: `NOTION_CORE-20260823T1347Z`, scope только control/readiness hardening. Он явно не пересекается с Agent product/materializer/server-pair работой.

Свежий Agent-проход подтвердил на exact head `e2f6b69c...`: текущий `tools/apply_startup_status_cleanup.py` всё ещё воспроизводимо содержит startup-cleanup exception-priority bug. Agent владеет исправлением/рематериализацией; Core туда параллельно не пишет.

## Exact Agent pair — старый server output запрещён к продвижению

Неподвижные исходники текущего PR #8:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes;
- `payload/conversation_segments.py` = `553bd3496c21a7949c3a5dfa03f33b9e09293213`.

Ранее independently byte-exact воспроизведён Agent account-pool output `c9ca6f3b4545e469966369a4220a6a2a60bf3697`.

Старый transformed server `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298` = **STALE_DO_NOT_PROMOTE**.

Причина: текущий materializer `tools/apply_startup_status_cleanup.py` blob `2ed85ece7d3323b1619ec0963d3021c1623d0e0a` ждёт `await asyncio.shield(cleanup_task)` и ловит только `CancelledError`. Если `new_pool.aclose()` падает, cleanup exception может выйти раньше `cleanup_task.result()` и замаскировать исходный startup `CancelledError`.

Текущие product tests на exact head:
- `tests/test_startup_status_cleanup.py` = `2cf5ad1f351239823172335cac475d34a19447e2`;
- `tests/test_startup_status_repeated_cancellation.py` = `88a7b477ba623f4858760330a52963e8765b8e65`.

Свежий Agent RELEASE сохранил latest unreferenced fix/evidence blobs без движения PR #8:
- patch `99831c8058afa36e61b0f16718a4273453ab79f4`;
- focused regression `e3eace2d9872602f77d05db1f073fc836f09503b`.

До нового exact transformed server blob/size/readback/compile и Agent matrix старый `ba52...` не использовать ни в V50, ни в Stage-B, ни в Windows.

## Stage A / Stage B

Stage A ранее локально закрыт: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Stage-B store foundation ранее доказана на старой composition basis как `V34_V35_EXACT_CLASS_INTEGRATED_PASS`. Семантические инварианты сохраняются как требования, но full same-byte PASS через новый materializer boundary не переносится.

Целевой порядок:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

Обязательные границы:
- после durable intent implicit account failover/retry запрещён, включая Agent wrappers;
- deliberate planner correction разрешена отдельным шагом на том же аккаунте;
- stream/non-stream — проекции одного сохранённого canonical response;
- disconnect после provider-entered не отменяет commit-critical transaction;
- removed account после restart — fail-closed без ghost reservation и тихого переноса старого Notion thread;
- compaction имеет ту же durable replay границу;
- old/stale retry, TTL/size/oversize, rollback floor и Codex shell-env secret exclusion входят в local matrix.

## Final coverage / Windows readiness — усилено 2026-08-23

Новый final coverage verifier:
- path `autonomy/v3/tools/verify_notion_final_gate_coverage.py`;
- exact blob `76ebba1f3e7cb4e7d2fa49d46868cac24b555535`;
- теперь обязательно требует в финальном same-byte suite также `tests.test_startup_status_cleanup` и `tests.test_startup_status_repeated_cancellation`.

Новый Windows readiness verifier:
- path `autonomy/v3/tools/verify_notion_windows_ready_candidate.py`;
- schema `notion_windows_ready_candidate_v4`;
- exact blob `76ff15f78f158bbfa1a5c148ed4ee54be6128714`;
- pin final coverage blob `76ebba1f...`;
- дополнительно требует `agent_startup_status_cleanup=PASS` и `agent_startup_status_repeated_cancellation=PASS`.

Offline negative/positive self-test: complete synthetic suite/manifest PASS; отсутствие startup cleanup file, отсутствие repeated-cancellation из suite, старый readiness schema, отсутствие нового gate и неверный coverage blob — fail-closed как ожидается. Python compile кандидатов PASS.

Durable evidence: `autonomy/evidence/notion/20260823T1405Z_startup_cleanup_final_gate_hardening.json`.

Final same-byte matrix обязательно включает Agent materializer/journal/tombstone/dynamic reservation, startup cleanup + repeated cancellation, `test_subagent_tombstone_post_replace_sync_failure.py`, restart/delegated cancellation, prompt engineer/owner identity/wiring, delegation policy/dispatcher/model step/subagent entrypoint, routing/affinity/fresh-thread failover, Core strict intent/finalize, canonical Responses+compaction replay, retry/restart/tool-call, stream/non-stream/disconnect, ambiguous transport, removed account, TTL/size/oversize/stale retry >32, rollback floor и Codex shell-env secret exclusion.

## Следующий обязательный порядок

1. Fresh-read PR #8 и #9. Если Agent head/materializer меняется — freeze exact inputs заново, старые transformed bytes не переносить автоматически.
2. Дождаться/забрать от Agent исправленный current-head startup materializer и новый exact transformed `server.py`: blob + size + readback + compile + Agent/delegation/tombstone matrix.
3. На той же exact pair наложить канонический Core Stage-B и прогнать полный Agent+Core local matrix.
4. Final coverage `76eb...` и readiness v4 `76ff...` должны PASS на manifest этих же байтов.
5. Только после этого запустить ровно один targeted native Windows Server 2022 proof. Pending не дублировать.
6. Targeted PASS -> full promoted Ubuntu+Windows/exact-source/security на тех же bytes.
7. После promoted green -> isolated encrypted runtime restore -> real Codex-only `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK` со стабильным conversation id через initial/tool-result/retry/restart.
8. Затем owner-doctor, полный discovered/supported tool coverage, legitimate account rotation/restart/crash и bounded soak -> `NOTION_CORE_DONE`.

## Persistent v4 memory

Не переключать `LATEST` без полного точного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Unknown bytes не реконструировать. Текущий результат долговечно записан в control Git/evidence и handoff, поэтому отсутствие нового capsule pointer его не теряет.
