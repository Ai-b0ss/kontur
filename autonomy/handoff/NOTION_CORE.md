# Notion — Windows + Codex ядро

## Точная текущая граница

- Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `autonomy/notion-prompt-modes-20260819`, exact head `4441bbab44f65e8898fae970c26aa55aa91c5e96` на 2026-08-23 12:49 UTC.
- Текущий owner-policy: Notion Circle connectivity уже доказана; reconnect probe не повторять. Native Windows Server 2022 разрешён только после exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах.
- Product PR #7/#8, main/merge, live Notion/Codex, secrets и production в текущем Core-проходе не менять.

## Активная работа / ownership

`CLAIM generation=v3 pulse=NOTION_CORE-20260823T1145Z lane=NOTION mode=WRITE expires=2026-08-23T13:15:00Z` владеет exact Agent+Core same-byte Stage-B composition/local Linux. NOTION_AGENT увидел claim и не делал пересекающуюся product/materialization mutation.

## Exact Agent pair — старый server output больше не годится для продвижения

Ранее byte-exact воспроизведено:
- `payload/account_pool.py`: source `11cea792a2f5aaa40ee1515faddfd44e76cbb23f` -> Agent transformed `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, compile PASS;
- `payload/server.py`: source `f02cef6a0ffc202c75fbe71c520c72ac19ff876d` -> прежний Agent transformed `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298`.

Но на fresh PR #8 найден и воспроизведён реальный safety bug в materializer `tools/apply_startup_status_cleanup.py`, exact blob `2ed85ece7d3323b1619ec0963d3021c1623d0e0a`.

Дефект: `STATUS_REPLACEMENT` ждёт `await asyncio.shield(cleanup_task)` и ловит только `asyncio.CancelledError`. Если `new_pool.aclose()` сам падает, его исключение вырывается из `shield()` раньше, чем `cleanup_task.result()` успевает сохранить исходный startup `CancelledError` как основной. Cleanup error маскирует исходную startup failure.

Точный минимальный fix уже существует как unreferenced Git blob:
- patch `98dd78481736ba04d56bbcdf3615c49772e5ec12`;
- standalone regression `6a1a15235c399f4d7cc07d2bb9f63c45596ac257`.

Core повторно прогнал regression локально на Python 3.13: **3/3 PASS**:
1. cleanup failure сохраняет startup cancellation основным исключением;
2. повторная cancellation не прерывает успешный cleanup;
3. повторная cancellation + cleanup failure сохраняет исходную cancellation основной, cleanup — cause.

Следствие: старый transformed `server.py=ba52edc7...` теперь **STALE_DO_NOT_PROMOTE**. Перед V50/Stage-B/Windows нужно заново материализовать exact server из source `f02cef6a...` с исправленным materializer, получить новый exact Git blob/size/readback и compile PASS.

Durable evidence: `autonomy/evidence/notion/20260823T1249Z_startup_cleanup_materializer_current_head_blocker.json` (control commit `a91dbb9fc270f70006acfe2cce7dc890fdd63e20`).

## Stage A / Stage B — что уже доказано и что не переносить автоматически

Stage A ранее локально закрыт: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Stage-B store foundation ранее доказана на старой composition basis как `V34_V35_EXACT_CLASS_INTEGRATED_PASS`: strict `provider_intent`, persisted replay IDs, restart, detached get, unresolved duplicate fail-closed, NCM28 write rollback/block, TTL cleanup/tombstone.

Эти semantic invariants сохраняются как требования, но **full same-byte Stage-B PASS не переносится** через новый materializer defect. Unified current-head candidate ещё не материализован.

Целевой порядок остаётся:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

Обязательные границы:
- protected Core после durable intent запрещает implicit account failover/retry через Agent wrappers;
- deliberate planner correction разрешена как отдельный шаг на том же аккаунте;
- stream/non-stream — проекции одного сохранённого canonical response;
- disconnect после provider-entered не отменяет commit-critical transaction;
- removed account после restart — fail-closed без ghost reservation/тихого переноса старого Notion thread;
- compaction имеет ту же durable replay границу;
- old/stale retry, TTL/size/oversize и rollback floor входят в local matrix.

## Final coverage / Windows readiness

Final coverage verifier:
- `autonomy/v3/tools/verify_notion_final_gate_coverage.py`;
- required blob `b829c60e073d87cd04d31e30426cdcc8f3de7db0`.

Windows readiness verifier:
- `autonomy/v3/tools/verify_notion_windows_ready_candidate.py`;
- schema `notion_windows_ready_candidate_v3`;
- required blob `3eccd05fd3cfd84f8ebf35bd11f644bc73759632`.

Final same-byte matrix обязательно включает Agent materializer/journal/tombstone/dynamic reservation, `test_subagent_tombstone_post_replace_sync_failure.py`, server restart/delegated cancellation, prompt engineer/owner identity/wiring, delegation policy/dispatcher/model step/subagent entrypoint, routing/affinity/fresh-thread failover, Core strict intent/finalize, canonical Responses+compaction replay, retry/restart/tool-call, stream/non-stream/disconnect, ambiguous transport, removed account, TTL/size/oversize/stale retry >32, rollback floor и Codex shell-env secret exclusion.

До live Codex обязательна shell-env policy: `inherit="core"`, `ignore_default_excludes=false`, explicit exclude `NOTION_BRIDGE_API_KEY` и `RUNTIME_STATE_KEY`.

## Следующий обязательный порядок

1. Fresh-read PR #8; при head drift stale-stop и re-freeze exact inputs.
2. На exact source `f02cef6a...` применить исправленный startup materializer (`2ed85...` + exact patch `98dd78...`) и остальные канонические Agent transforms в установленном порядке.
3. Получить новый exact transformed `server.py` blob/size/readback + compile PASS. Старый `ba52edc7...` не использовать.
4. На той же exact pair наложить канонический Core Stage-B и прогнать полный Agent+Core local matrix.
5. Оба verifier-а должны PASS на manifest этих же байтов. Только тогда `READY_FOR_TARGETED_WINDOWS_CIRCLE`.
6. Запустить ровно один targeted native Windows Server 2022 proof на тех же bytes. Pending не дублировать.
7. Targeted PASS -> full promoted Ubuntu+Windows/exact-source/security на тех же bytes.
8. После promoted green -> isolated encrypted runtime restore -> real Codex-only `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK` со стабильным conversation id через initial/tool-result/retry/restart.
9. Затем owner-doctor, 100% discovered/support tool coverage, legitimate account rotation/restart/crash и bounded soak -> `NOTION_CORE_DONE`.

## Persistent v4 memory

Не переключать `LATEST` без полного точного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Unknown bytes не реконструировать. Новый current-head blocker уже долговечно сохранён в control Git, поэтому отсутствие нового capsule pointer не теряет этот результат.
