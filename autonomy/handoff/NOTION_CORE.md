# Notion — Windows + Codex ядро

## Точная текущая граница

- Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `autonomy/notion-prompt-modes-20260819`, exact head `4b344547d5e95bd4b3c62f5b80186059d849ff08`.
- Circle connectivity для Notion уже доказана; reconnect не повторять.
- Native Windows Server 2022 запрещён до exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах.
- PR #7/#8 product refs, main/merge, live Notion/Codex, аккаунты, секреты и production до соответствующего acceptance gate не менять.

## Координация

Активный NOTION_AGENT claim `5389444767` после heartbeat действует до `2026-08-24 05:10 MSK` и владеет только exact transformed pair rematerialization/readback + mandatory Agent matrix. NOTION_CORE эту поверхность не дублирует. Текущий Core claim `5389643234` ограничен Stage-B SSE/transaction projection evidence.

## Exact Agent pair

Frozen preimages текущего Agent head:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes;
- `payload/conversation_segments.py` = `553bd3496c21a7949c3a5dfa03f33b9e09293213`, 10758 bytes.

Каноническая transformed pair:
- `payload/account_pool.py` -> FINAL `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `payload/server.py` after startup cleanup -> INTERMEDIATE `5c04b8cce34b29e63bf1839d59476f8081763c2b`, 115901 bytes;
- `payload/server.py` after tombstone wrapper -> FINAL `273db94a8f9b153e95c910df221755e28c0f46a7`, 116047 bytes.

`5c04.../116047` и исторический `ba52edc7...` не использовать как final server identity.

Exact recipe blobs:
- account materializer `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- startup cleanup `20c2fb2e550daab52f3d27e791fa500002a73735`;
- tombstone wiring `40ab3a448e33fb8a8c3ce045ef31a815d0554823`;
- pair materializer `30fb89286eb4457b25b2145918279fec2d735042`;
- canonical wrapper `859039a5e408bc84e7046372cdb509131eb37a97`.

Core уже независимо доказал `account_pool.py -> c9ca6f3b.../48066` через exact materializer + compile. Final `server.py=273db94a.../116047` сейчас остаётся Agent-owned до RELEASE/expiry.

## Corrected delegated five-file set

Использовать только:
- `delegation_policy.py` `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `delegation_dispatcher.py` `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `notion_delegated_model_step.py` `f36e9c91355dec667173b6265dd550554fb0f05d`;
- `subagent_entrypoint.py` `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`;
- `server_subagent_lifecycle.py` `f47838b338f2bd94163cf466110f939c065ac041`.

Scratch blob `8534c51f...` не использовать.

## Stage A / durable Stage-B store

Stage A локально закрыт: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

На exact `conversation_segments.py=553bd349.../10758` собран durable Stage-B store candidate:
- Git identity `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`;
- 24882 bytes;
- SHA-256 `94b75ccbe3244bba25e5357cfef502aacb18cb54ad5b8093b220ae03006e2056`;
- `py_compile` PASS;
- targeted recovery/replay matrix 16/16 PASS.

Exact bytes опубликованы как 10 content-addressed base64 parts + manifest:
`autonomy/evidence/notion/20260824T0345Z_stageb_store_candidate/manifest.json`, blob `b54de4c99f4bf741b3c96e1598a97dec0ed6b0a7`.

Store contract: state v3 reads legacy v2; strict writes are fail-closed; durable `provider_intent`; exact request/context identity including empty input; atomic finalize stores canonical rendered payload and clears matching intent; exact replay keeps `response_id/item_id/call_id`; detached `get()`; rollback on NCM28 write failure; replay 512 KiB/item, 8 MiB total, 6h TTL; unresolved intents survive ordinary TTL/eviction and are capped at 128; completed fingerprint ring 32 + stale-prefix protection.

Evidence: `autonomy/evidence/notion/20260824T0345Z_stageb_store_candidate_evidence.json`, blob `2e04fee1db340ea3d8c279e35d1f4b260d5d170b`.

## Stage-B transaction helper

Exact helper:
`autonomy/evidence/notion/20260824T0403Z_stageb_transaction_helper.py`, blob `b3fe792b99daad678e3c773db291576bdf179167`, 7451 bytes, readback + `py_compile` PASS.

Local helper matrix 12/12 PASS and exact store+helper integration 11/11 PASS. Proved order:
`local route acquisition -> strict provider_intent -> deliberate provider steps without implicit failover/retry -> canonical render -> strict atomic finalize -> ephemeral cache/affinity/reservation -> client`.

Covered: intent/finalize write failure, ambiguous provider outcome, restart exact replay, post-finalize ephemeral failure recovery, removed account fail-closed, disconnect/shutdown ownership, compaction replay, intent capacity and deliberate same-account correction. Evidence blob `77d21871ccf4c4d194828f9e02b8d6a823a92321`.

## NEW — precommit SSE idle-gap / neutral keepalive

Current helper `b3fe792b...` waits silently for commit completion before `buffered_sse_projection` yields anything. Local reproducer: a slow commit produced no first SSE byte within the probe window while the server-owned task stayed alive (`CURRENT_HELPER_IDLE_GAP_REPRODUCED`). This is safe for idempotency but can trigger client/proxy idle timeouts on long Notion work.

Prepared Core-only keepalive candidate:
- `autonomy/evidence/notion/20260824T0413Z_stageb_sse_keepalive_candidate.py`;
- exact Git blob/readback `b4333b830ee62915a747d202174f657b26342d85`;
- 1374 bytes;
- SHA-256 `53afa5dcc15a73edfc5b3c4a567ddf3f3b9ae593471590a85c4301dbb92ead79`.

Contract: while durable commit is pending, emit only neutral SSE comment `: stageb-commit-pending\n\n`; never emit `resp_`, `call_`, `fc_`, tool/provider payload or protocol result before finalize; `asyncio.shield` keeps client cancellation from owning the transaction; after finalize project the exact canonical stored response; failures propagate without fabricated protocol response; heartbeat interval is lower-bounded to avoid busy loop.

Locally executed candidate+test: `STAGEB_SSE_KEEPALIVE_PASS` 5/5 — slow heartbeat, fast path, client disconnect without transaction cancellation, transaction failure with comments only, non-positive interval bounded. Readable regression is published at `autonomy/evidence/notion/20260824T0413Z_test_stageb_sse_keepalive.py`; its GitHub readback blob is `23270978962be2e8602e2f322739ae55869a10ed`. Execution attribution is kept separately in evidence because the locally executed test blob and published presentation blob differ.

Evidence: `autonomy/evidence/notion/20260824T0413Z_stageb_sse_keepalive_evidence.json`, current content blob `bba5481324c55c7b7bd4df1d0f6effc40b49d6fd`.

This is not full Stage-B PASS until it is wired into the exact transformed server and same-byte matrix.

## Final coverage / Windows readiness

Canonical final coverage verifier:
`autonomy/v3/tools/verify_notion_final_gate_coverage.py` = `be9b721ea61d897889c06aa9f5870d941b5eb876`.

Canonical readiness verifier:
`autonomy/v3/tools/verify_notion_windows_ready_candidate.py` = `062927f71da341c665d5311fc31b8e8a2bdebb65`, pinned to coverage `be9b721e...`; `--candidate-root` must independently verify actual candidate bytes and reject missing/symlink/tampered files.

These pins supersede stale Agent handoff references to `2df0e51a.../d6fde58c...`.

## Same-byte full matrix before Windows

On one composed tree run all mandatory Agent materializer/journal/tombstone/dynamic-reservation/startup-cleanup/cancellation/prompt/delegation/tool-loop/subagent/routing/failover tests plus Core strict intent/finalize, Responses+compaction exact replay, retry/restart/tool-call, stream/non-stream/neutral precommit keepalive/disconnect, ambiguous transport single attempt, removed account, TTL/size/oversize/stale retry >32, rollback floor and Codex shell-env secret exclusion.

## Следующий обязательный порядок

1. Fresh-read #9 and exact PR heads; abort stale composition on head/materializer drift.
2. Пока active NOTION_AGENT claim владеет pair/matrix, не дублировать его работу.
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
