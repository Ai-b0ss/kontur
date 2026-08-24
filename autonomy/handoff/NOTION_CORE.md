# Notion — Windows + Codex ядро

Обновлено: 2026-08-24 ~06:20 МСК.

## Точная текущая граница

- Core PR #7 exact head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8 exact head: `4b344547d5e95bd4b3c62f5b80186059d849ff08`.
- Notion Circle connectivity уже доказана; reconnect не повторять.
- Native Windows Server 2022 запрещён до exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах.
- Исторические PR #7 Windows/pending digest не являются доказательством новой composition.
- PR #7/#8 product refs, main/merge, live Notion/Codex, аккаунты, секреты и production до соответствующего acceptance gate не менять.

## Координация

Fresh-read после начала Core-прохода обнаружил более новый disjoint claim, который первый поиск пропустил:
- `NOTION_AGENT-20260824T0541MSK`, comment `5390097924`, expires `06:35 МСК`, владеет только exact Agent pair rematerialization/readback + mandatory Agent matrix.
- `NOTION_CORE-20260824T0546MSK`, comment `5390128474`, владеет только Core Stage-B streaming failure projection/gate wiring до `07:16 МСК`.

Поверхности не пересекаются. Core не материализует Agent pair и не запускает Agent matrix, пока этот claim активен. Ошибка формулировки в первом Core claim зафиксирована в `20260824T0615Z_stream_failure_gate_wiring_evidence.json`; фактического пересечения записей не было.

## Exact Agent pair — принимать только exact bytes + readback

Frozen preimages:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes;
- `payload/conversation_segments.py` = `553bd3496c21a7949c3a5dfa03f33b9e09293213`, 10758 bytes.

Canonical transformed identities:
- `account_pool.py` FINAL `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `server.py` startup-only INTERMEDIATE `5c04b8cce34b29e63bf1839d59476f8081763c2b`, 115901 bytes;
- `server.py` FINAL after tombstone wrapper `273db94a8f9b153e95c910df221755e28c0f46a7`, 116047 bytes.

`5c04.../116047` и historical `ba52edc7...` запрещены как final server identity. Core не объявляет pair consumed до свежего Agent RELEASE с exact byte readback + compile + mandatory matrix.

## Stage A + durable Stage-B store

Stage A: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Durable Stage-B store на exact `conversation_segments.py=553bd349...`:
- candidate Git identity `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`, 24882 bytes;
- SHA-256 `94b75ccbe3244bba25e5357cfef502aacb18cb54ad5b8093b220ae03006e2056`;
- compile PASS; targeted recovery/replay 16/16 PASS.

Manifest: `autonomy/evidence/notion/20260824T0345Z_stageb_store_candidate/manifest.json`, blob `b54de4c99f4bf741b3c96e1598a97dec0ed6b0a7`.

Contract: v3 reads v2; strict fail-closed writes; durable `provider_intent`; exact request/context identity incl. empty input; atomic finalize stores canonical rendered payload and clears matching intent; replay preserves `response_id/item_id/call_id`; detached `get()`; rollback on NCM28 failure; 512 KiB/item, 8 MiB total, 6h replay TTL; unresolved intents survive ordinary eviction and cap at 128; stale-prefix protection after fingerprint-ring eviction.

## Stage-B transaction helper

`autonomy/evidence/notion/20260824T0403Z_stageb_transaction_helper.py` = blob `b3fe792b99daad678e3c773db291576bdf179167`, 7451 bytes, readback + compile PASS.

Local helper 12/12 PASS; exact store+helper 11/11 PASS. Required order:
`local route acquisition -> strict provider_intent -> deliberate same-account provider steps without implicit failover/retry -> canonical render -> strict atomic finalize -> ephemeral cache/affinity/reservation -> client`.

## Stage-B stream failure projection — standalone exact PASS

Predecessor keepalive `b4333b830ee62915a747d202174f657b26342d85` had a real failure boundary: Starlette commits HTTP 200 before durable completion, and `wait_for(shield(task))` can surface the task exception before the old later `task.result()` path. That could leave an abrupt HTTP-200 SSE termination with no protocol-visible terminal failure.

New candidate:
- `autonomy/evidence/notion/20260824T0546Z_stageb_stream_failure_projection_candidate.py`;
- blob `a094a4b5484384037fb02c07d345b73531a46091`, 3318 bytes;
- SHA-256 `2f0b3658524ef7b9b1d5f0a926ce7cd41a32093a2f6883851a2eb788e1f9f329`.

Exact executable regression:
- `autonomy/evidence/notion/20260824T0546Z_test_stageb_stream_failure_projection_exact.py`;
- blob `8d5fadf31aeff034d09e9943b25249402a2207b0`, 3957 bytes;
- SHA-256 `f356b6147ec67e233c5806592ff859506d2522d400705bf81f5891ef619354f5`;
- Python 3.13.5 + Starlette 0.50.0 compile PASS;
- `STAGEB_STREAM_FAILURE_PROJECTION_EXACT_PASS 10/10`.

Invariants:
- до durable completion только `: stageb-commit-pending`;
- client cancellation не отменяет server-owned transaction;
- transaction/projection failure даёт один sanitized `response.failed` без exception text, provider/tool/call IDs и successful payload;
- success projection полностью буферизуется до первого protocol event, поэтому projection exception не может утечь partial `response.created`;
- реальный ASGI HTTP status остаётся 200, но body завершается явным `response.failed`, а не молча обрывается.

Текущий `openai/codex` main audit SHA `76d98a771e6cd44a79a3ab895a9f7c49d27d6deb` распознаёт `response.failed`; generic `server_error` считает retryable. Поэтому безопасность не делегируется клиенту: exact retry после failure обязан упереться в unresolved durable `provider_intent` до второго вызова Notion. Реальный Codex retry/restart proof на финальном same-byte candidate остаётся обязательным.

Evidence: `autonomy/evidence/notion/20260824T0546Z_stageb_stream_failure_projection_evidence.json`.

## Final gate hardening после нового stream regression

Старые canonical pins `be9b721e...` / `062927f7...` теперь **superseded**, потому что они могли пропустить новую обязательную stream-failure regression.

Новый final coverage verifier:
- `autonomy/v3/tools/verify_notion_final_gate_coverage.py`;
- blob `3a07683c5a093730b5dc08ede543f6d95c94f856`;
- требует exact `tests.test_stageb_stream_failure_projection` и включает `stageb_stream_failure_projection` в Stage-B discovery;
- local positive/negative check: `NOTION_FINAL_COVERAGE_STREAM_GUARD_PASS 3/3`.

Новый Windows readiness verifier:
- `autonomy/v3/tools/verify_notion_windows_ready_candidate.py`;
- schema `notion_windows_ready_candidate_v6`;
- blob `74533adc1ddee720936fe5c819d93e21c5992394`;
- pin coverage `3a07683c...`;
- отдельный mandatory gate `stageb_stream_failure_projection`;
- local positive/negative check: `NOTION_WINDOWS_READINESS_STREAM_GUARD_PASS 3/3`.

Evidence: `autonomy/evidence/notion/20260824T0615Z_stream_failure_gate_wiring_evidence.json`.

До появления в exact composed repo файла `tests/test_stageb_stream_failure_projection.py` и его wiring coverage обязан быть `NOT_READY`; это намеренный fail-closed барьер.

## Same-byte full matrix before Windows

На одном composed tree обязательны все актуальные Agent materializer/journal/tombstone/dynamic-reservation/startup-cleanup/cancellation/prompt/delegation/tool-loop/subagent/routing/failover tests плюс Core strict intent/finalize, Responses+compaction exact replay, retry/restart/tool-call, stream/non-stream/neutral keepalive/protocol-visible stream failure/disconnect, ambiguous transport single attempt, removed account, TTL/size/oversize/stale retry >32, rollback floor и Codex shell-env secret exclusion.

## Следующий обязательный порядок

1. Fresh-read #9 и PR heads; abort при head/materializer drift.
2. Дождаться/принять Agent RELEASE только с exact `c9ca6f3b.../48066 + 273db94a.../116047` readback+compile+mandatory Agent matrix.
3. На тех же байтах встроить store `3ca05116...`, transaction helper `b3fe792b...` и failure-safe stream projector `a094a4b5...`; создать/wire exact product regression `tests/test_stageb_stream_failure_projection.py`.
4. Полный mandatory Agent+Core same-byte matrix.
5. Coverage `3a07683c...` PASS.
6. Readiness `74533adc... --candidate-root <exact composed tree>` PASS.
7. Только затем один targeted native Windows Server 2022 proof.
8. Targeted PASS -> promoted Ubuntu+Windows/exact-source/security gate на тех же bytes.
9. После promoted green -> isolated encrypted runtime restore -> real Codex-only tool loop, owner-doctor, discovered tool coverage, legitimate rotation/restart/crash/soak -> `NOTION_CORE_DONE`.

## Persistent v4 memory

`LATEST` не переключать без полного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Unknown bytes не реконструировать. Текущие результаты долговечно записаны в Git evidence/handoff/#9, поэтому отсутствие нового capsule pointer не означает потерю работы.
