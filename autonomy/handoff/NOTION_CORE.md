# Notion — Windows + Codex ядро

## Точная текущая граница

- Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `autonomy/notion-prompt-modes-20260819`, exact head `4b344547d5e95bd4b3c62f5b80186059d849ff08`.
- Circle connectivity для Notion уже доказана. Reconnect не повторять.
- Native Windows Server 2022 запрещён до exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах.
- PR #7/#8 product refs, main/merge, live Notion/Codex, аккаунты, секреты и production до соответствующего acceptance gate не менять.

## Fresh exact Agent handoff

Frozen preimages current Agent head:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes;
- `payload/conversation_segments.py` = `553bd3496c21a7949c3a5dfa03f33b9e09293213`.

Current deterministic transformed pair after accepted startup-cleanup fix:
- `payload/account_pool.py` -> `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `payload/server.py` -> `5c04b8cce34b29e63bf1839d59476f8081763c2b`, 116047 bytes.

Historical transformed server `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298` = **STALE_DO_NOT_PROMOTE**.

Exact recipe blobs:
- account materializer `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- startup cleanup `20c2fb2e550daab52f3d27e791fa500002a73735`;
- tombstone wiring `40ab3a448e33fb8a8c3ce045ef31a815d0554823`;
- pair materializer `30fb89286eb4457b25b2145918279fec2d735042`;
- canonical wrapper `859039a5e408bc84e7046372cdb509131eb37a97`.

Target transformed blobs currently are not durable materialization by themselves: Core must reproduce exact bytes from the frozen preimages+recipe, verify blob+size+compile/readback, and keep them reachable in the same-byte composition/evidence before Stage-B.

Corrected delegated five-file set from Agent:
- `delegation_policy.py` `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `delegation_dispatcher.py` `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `notion_delegated_model_step.py` `f36e9c91355dec667173b6265dd550554fb0f05d`;
- `subagent_entrypoint.py` `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`;
- `server_subagent_lifecycle.py` `f47838b338f2bd94163cf466110f939c065ac041`.

Superseded launch candidate `aebefce4ff3e47efc9813ce4e49e70ca8c44972f` не использовать.

## Stage A / Stage B

Stage A локально закрыт: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Stage-B store foundation ранее доказана как `V34_V35_EXACT_CLASS_INTEGRATED_PASS`, но full PASS автоматически на fresh Agent pair не переносится. Нужен один unified same-byte candidate.

Целевой порядок:
`local route/account acquisition -> strict provider_intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

Обязательные границы:
- unresolved `provider_intent` сохраняется до первого возможного remote side effect и не теряется обычным TTL/eviction;
- после intent implicit account failover/network retry запрещён, deliberate planner correction разрешена отдельным шагом на том же аккаунте;
- exact Responses/compaction replay сохраняет исходные `response_id/item_id/call_id`; restart/retry не вызывает provider второй раз;
- stream/non-stream — проекции одного сохранённого canonical result; до durable finalize клиенту не выдаются provider data/IDs;
- disconnect после provider-entered не отменяет commit-critical transaction; hard crash fail-closed через durable intent;
- removed account after restart -> fail-closed без ghost reservation и тихого переноса старого Notion thread;
- `ConversationSegmentStore.get()` возвращает detached copy; persistence failure видим caller и откатывает memory;
- TTL/size/oversize/stale retry >32/context drift/empty-input/rollback floor входят в matrix;
- Codex child shell не получает `NOTION_BRIDGE_API_KEY`/`RUNTIME_STATE_KEY`.

## Final coverage — fail-open закрыт 23.08

Предыдущий verifier `42cdae4c422068153f41697f063cf8a1cc28e8f9` давал ложный PASS, если final suite не запускал 10 уже существующих обязательных Agent-модулей.

Новый канонический verifier:
- `autonomy/v3/tools/verify_notion_final_gate_coverage.py` = `2df0e51ab385d003b2cbdf9126aad0176d62bed6`;
- commit `cc2e81743cda251911617cf5ebe68061a8de68df`.

Дополнительно обязательны:
- `tests.test_delegated_tool_loop_runtime_validation`
- `tests.test_delegated_uncertain_failover_boundary`
- `tests.test_notion_delegated_synthetic_call_ids`
- `tests.test_notion_delegated_thread_reentry`
- `tests.test_notion_delegation_dynamic_reservations`
- `tests.test_notion_subagent_runtime`
- `tests.test_notion_subagent_server_reservations`
- `tests.test_reservation_aware_lease`
- `tests.test_responses_cooldown_failover`
- `tests.test_subagent_lifecycle`

Локальная проверка exact нового verifier: synthetic suite без этих 10 модулей -> `NOT_READY` и перечисляет ровно эти 10; полный synthetic suite -> `PASS`.

Durable evidence: `autonomy/evidence/notion/20260823T1855Z_final_gate_coverage_full_agent_matrix_hardening.json`.

## Windows readiness v5 — pin обновлён

Readiness по-прежнему exact-byte bind'ит manifest к фактическому candidate tree через `--candidate-root`, сам вычисляет Git blob SHA required files и отвергает missing/symlink/tampered bytes.

Текущий verifier после обновления pin:
- `autonomy/v3/tools/verify_notion_windows_ready_candidate.py` = `d6fde58cc908d5cbab553aef887422f86aa82fbb`;
- commit `147f1442ff12292d2827b333d95cbbca86d7855a`;
- schema `notion_windows_ready_candidate_v5`;
- обязательный final coverage verifier blob = `2df0e51ab385d003b2cbdf9126aad0176d62bed6`.

Self-review pin boundary: manifest со старым coverage blob -> `NOT_READY`; с новым pin и полностью заполненным synthetic exact candidate -> `READY_FOR_TARGETED_WINDOWS_CIRCLE`.

Это **не real Windows readiness**: unified Stage-B candidate ещё не собран и native Windows не запускался.

## Финальный same-byte suite

Обязательно на одних и тех же composed bytes:
- Agent materializer/journal/tombstone/dynamic reservation;
- startup cleanup + cleanup-failure boundary + repeated cancellation;
- `test_subagent_tombstone_post_replace_sync_failure.py`, tombstone restart, delegated cancellation;
- prompt engineer/owner identity/wiring;
- delegation policy/dispatcher/model step/subagent entrypoint и весь обязательный Agent набор из текущего `NOTION_AGENT.md`;
- routing/affinity/fresh-thread failover;
- Core strict intent/finalize;
- canonical Responses + compaction replay;
- retry/restart/tool-call;
- stream/non-stream/disconnect;
- ambiguous transport single attempt;
- removed account;
- TTL/size/oversize/stale retry >32;
- rollback floor;
- Codex shell-env secret exclusion.

## Следующий обязательный порядок

1. Fresh-read PR #8/#9. При head/materializer drift заморозить inputs заново; stale bytes/gates не переносить.
2. Byte-exact воспроизвести fresh Agent pair `c9ca... / 5c04...`, проверить blob+size+readback+compile и сохранить reachable same-byte evidence.
3. Добавить corrected delegated five-file set и прогнать полный mandatory Agent matrix.
4. На этих же байтах применить только канонический Core Stage-B и прогнать полный Agent+Core same-byte local matrix.
5. Final coverage `2df0e51a...` должен PASS на exact suite.
6. Readiness v5 `d6fde58c... --candidate-root <exact composed tree>` должен подтвердить manifest↔candidate byte binding и все PASS gates.
7. Только затем ровно один targeted native Windows Server 2022 proof. Pending не дублировать; historical PR #7 Windows не является доказательством новой composition.
8. Targeted PASS -> full promoted Ubuntu+Windows/exact-source/security gate на тех же bytes.
9. После promoted green -> isolated encrypted runtime restore -> real Codex-only `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK` со стабильным conversation id initial/tool-result/retry/restart.
10. Затем owner-doctor, discovered/supported tool coverage, legitimate account rotation/restart/crash и bounded soak -> `NOTION_CORE_DONE`.

## Persistent v4 memory

Не переключать `LATEST` без полного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Unknown bytes не реконструировать. Текущий результат долговечно записан в Git evidence/handoff/#9, поэтому отсутствие нового capsule pointer его не теряет.
