# Notion — Windows + Codex ядро

Обновлено: 2026-08-24 ~06:10 МСК.

## Точная текущая граница

- Core PR #7: `candidate/ncm28-windows-fixed-v1`, exact head `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8: `autonomy/notion-prompt-modes-20260819`, exact head `4b344547d5e95bd4b3c62f5b80186059d849ff08`.
- Circle connectivity для Notion уже доказана; reconnect не повторять.
- Native Windows Server 2022 запрещён до exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах.
- Исторические PR #7 Windows/pending digest не являются доказательством новой композиции.
- PR #7/#8 product refs, main/merge, live Notion/Codex, аккаунты, секреты и production до соответствующего acceptance gate не менять.

## Координация

Последний NOTION_AGENT heartbeat на exact pair/matrix истёк в 05:35 МСК; свежего RELEASE с byte-exact pair+matrix в этом проходе не найдено. Текущий Core claim `NOTION_CORE-20260824T0546MSK` владеет только Core Stage-B streaming failure projection/evidence и не дублирует Agent materialization/matrix.

## Exact Agent pair — принимать только байты с readback

Frozen preimages:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes;
- `payload/conversation_segments.py` = `553bd3496c21a7949c3a5dfa03f33b9e09293213`, 10758 bytes.

Canonical transformed identities:
- `payload/account_pool.py` FINAL `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `payload/server.py` startup-only INTERMEDIATE `5c04b8cce34b29e63bf1839d59476f8081763c2b`, 115901 bytes;
- `payload/server.py` FINAL after canonical tombstone wrapper `273db94a8f9b153e95c910df221755e28c0f46a7`, 116047 bytes.

`5c04.../116047` и historical `ba52edc7...` запрещены как final server identity. Core не объявляет pair consumed, пока exact final bytes не переданы/прочитаны обратно на текущем head и не прошли compile + mandatory Agent matrix.

## Stage A + durable Stage-B store

Stage A: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Durable Stage-B store на exact `conversation_segments.py=553bd349...`:
- candidate Git identity `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`, 24882 bytes;
- SHA-256 `94b75ccbe3244bba25e5357cfef502aacb18cb54ad5b8093b220ae03006e2056`;
- `py_compile` PASS;
- targeted recovery/replay matrix 16/16 PASS.

Exact manifest: `autonomy/evidence/notion/20260824T0345Z_stageb_store_candidate/manifest.json`, blob `b54de4c99f4bf741b3c96e1598a97dec0ed6b0a7`.

Contract: v3 reads legacy v2; strict fail-closed writes; durable `provider_intent`; exact request/context identity incl. empty input; atomic finalize stores canonical rendered payload and clears matching intent; replay preserves `response_id/item_id/call_id`; detached `get()`; rollback on NCM28 failure; replay 512 KiB/item, 8 MiB total, 6h TTL; unresolved intents survive ordinary eviction and cap at 128; completed fingerprint ring + stale-prefix protection.

## Stage-B transaction helper

`autonomy/evidence/notion/20260824T0403Z_stageb_transaction_helper.py` = blob `b3fe792b99daad678e3c773db291576bdf179167`, 7451 bytes, readback + `py_compile` PASS.

Local helper 12/12 PASS; exact store+helper integration 11/11 PASS. Required order:
`local route acquisition -> strict provider_intent -> deliberate same-account provider steps without implicit failover/retry -> canonical render -> strict atomic finalize -> ephemeral cache/affinity/reservation -> client`.

## Stage-B streaming projection — failure gap closed as standalone exact candidate

Predecessor neutral keepalive `b4333b830ee62915a747d202174f657b26342d85` passed its earlier 7/7 test, but fresh ASGI review found two real gaps:
1. Starlette `StreamingResponse` commits HTTP 200 before the durable task result is known, so a later task exception would otherwise end as an abrupt successful-status stream without protocol-visible terminal failure.
2. `await wait_for(shield(task))` can surface the task exception immediately, before the predecessor reaches its later `task.result()` branch; the old comment understated this path.

New exact Core candidate:
- `autonomy/evidence/notion/20260824T0546Z_stageb_stream_failure_projection_candidate.py`;
- Git blob `a094a4b5484384037fb02c07d345b73531a46091`;
- 3318 bytes;
- SHA-256 `2f0b3658524ef7b9b1d5f0a926ce7cd41a32093a2f6883851a2eb788e1f9f329`.

Exact executable regression:
- `autonomy/evidence/notion/20260824T0546Z_test_stageb_stream_failure_projection_exact.py`;
- Git blob `8d5fadf31aeff034d09e9943b25249402a2207b0`;
- 3957 bytes;
- SHA-256 `f356b6147ec67e233c5806592ff859506d2522d400705bf81f5891ef619354f5`;
- Python 3.13.5 + Starlette 0.50.0 compile PASS;
- exact execution: `STAGEB_STREAM_FAILURE_PROJECTION_EXACT_PASS 10/10`.

Candidate invariants:
- до завершения durable transaction выдаются только нейтральные `: stageb-commit-pending` комментарии;
- отмена клиентского waiter не отменяет server-owned transaction;
- transaction failure/cancelled server task превращается в один sanitized `response.failed`, без exception text, provider/tool/call IDs и успешного payload;
- canonical success projection полностью буферизуется до первого protocol-event, поэтому ошибка projection не может утечь как partial `response.created`;
- реальный ASGI path остаётся HTTP 200 (это свойство StreamingResponse), но тело теперь детерминированно заканчивается `response.failed`, а не обрывается молча.

Текущий `openai/codex` main на audit SHA `76d98a771e6cd44a79a3ab895a9f7c49d27d6deb` в `codex-rs/codex-api/src/sse/responses.rs` распознаёт `response.failed`; generic `server_error` классифицирует как retryable. Поэтому клиентский retry НЕ считается защитой от повторного provider call. Защита остаётся серверной: unresolved durable `provider_intent` должен остановить следующий exact retry до Notion. Реальный Codex retry/restart proof на финальном same-byte candidate остаётся обязательным.

Durable evidence: `autonomy/evidence/notion/20260824T0546Z_stageb_stream_failure_projection_evidence.json`.

Это standalone Core PASS, не full Stage-B: projector ещё надо встроить в exact final Agent server bytes вместе со store/helper и прогнать всю same-byte матрицу.

## Final coverage / Windows readiness

Canonical final coverage verifier: `autonomy/v3/tools/verify_notion_final_gate_coverage.py` = `be9b721ea61d897889c06aa9f5870d941b5eb876`.

Canonical readiness verifier: `autonomy/v3/tools/verify_notion_windows_ready_candidate.py` = `062927f71da341c665d5311fc31b8e8a2bdebb65`; `--candidate-root` обязан самостоятельно сверять реальные candidate bytes и отклонять missing/symlink/tampered files.

## Same-byte full matrix before Windows

На одном composed tree обязательны все актуальные Agent materializer/journal/tombstone/dynamic-reservation/startup-cleanup/cancellation/prompt/delegation/tool-loop/subagent/routing/failover tests плюс Core strict intent/finalize, Responses+compaction exact replay, retry/restart/tool-call, stream/non-stream/neutral keepalive/**protocol-visible stream failure**/disconnect, ambiguous transport single attempt, removed account, TTL/size/oversize/stale retry >32, rollback floor и Codex shell-env secret exclusion.

## Следующий обязательный порядок

1. Fresh-read #9 и PR heads; abort при head/materializer drift.
2. Принять Agent pair только как exact `c9ca6f3b.../48066 + 273db94a.../116047` с byte readback + compile + mandatory Agent matrix.
3. На тех же байтах встроить store `3ca05116...`, transaction helper `b3fe792b...` и новый failure-safe SSE projector `a094a4b5...`.
4. Прогнать полный mandatory Agent+Core same-byte matrix, включая exact stream regression `8d5fadf3...`.
5. Coverage `be9b721e...` PASS на exact suite.
6. Readiness `062927f7... --candidate-root <exact composed tree>` PASS.
7. Только затем один targeted native Windows Server 2022 proof.
8. Targeted PASS -> full promoted Ubuntu+Windows/exact-source/security gate на тех же bytes.
9. После promoted green -> isolated encrypted runtime restore -> real Codex-only `codex exec -> bridge -> Notion -> local tool -> verifier FAIL -> correction -> VERIFY_OK`, owner-doctor, discovered/supported tool coverage, legitimate account rotation/restart/crash и bounded soak -> `NOTION_CORE_DONE`.

## Persistent v4 memory

Не переключать `LATEST` без полного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Unknown bytes не реконструировать. Текущие результаты уже долговечно записаны в Git evidence/handoff/#9; отсутствие нового capsule pointer не является потерей результата.
