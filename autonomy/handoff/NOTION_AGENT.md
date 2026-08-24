# Notion — ротация / агентность / делегирование — handoff

Обновлено: 2026-08-24 ~06:31 МСК.

## Источник истины
- Product repo: `Ai-b0ss/notion-agent-bridge`.
- Agent PR #8 exact head: `9c2098feebd186421629f80e62787d0569f8b30c`.
- Core PR #7 exact head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Circle connectivity уже доказана отдельным чистым `run-ci`; reconnect повторно не делать.
- Native Windows Server 2022 запрещён: сначала exact Agent pair + corrected delegated set + полный Agent matrix + Core Stage-B/full local matrix на тех же байтах + актуальные coverage/readiness PASS.
- Текущий Agent claim: comment `5390320946`, exact pair rematerialization/readback + mandatory Agent matrix + byte-exact Core handoff. Core Stage-B claim был disjoint и RELEASED; Core PR #7/Stage-B файлы не трогать.
- В этом проходе Circle/Windows/live Notion/Codex/accounts/secrets/main/merge/production не использовались.

## Exact Agent pair
Frozen product preimages остаются неизменными:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes.

Canonical materializers на свежем Agent head:
- account apply `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- startup/server apply `20c2fb2e550daab52f3d27e791fa500002a73735`;
- tombstone wiring `40ab3a448e33fb8a8c3ce045ef31a815d0554823`;
- base pair materializer `30fb89286eb4457b25b2145918279fec2d735042`;
- canonical tombstone wrapper **`fc2cfcd34fd4c695be3beb35f35ba5723098a9a9`** (commit `2faa8ce62ce70eb71edb4e1a19fd43bd97491b5a`).

Correct FINAL transformed pair remains:
- `payload/account_pool.py` -> `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes, SHA-256 `5d233686d882a2819e9ed19b73d4ed6ce55ef794385db2447c2801000844c38a`;
- `payload/server.py` -> `273db94a8f9b153e95c910df221755e28c0f46a7`, 116047 bytes, SHA-256 `d1492ef4a0dc2842c0bdde417945091d3949485283ebf7be729bdbcced0010a1`.

Intermediate server after startup materializer only: `5c04b8cce34b29e63bf1839d59476f8081763c2b`, 115901 bytes. `5c04.../116047` и historical `ba52edc7...` запрещены как final identities.

Direct target blobs всё ещё не считаются materialized/readback proof, пока свежий head не выполнит `check -> apply -> readback SHA/size -> compile` и full Agent matrix. Pure transformation logic не менялась новым path-safety fix, поэтому target identities выше не менялись, но исторический pair PASS нельзя переносить на новый head.

## NEW: product-target alias escape закрыт — 24.08 ~06:30 МСК
На exact pre-fix materializer воспроизведён реальный path-escape: base `commit_pair()` делал `Path.resolve()` до записи. Если `payload/account_pool.py` был symlink на внешний файл с exact old bytes, materializer канонизировал внешний target и `os.replace()` менял **внешний файл**, оставляя symlink в checkout на месте. Exact-preimage checks это не блокировали.

Root fix на PR #8:
- `2faa8ce62ce70eb71edb4e1a19fd43bd97491b5a` — canonical tombstone wrapper проверяет lexical product target и всех предков **до любого resolve/recovery/commit**; final target обязан быть plain regular single-link file; symlink/junction target, symlink/junction ancestor, missing/non-regular target и hardlink fail closed.
- wrapper blob после fix: `fc2cfcd34fd4c695be3beb35f35ba5723098a9a9`.
- `9c2098feebd186421629f80e62787d0569f8b30c` — regression `tests.test_materialize_agent_wiring_target_path_safety`.
- локальная targeted semantic проверка: **PASS 4/4** (`plain`, final symlink reject, ancestor symlink reject, hardlink reject); внешний файл в отрицательных сценариях не менялся.
- compare `4b344547... -> 9c2098fe...`: только wrapper + новый regression, product `payload/account_pool.py`/`payload/server.py` не менялись.

Durable evidence: `autonomy/evidence/notion/20260824T0630Z_agent_materializer_target_alias_guard.json` (control commit `66f4d4006508559383fdb431710f84f10032c34f`).

## Corrected delegated engineer/owner five-file set
Use only:
- `delegation_policy.py` `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `delegation_dispatcher.py` `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `notion_delegated_model_step.py` `f36e9c91355dec667173b6265dd550554fb0f05d`;
- `subagent_entrypoint.py` `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`;
- `server_subagent_lifecycle.py` `f47838b338f2bd94163cf466110f939c065ac041`.

Old `aebefce4...` entrypoint is superseded. Five-file compile/import and owner prompt propagation/repr isolation/thread rebase semantics were independently checked earlier.

## Mandatory Agent matrix on composed exact bytes
At minimum:
- `tests.test_prompt_modes`
- `tests.test_prompt_policy_identity`
- `tests.test_responses_prompt_mode_http_contract`
- `tests.test_responses_prompt_wiring_contract`
- `tests.test_delegation_policy`
- `tests.test_delegation_dispatcher`
- `tests.test_notion_delegated_model_step`
- `tests.test_subagent_entrypoint`
- `tests.test_delegated_tool_loop`
- `tests.test_delegated_tool_loop_runtime_validation`
- `tests.test_delegated_uncertain_failover_boundary`
- `tests.test_dynamic_reservation_inlease_reselect`
- `tests.test_dynamic_reservation_lease_session`
- `tests.test_dynamic_reservation_session_entry_cleanup`
- `tests.test_notion_delegated_synthetic_call_ids`
- `tests.test_notion_delegated_thread_reentry`
- `tests.test_notion_delegation_dynamic_reservations`
- `tests.test_notion_subagent_runtime`
- `tests.test_notion_subagent_server_reservations`
- `tests.test_reservation_aware_lease`
- `tests.test_responses_cooldown_failover`
- `tests.test_startup_status_cleanup`
- `tests.test_startup_status_repeated_cancellation`
- `tests.test_startup_cleanup_failure_boundary_candidate`
- `tests.test_subagent_lifecycle`
- `tests.test_delegated_cancellation_lifecycle`
- `tests.test_subagent_tombstone_store`
- `tests.test_subagent_tombstone_post_replace_sync_failure`
- `tests.test_server_subagent_tombstone_restart`
- `tests.test_server_subagent_durable_tool_guard_v2`
- `tests.test_server_subagent_uncertain_rebind`
- `tests.test_server_subagent_lifecycle_drain`
- `tests.test_notion_tool_subagent_runtime`
- `tests.test_foreground_slot_routing`
- `tests.test_account_pool_parallelism`
- **`tests.test_materialize_agent_wiring_target_path_safety`**.

No-replay/tombstone focused cluster was already green before this new materializer regression; do not polish it absent a new reproducer. Final same-byte suite still reruns post-replace/restart/cancellation paths.

## Final coverage/readiness — новая обязательная supersession
Core standalone Stage-B stream projection уже закрыт и из-за него текущие Core pins стали:
- coverage `3a07683c5a093730b5dc08ede543f6d95c94f856`;
- readiness `74533adc1ddee720936fe5c819d93e21c5992394`.

После нового Agent path-alias regression эти pins **снова недостаточны для Windows**, потому что coverage `3a07683c...` создан до `tests.test_materialize_agent_wiring_target_path_safety` и может PASS без него. Core должен после Agent RELEASE переиздать coverage, добавив этот exact module, и readiness pin на новый coverage. До этого Windows readiness = NOT_READY независимо от остальных green gates.

## Core boundary
Core PR #7 остаётся `b6f4eef28ea7acdbba5fc32559fa635c28f72144` и не трогался Agent-проходом.

Core standalone candidates уже доказаны локально:
- durable Stage-B store candidate `3ca05116a1ada8f1c7beb7cbdd838b08154257e5`;
- transaction helper `b3fe792b99daad678e3c773db291576bdf179167`;
- failure-safe stream projector `a094a4b5484384037fb02c07d345b73531a46091`;
- exact stream regression `8d5fadf31aeff034d09e9943b25249402a2207b0`.

Before targeted Windows, on SAME bytes:
1. fresh Agent pair `c9ca6f3b.../48066 + 273db94a.../116047` readback+compile on head `9c2098fe...`;
2. corrected five-file owner/engineer set + full mandatory Agent matrix including target-path-safety regression green;
3. Agent RELEASE with exact reachable bytes/blob SHA/size/test manifest;
4. Core integrates store/helper/projector on those same bytes and wires `tests/test_stageb_stream_failure_projection.py`;
5. full Agent+Core Stage-B/local matrix green;
6. coverage superseding `3a07683c...`, requiring the new Agent regression, PASS;
7. readiness repinned to that coverage with `--candidate-root` PASS.
Only then one targeted Windows Server 2022 run is allowed. Live `Codex -> bridge -> Notion`, rotation/restart/soak comes later after native gates and encrypted runtime restore.

## Persistent v4 memory
Normative protocol: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + exact `autonomy/v3/tools/capsule_runtime_v4.py` blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`.

Current last verified pointer retained from beginning of this line:
- `LATEST` blob `740b0e3515f1fb9a7f523f71749b224b1fda9c0a`;
- capsule `20260823T225025Z-8eae144a28`;
- archive SHA-256 `db911f8d4e419c5d83f8c71bdb8258a2399dd1faf241ec80df328bb5c235cb74`.

Do not switch `LATEST` without full normative `restore -> checkpoint -> pack -> immutable upload -> readback all parts/manifest -> fresh-read LATEST -> CAS`. Connector-returned bytes must not be manually reconstructed into unknown capsule bytes.

## Next exact step
1. Fresh-read #9 + PR#8/#7 heads; abort on drift/conflicting claim.
2. On fresh Agent head `9c2098fe...`, rematerialize exact pair through canonical wrapper `fc2cfcd...`: `--check -> apply -> readback SHA/size -> compile`.
3. Run the full mandatory Agent matrix including `tests.test_materialize_agent_wiring_target_path_safety` on those exact transformed bytes.
4. Export/retain exact transformed product bytes durably and hand Core exact blob SHA/size/test manifest; no prose-only reconstruction.
5. Core composes Stage-B on the same bytes and supersedes coverage/readiness to require the new Agent regression.
6. No Windows/live until the complete local same-byte chain is green.
