# Notion — Windows + Codex ядро

## Точная текущая граница

- Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `autonomy/notion-prompt-modes-20260819`, exact head `4b344547d5e95bd4b3c62f5b80186059d849ff08`.
- Свежая owner-policy: Notion Circle connectivity уже доказана; reconnect не повторять. Offline/Linux Circle допустим по текущей политике. Native Windows Server 2022 — только после exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах.
- Product PR #7/#8, main/merge, live Notion/Codex, secrets и production из Core до соответствующего acceptance gate не менять.

## Ownership / claims

- Активный Core claim: `NOTION_CORE-20260823T1544Z`, expires `2026-08-23T17:14:00Z`, scope = same-byte Core Stage-B composition/local full matrix/coverage.
- Параллельный Agent claim: `NOTION_AGENT-20260823T1839MSK`, expires `2026-08-23T20:09:00+03:00`, scope = fresh exact Agent pair rematerialization/readback/compile/current-head Agent matrix.
- Пока Agent claim активен, Core не мутирует PR #8/materializers/pair и не дублирует их rematerialization. Core может менять только свою control/readiness поверхность.

## Exact Agent pair

Неподвижные product preimages на current Agent head:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes;
- `payload/conversation_segments.py` = `553bd3496c21a7949c3a5dfa03f33b9e09293213`.

Ранее independently byte-exact воспроизведён transformed account pool `c9ca6f3b4545e469966369a4220a6a2a60bf3697`; startup-cleanup root fix его не меняет.

Historical transformed server `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298` = **STALE_DO_NOT_PROMOTE**.

Current startup-cleanup materializer blob `20c2fb2e550daab52f3d27e791fa500002a73735` содержит accepted root fix. Fresh regressions independently green by Agent on Python 3.13:
- `tests/test_startup_status_repeated_cancellation.py` current blob prefix `9b649f7b...`: 2/2 PASS;
- `tests/test_startup_cleanup_failure_boundary_candidate.py` blob prefix `6a1a1523...`: 3/3 PASS;
- дополнительные cleanup RuntimeError/CancelledError/repeated-cancellation negative cases PASS.

До свежего transformed `server.py` blob+size+readback+compile и current-head Agent matrix старый `ba52...` не использовать ни в composition, ни в Stage-B, ни в Windows.

## Stage A / Stage B

Stage A ранее локально закрыт: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Stage-B store foundation ранее доказана на старой composition basis как `V34_V35_EXACT_CLASS_INTEGRATED_PASS`. Семантические инварианты сохраняются как требования, но full same-byte PASS автоматически на новый Agent materializer boundary не переносится.

Целевой порядок:
`local route/account acquisition -> strict intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

Обязательные границы:
- durable `provider_intent` до первого потенциального remote side effect; unresolved intent нельзя потерять по обычному TTL/eviction;
- после intent implicit account failover/network retry запрещён, включая Agent wrappers; deliberate planner correction разрешена отдельным шагом на том же аккаунте;
- exact rendered Responses/compaction replay хранит исходные `response_id/item_id/call_id`, restart/retry не вызывает provider второй раз;
- stream/non-stream — проекции одного сохранённого canonical response; до durable finalize не выдавать клиенту provider data/IDs;
- disconnect после provider-entered не отменяет commit-critical transaction; hard crash остаётся fail-closed через durable intent;
- removed account after restart -> fail-closed, без ghost reservation и тихого переноса старого Notion thread;
- `ConversationSegmentStore.get()` возвращает detached copy; persistence failure видим caller и откатывает memory;
- TTL/size/oversize/stale retry >32/context drift/empty-input/rollback floor входят в matrix;
- Codex child shell не получает `NOTION_BRIDGE_API_KEY`/`RUNTIME_STATE_KEY`.

## Final coverage / Windows readiness — current hardened bytes

Свежий Agent audit доказал новый acceptance gap: accepted startup-cleanup fix опирается на `tests.test_startup_cleanup_failure_boundary_candidate`, но предыдущий final coverage verifier мог PASS, не запуская эту регрессию. Windows readiness также не требовал отдельного результата этого boundary.

Core независимо воспроизвёл gap и проверил exact Agent-provided candidates:
- old coverage blob `76ebba1f...` без новой regression -> synthetic PASS (небезопасно);
- new coverage без regression -> NOT_READY; с regression -> PASS;
- new readiness full synthetic manifest -> READY; без cleanup-failure gate -> NOT_READY; со старым coverage blob -> NOT_READY;
- оба кандидата компилируются; локальные Git blob SHA точно совпали с Agent handoff.

Канонические control bytes теперь:
- `autonomy/v3/tools/verify_notion_final_gate_coverage.py` = `42cdae4c422068153f41697f063cf8a1cc28e8f9`;
- `autonomy/v3/tools/verify_notion_windows_ready_candidate.py` = `c54866cba891fa81c38a399b0b5741b708c008aa`;
- readiness schema остаётся `notion_windows_ready_candidate_v4`, но теперь pin-ит coverage `42cdae4c...` и требует gate `agent_startup_cleanup_failure_boundary=PASS`.

Durable evidence: `autonomy/evidence/notion/20260823T1558Z_startup_cleanup_failure_gate_hardening.json`.

Final same-byte suite обязательно включает Agent materializer/journal/tombstone/dynamic reservation, startup cleanup + cleanup-failure boundary + repeated cancellation, `test_subagent_tombstone_post_replace_sync_failure.py`, restart/delegated cancellation, prompt engineer/owner identity/wiring, delegation policy/dispatcher/model step/subagent entrypoint, routing/affinity/fresh-thread failover, Core strict intent/finalize, canonical Responses+compaction replay, retry/restart/tool-call, stream/non-stream/disconnect, ambiguous transport, removed account, TTL/size/oversize/stale retry >32, rollback floor и Codex shell-env secret exclusion.

## Следующий обязательный порядок

1. Fresh-read PR #8/#9. Если Agent head/materializer меняется — freeze inputs заново; stale transformed bytes/gates не переносить.
2. Получить от Agent свежую exact transformed pair после startup fix: оба файла должны иметь blob SHA + size + readback + compile + current-head Agent matrix. Частичный handoff не реконструировать.
3. На этой exact pair наложить только канонический Core Stage-B и прогнать полный Agent+Core same-byte local matrix.
4. Final coverage `42cdae4c...` и readiness `c54866cb...` должны PASS на exact manifest этих же байтов.
5. Только после этого запустить ровно один targeted native Windows Server 2022 proof. Pending не дублировать; historical PR #7 Windows не является доказательством новой composition.
6. Targeted PASS -> full promoted Ubuntu+Windows/exact-source/security на тех же bytes.
7. После promoted green -> isolated encrypted runtime restore -> real Codex-only `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK` со стабильным conversation id через initial/tool-result/retry/restart.
8. Затем owner-doctor, полный discovered/supported tool coverage, legitimate account rotation/restart/crash и bounded soak -> `NOTION_CORE_DONE`.

## Persistent v4 memory

Не переключать `LATEST` без полного точного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Unknown bytes не реконструировать. Текущий результат уже долговечно записан в control Git/evidence/handoff, поэтому отсутствие нового capsule pointer его не теряет.
