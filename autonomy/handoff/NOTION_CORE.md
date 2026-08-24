# Notion — Windows + Codex ядро

Обновлено: 2026-08-24 ~07:00 МСК.

## Точная текущая граница

- Core PR #7 exact head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Agent PR #8 latest observed head: `3cc0c0be34bad1b79555d842cd8fc9755dd26b64`.
- Agent сейчас под отдельным активным claim и двигает только materializer/pair/matrix; Core не материализует Agent pair и не запускает Agent matrix параллельно.
- Notion Circle connectivity уже доказана; reconnect не повторять.
- Native Windows Server 2022 запрещён до exact same-byte Agent+Core composition и полного локального Stage-B/full-matrix PASS на тех же байтах.
- Исторические PR #7 Windows/pending digest не являются доказательством новой composition.
- PR #7/#8 product refs, main/merge, live Notion/Codex, аккаунты, секреты и production до соответствующего acceptance gate не менять.

## Координация и свежий head drift

Core claim `5390478088` был взят на head Agent `9c2098fe...` и затем сужен heartbeat `5390539378`, потому что Agent head ушёл вперёд под своим disjoint claim.

Observed drift `9c2098fe... -> e3fe0417... -> 3cc0c0be...` затрагивает только:
- `tools/materialize_agent_wiring_with_tombstones.py`;
- новый обязательный `tests/test_materialize_agent_wiring_late_alias_substitution.py`.

Core не потреблял и не публиковал pair на stale head. Новый regression проверяет late alias/parent substitution после более ранней проверки пути, поэтому final gate обязан запускать его явно.

Evidence: `autonomy/evidence/notion/20260824T0652Z_agent_late_alias_gate_hardening.json`.

## Exact Agent pair — принимать только свежий Agent RELEASE

Frozen product preimages:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes;
- `payload/conversation_segments.py` = `553bd3496c21a7949c3a5dfa03f33b9e09293213`, 10758 bytes.

Last canonical transformed identities before the active Agent rematerialization:
- `account_pool.py` FINAL `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `server.py` FINAL `273db94a8f9b153e95c910df221755e28c0f46a7`, 116047 bytes.

Не переносить эти identities автоматически через текущий materializer drift. Core принимает pair только после свежего Agent RELEASE с exact readback+size+compile+mandatory matrix на текущем head.

## Stage A + durable Stage-B store

Stage A: `V32_STAGE_A_EXACT_LOCAL_FLOOR_PASS`.

Durable Stage-B store на exact `conversation_segments.py=553bd349...`:
- candidate Git identity `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`, 24882 bytes;
- SHA-256 `94b75ccbe3244bba25e5357cfef502aacb18cb54ad5b8093b220ae03006e2056`;
- compile PASS; targeted recovery/replay 16/16 PASS.

Manifest: `autonomy/evidence/notion/20260824T0345Z_stageb_store_candidate/manifest.json`, blob `b54de4c99f4bf741b3c96e1598a97dec0ed6b0a7`.

## Stage-B transaction + stream

Transaction helper:
- `autonomy/evidence/notion/20260824T0403Z_stageb_transaction_helper.py`;
- blob `b3fe792b99daad678e3c773db291576bdf179167`, 7451 bytes;
- helper 12/12 PASS; exact store+helper 11/11 PASS.

Required order:
`local route acquisition -> strict provider_intent -> deliberate same-account provider steps without implicit failover/retry -> canonical render -> strict atomic finalize -> ephemeral cache/affinity/reservation -> client`.

Failure-safe stream projector:
- `autonomy/evidence/notion/20260824T0546Z_stageb_stream_failure_projection_candidate.py`;
- blob `a094a4b5484384037fb02c07d345b73531a46091`, 3318 bytes;
- exact regression `8d5fadf31aeff034d09e9943b25249402a2207b0`, 3957 bytes;
- Python 3.13.5 + Starlette 0.50.0: `STAGEB_STREAM_FAILURE_PROJECTION_EXACT_PASS 10/10`.

Before durable completion only neutral SSE comments are allowed. Transaction/projection failure must end an already-started HTTP-200 stream with one sanitized `response.failed`; client cancellation must not cancel server-owned commit-critical work. Exact retry safety remains the durable `provider_intent`, not Codex retry policy.

## Final coverage/readiness — current pins after late-alias drift

Superseded: coverage `b51f11f27d7ef2c52bc6fd93d3469caf3d6d4ae3`, readiness `2da96347877bc3a3845c1c6b7796eea32257752f`.

Current final coverage verifier:
- `autonomy/v3/tools/verify_notion_final_gate_coverage.py`;
- blob `0d2b9247f7b1ba2383c5ba87ed4731e1d61ca806`;
- exact-requires `tests.test_materialize_agent_wiring_late_alias_substitution` in addition to prior Agent/Core/Stage-B regressions.

Current Windows readiness verifier:
- `autonomy/v3/tools/verify_notion_windows_ready_candidate.py`;
- schema `notion_windows_ready_candidate_v8`;
- blob `e80e119f19847a44b84ebdebcaf1e1391588c00a`;
- pins coverage `0d2b9247...`;
- separately requires `agent_materializer_late_alias_substitution=PASS`;
- still re-hashes actual candidate files under `--candidate-root` and rejects byte drift/symlinks.

Local hardening model: `NOTION_LATE_ALIAS_FINAL_GATE_HARDENING_PASS 7/7`: full suite/readiness pass; missing late-alias regression fails; prefix/similar module cannot satisfy exact module boundary; missing new readiness gate fails; old coverage pin fails; candidate byte drift fails.

These gates are only barriers. They do not prove Agent pair, Stage-B composition or Windows readiness by themselves.

## Same-byte full matrix before Windows

On one final composed tree run all current Agent materializer/journal/tombstone/dynamic-reservation/startup-cleanup/cancellation/prompt/delegation/tool-loop/subagent/routing/failover tests, including both target-path-safety and late-alias-substitution, plus Core strict intent/finalize, Responses+compaction exact replay, retry/restart/tool-call, stream/non-stream/protocol-visible stream failure/disconnect, ambiguous transport single attempt, removed account, TTL/size/oversize/stale retry, rollback floor and Codex shell-env secret exclusion.

## Следующий обязательный порядок

1. Fresh-read #9 + PR #7/#8; ждать свежий Agent RELEASE из активного pair/matrix claim. При новом drift не использовать старые pair bytes.
2. Принять exact Agent pair только с readback SHA/size + compile + mandatory Agent matrix, включая `tests.test_materialize_agent_wiring_late_alias_substitution`.
3. На этих же байтах встроить store `3ca05116...`, transaction helper `b3fe792b...` и stream projector `a094a4b5...`; wire exact `tests/test_stageb_stream_failure_projection.py`.
4. Полный same-byte Agent+Core matrix.
5. Coverage `0d2b9247...` PASS.
6. Readiness `e80e119f... --candidate-root <exact composed tree>` PASS.
7. Только затем один targeted native Windows Server 2022 proof.
8. Targeted PASS -> promoted Ubuntu+Windows/exact-source/security gate на тех же bytes.
9. После promoted green -> isolated encrypted runtime restore -> real Codex-only tool loop, owner-doctor, discovered tool coverage, legitimate rotation/restart/crash/soak -> `NOTION_CORE_DONE`.

## Persistent v4 memory

`LATEST` не переключать без полного `capsule_runtime_v4.py restore -> pack -> immutable upload -> readback -> CAS`. Unknown bytes не реконструировать. Текущие результаты долговечно записаны в Git evidence/handoff/#9.
