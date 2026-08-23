# Notion — Windows + Codex ядро

## Точная текущая граница

- Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `autonomy/notion-prompt-modes-20260819`, exact head `4b344547d5e95bd4b3c62f5b80186059d849ff08`.
- Circle connectivity для Notion уже доказана. Reconnect не повторять.
- Native Windows Server 2022 запрещён до exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах.
- PR #7/#8 product refs, main/merge, live Notion/Codex, аккаунты, секреты и production до соответствующего acceptance gate не менять.

## Exact Agent pair — исправление 23.08

Frozen preimages текущего Agent head:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes;
- `payload/conversation_segments.py` = `553bd3496c21a7949c3a5dfa03f33b9e09293213`, 10758 bytes.

Канонический Agent release `NOTION_AGENT-20260823T2048Z` исправил прежнюю ошибку идентичности server target:
- `payload/account_pool.py` -> FINAL `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `payload/server.py` после `apply_startup_status_cleanup.py` -> INTERMEDIATE `5c04b8cce34b29e63bf1839d59476f8081763c2b`, 115901 bytes;
- `payload/server.py` после канонического tombstone wrapper -> FINAL `273db94a8f9b153e95c910df221755e28c0f46a7`, 116047 bytes.

`5c04.../116047` — ошибочная старая пара SHA/size и запрещена как final identity. `ba52edc7a8528d58acd2c5bef2b86c3ca84ca298` — исторический stale server, тоже запрещён к продвижению.

Exact recipe blobs:
- account materializer `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- startup cleanup `20c2fb2e550daab52f3d27e791fa500002a73735`;
- tombstone wiring `40ab3a448e33fb8a8c3ce045ef31a815d0554823`;
- pair materializer `30fb89286eb4457b25b2145918279fec2d735042`;
- canonical wrapper `859039a5e408bc84e7046372cdb509131eb37a97`.

Durable Agent correction evidence: `autonomy/evidence/notion/20260823T2340Z_agent_exact_pair_target_correction.json`, blob `b9bfe72ced54c3ed5a39100b9d65bf5d163bbaa8`.

Target transformed hashes сами по себе не являются materialization proof. Core обязан byte-exact воспроизвести их из frozen preimages + recipe, сделать readback/blob+size+compile и держать эти байты reachable в единой composition/evidence.

## Corrected delegated five-file set

Использовать только:
- `delegation_policy.py` `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `delegation_dispatcher.py` `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `notion_delegated_model_step.py` `f36e9c91355dec667173b6265dd550554fb0f05d`;
- `subagent_entrypoint.py` `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`;
- `server_subagent_lifecycle.py` `f47838b338f2bd94163cf466110f939c065ac041`.

Superseded launch candidate `aebefce4ff3e47efc9813ce4e49e70ca8c44972f` не использовать.

## Stage A / Stage B

Stage A локально закрыт: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Stage-B store foundation ранее была доказана как `V34_V35_EXACT_CLASS_INTEGRATED_PASS`, но full PASS на свежую Agent pair автоматически не переносится.

### Fresh exact store candidate — 23.08 21:10Z

Core независимо взял exact текущий `payload/conversation_segments.py` blob `553bd3496c21a7949c3a5dfa03f33b9e09293213` / 10758 bytes и собрал store-only Stage-B candidate:
- candidate Git blob `96c4bdfbf08b8171833691de32e16d4960b6e7e9`;
- 24664 bytes;
- compile PASS;
- продуктовые refs не менялись.

На локальном NCM28-compatible harness зелёные 23 сценария: v2→v3 strict upgrade; durable provider intent; duplicate unresolved intent; atomic finalize; restart exact replay с тем же `call_id`; intent/finalize write failure rollback; detached `get()`; replay TTL; unresolved intent survives ordinary TTL/eviction; separate capacity fail-closed; wrong account/fingerprint finalize; future-version fail-closed; cleanup write failure rollback+blocked state; oversize no-mutation; bounded 32 completed fingerprints; 8 MiB replay-budget eviction с сохранением stale fingerprint.

Verdict: `LOCAL_STAGE_B_STORE_CANDIDATE_PASS`, **не** full Stage-B PASS. Durable evidence: `autonomy/evidence/notion/20260823T2110Z_stageb_store_exact_candidate.json`.

Целевой серверный порядок остаётся:
`local route/account acquisition -> strict provider_intent -> deliberate provider steps without implicit failover/retry -> one canonical Responses/compaction payload -> strict atomic finalize(progress + exact payload + clear intent) -> memory cache/affinity -> validated reservation rehydrate/clear -> JSON/SSE projection`.

Обязательные границы полной Stage-B:
- unresolved `provider_intent` записан до первого возможного remote side effect и не теряется ordinary TTL/eviction;
- после intent implicit account failover/network retry запрещён; deliberate planner correction разрешена отдельным шагом на том же аккаунте;
- exact Responses/compaction replay сохраняет исходные `response_id/item_id/call_id`; restart/retry не вызывает provider второй раз;
- stream/non-stream — проекции одного durable canonical result; до finalize клиенту не выдаются provider data/IDs;
- disconnect после provider-entered не отменяет commit-critical transaction; hard crash fail-closed через durable intent;
- removed account after restart -> fail-closed без ghost reservation/тихого переноса старого Notion thread;
- persistence failure видим caller и откатывает memory;
- TTL/size/oversize/stale retry >32/context drift/empty-input/rollback floor входят в matrix;
- Codex child shell не получает `NOTION_BRIDGE_API_KEY`/`RUNTIME_STATE_KEY`.

## Final coverage / Windows readiness

Канонический final coverage verifier:
- `autonomy/v3/tools/verify_notion_final_gate_coverage.py` = `2df0e51ab385d003b2cbdf9126aad0176d62bed6`;
- commit `cc2e81743cda251911617cf5ebe68061a8de68df`.

Он обязан видеть весь mandatory Agent набор, включая delegation/tool-loop/runtime-validation/uncertain-failover/synthetic-call-ids/thread-reentry/dynamic-reservations/subagent-runtime/server-reservations/reservation-aware-lease/cooldown-failover/subagent-lifecycle и startup/tombstone/restart/cancellation regressions из свежего `NOTION_AGENT.md`.

Windows readiness v5:
- `autonomy/v3/tools/verify_notion_windows_ready_candidate.py` = `d6fde58cc908d5cbab553aef887422f86aa82fbb`;
- commit `147f1442ff12292d2827b333d95cbbca86d7855a`;
- schema `notion_windows_ready_candidate_v5`;
- pin final coverage = `2df0e51ab385d003b2cbdf9126aad0176d62bed6`;
- `--candidate-root` обязан сам сверить manifest с реальными candidate bytes и отвергать missing/symlink/tampered files.

Это **не** real Windows readiness: unified same-byte Stage-B candidate ещё не собран.

## Финальный same-byte suite

На одних composed bytes обязательны:
- Agent materializer/journal/tombstone/dynamic reservation;
- startup cleanup + cleanup-failure boundary + repeated cancellation;
- post-replace tombstone sync failure + tombstone restart + delegated cancellation;
- prompt engineer/owner identity/wiring;
- весь mandatory delegation/tool-loop/subagent/routing/failover Agent набор;
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

1. Fresh-read PR #8/#9; при head/materializer drift заморозить inputs заново.
2. Byte-exact воспроизвести исправленную FINAL Agent pair `c9ca6f3b.../48066 + 273db94a.../116047`; blob+size+readback+compile; сохранить reachable same-byte evidence.
3. Добавить corrected delegated five-file set и прогнать полный mandatory Agent matrix.
4. На **этих же** байтах применить канонический Core Stage-B store/server integration и прогнать full Agent+Core matrix. Store-only candidate `96c4bdf...` — лишь подготовленный слой, не acceptance.
5. Coverage `2df0e51a...` PASS на exact suite.
6. Readiness `d6fde58c... --candidate-root <exact composed tree>` PASS.
7. Только затем ровно один targeted native Windows Server 2022 proof. Historical PR #7 Windows и stale PR #23 не доказательство новой composition.
8. Targeted PASS -> full promoted Ubuntu+Windows/exact-source/security gate на тех же bytes.
9. После promoted green -> isolated encrypted runtime restore -> real Codex-only `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK` со стабильным conversation id initial/tool-result/retry/restart.
10. Затем owner-doctor, discovered/supported tool coverage, legitimate account rotation/restart/crash и bounded soak -> `NOTION_CORE_DONE`.

## Persistent v4 memory

Не переключать `LATEST` без полного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Unknown bytes не реконструировать. Текущие результаты долговечно записаны в Git evidence/handoff/#9; отсутствие нового capsule pointer не является потерей результата.
