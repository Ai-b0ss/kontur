# Notion — Windows + Codex ядро

## Точная текущая граница

- Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `autonomy/notion-prompt-modes-20260819`, exact head `4b344547d5e95bd4b3c62f5b80186059d849ff08`.
- Circle connectivity для Notion уже доказана; reconnect не повторять.
- Native Windows Server 2022 запрещён до exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах.
- PR #7/#8 product refs, main/merge, live Notion/Codex, аккаунты, секреты и production до соответствующего acceptance gate не менять.

## Координация

NOTION_AGENT claim `5389444767` после heartbeat владеет только exact transformed pair rematerialization/readback + mandatory Agent matrix до `2026-08-24 05:10 MSK`; Core эту поверхность не дублирует. Текущий Core claim занимается только Stage-B store/transaction/SSE projection evidence.

## Exact Agent pair

Frozen preimages:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes;
- `payload/conversation_segments.py` = `553bd3496c21a7949c3a5dfa03f33b9e09293213`, 10758 bytes.

Каноническая transformed pair:
- `payload/account_pool.py` FINAL `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `payload/server.py` after startup cleanup INTERMEDIATE `5c04b8cce34b29e63bf1839d59476f8081763c2b`, 115901 bytes;
- `payload/server.py` after canonical tombstone wrapper FINAL `273db94a8f9b153e95c910df221755e28c0f46a7`, 116047 bytes.

`5c04.../116047` и historical `ba52edc7...` запрещены как final server identity.

Exact recipe blobs:
- account materializer `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- startup cleanup `20c2fb2e550daab52f3d27e791fa500002a73735`;
- tombstone wiring `40ab3a448e33fb8a8c3ce045ef31a815d0554823`;
- pair materializer `30fb89286eb4457b25b2145918279fec2d735042`;
- canonical wrapper `859039a5e408bc84e7046372cdb509131eb37a97`.

## Corrected delegated five-file set

Использовать только:
- `delegation_policy.py` `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `delegation_dispatcher.py` `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `notion_delegated_model_step.py` `f36e9c91355dec667173b6265dd550554fb0f05d`;
- `subagent_entrypoint.py` `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`;
- `server_subagent_lifecycle.py` `f47838b338f2bd94163cf466110f939c065ac041`.

Scratch/superseded blobs не использовать.

## Stage A + durable Stage-B store

Stage A: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Durable Stage-B store на exact `conversation_segments.py=553bd349...`:
- Git identity `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`;
- 24882 bytes;
- SHA-256 `94b75ccbe3244bba25e5357cfef502aacb18cb54ad5b8093b220ae03006e2056`;
- `py_compile` PASS;
- targeted recovery/replay 16/16 PASS.

Manifest exact bytes: `autonomy/evidence/notion/20260824T0345Z_stageb_store_candidate/manifest.json`, blob `b54de4c99f4bf741b3c96e1598a97dec0ed6b0a7`.

Contract: state v3 reads legacy v2; strict fail-closed writes; durable `provider_intent`; exact request/context identity incl. empty input; atomic finalize stores canonical rendered payload and clears matching intent; exact replay preserves `response_id/item_id/call_id`; detached `get()`; rollback on NCM28 write failure; replay 512 KiB/item, 8 MiB total, 6h TTL; unresolved intents survive ordinary TTL/eviction and cap at 128; completed fingerprint ring 32 + stale-prefix protection.

## Stage-B transaction helper

`autonomy/evidence/notion/20260824T0403Z_stageb_transaction_helper.py` = blob `b3fe792b99daad678e3c773db291576bdf179167`, 7451 bytes, readback + `py_compile` PASS.

Local helper 12/12 PASS; exact store+helper integration 11/11 PASS. Required order:
`local route acquisition -> strict provider_intent -> deliberate same-account provider steps without implicit failover/retry -> canonical render -> strict atomic finalize -> ephemeral cache/affinity/reservation -> client`.

Covered: intent/finalize write failure, ambiguous provider outcome, restart exact replay, post-finalize ephemeral failure recovery, removed account fail-closed, disconnect/shutdown ownership, compaction replay, intent capacity and deliberate correction.

## Neutral precommit SSE keepalive — exact execution closed

Keepalive candidate:
- `autonomy/evidence/notion/20260824T0413Z_stageb_sse_keepalive_candidate.py`;
- Git blob `b4333b830ee62915a747d202174f657b26342d85`;
- 1374 bytes;
- SHA-256 `53afa5dcc15a73edfc5b3c4a567ddf3f3b9ae593471590a85c4301dbb92ead79`.

While durable commit is pending it emits only neutral SSE comment `: stageb-commit-pending\n\n`; no `resp_`, `call_`, `fc_`, tool/provider payload or protocol result before finalize. Client cancellation owns only the projection, not the server-owned commit task. Transaction failure propagates without fabricated Responses payload.

The previous presentation/execution attribution gap is now closed by an exact readback regression:
- `autonomy/evidence/notion/20260824T0447Z_test_stageb_sse_keepalive_exact.py`;
- Git blob `4a8b80c160a79cf9c3bc7d5bfdb6fe5740b210e0`;
- 5505 bytes;
- SHA-256 `d0c5768a738fd4e3366bf6cd7963ee6ca9f7251fcade69692ca1ae52c4fdccca`;
- exact candidate `b4333b83...` + exact regression compiled and executed on Python 3.13: `STAGEB_SSE_KEEPALIVE_EXACT_PASS 7/7`.

The 7 scenarios cover slow neutral heartbeat then exact canonical result, fast no-heartbeat path, generator close, actual waiter cancellation, transaction failure with comments only, already-failed task with zero output, and non-positive interval lower bound.

Evidence: `autonomy/evidence/notion/20260824T0447Z_stageb_sse_keepalive_exact_evidence.json`.

This is still not full Stage-B PASS until the keepalive is wired into the exact transformed server and the same-byte full matrix passes.

## Final coverage / Windows readiness

Canonical final coverage verifier:
`autonomy/v3/tools/verify_notion_final_gate_coverage.py` = `be9b721ea61d897889c06aa9f5870d941b5eb876`.

Canonical readiness verifier:
`autonomy/v3/tools/verify_notion_windows_ready_candidate.py` = `062927f71da341c665d5311fc31b8e8a2bdebb65`, pinned to coverage `be9b721e...`; `--candidate-root` must independently verify actual candidate bytes and reject missing/symlink/tampered files.

## Same-byte full matrix before Windows

On one composed tree run all mandatory Agent materializer/journal/tombstone/dynamic-reservation/startup-cleanup/cancellation/prompt/delegation/tool-loop/subagent/routing/failover tests plus Core strict intent/finalize, Responses+compaction exact replay, retry/restart/tool-call, stream/non-stream/neutral precommit keepalive/disconnect, ambiguous transport single attempt, removed account, TTL/size/oversize/stale retry >32, rollback floor and Codex shell-env secret exclusion.

## Следующий обязательный порядок

1. Fresh-read #9 and exact PR heads; abort stale composition on head/materializer drift.
2. Пока NOTION_AGENT claim владеет pair/matrix, не дублировать его работу.
3. После Agent RELEASE принять только exact `account_pool=c9ca6f3b.../48066 + server=273db94a.../116047` with readback+compile evidence.
4. На тех же байтах встроить store `3ca05116...`, transaction helper `b3fe792b...` и neutral SSE keepalive `b4333b83...`.
5. Прогнать полный mandatory Agent+Core same-byte matrix.
6. Coverage `be9b721e...` PASS на exact suite.
7. Readiness `062927f7... --candidate-root <exact composed tree>` PASS.
8. Только затем один targeted native Windows Server 2022 proof; historical PR #7/pending digest не является доказательством новой composition.
9. Targeted PASS -> full promoted Ubuntu+Windows/exact-source/security gate на тех же bytes.
10. После promoted green -> isolated encrypted runtime restore -> real Codex-only `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, затем owner-doctor, discovered/supported tool coverage, legitimate account rotation/restart/crash and bounded soak -> `NOTION_CORE_DONE`.

## Persistent v4 memory

Не переключать `LATEST` без полного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Unknown bytes не реконструировать. Текущие результаты долговечно записаны в Git evidence/handoff/#9; отсутствие нового capsule pointer не является потерей результата.
