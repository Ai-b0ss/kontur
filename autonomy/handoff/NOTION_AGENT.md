# Notion — ротация / агентность / делегирование — handoff

Обновлено: 2026-08-23 ~23:55 МСК.

## Источник истины
- Product repo: `Ai-b0ss/notion-agent-bridge`.
- Agent PR #8 exact head: `4b344547d5e95bd4b3c62f5b80186059d849ff08`.
- Core PR #7 exact head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Свежая owner-policy из `Ai-b0ss/kontur#9` важнее старых текстов: Notion Circle connectivity уже доказана; reconnect не повторять.
- Windows пока запрещён: сначала exact Agent pair + corrected delegated composition + полный Agent matrix + Core Stage-B/full local matrix на тех же байтах + coverage/readiness PASS.
- PR #8 / PR #7 product refs в последнем Agent-проходе не двигались.

## КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ EXACT AGENT PAIR
Frozen preimages PR #8 независимо перечитаны из GitHub и локально подтверждены по Git blob:
- `payload/account_pool.py` = `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes.

Canonical current materializers:
- `tools/apply_account_pool_dynamic_reservation.py` = `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- `tools/apply_startup_status_cleanup.py` = `20c2fb2e550daab52f3d27e791fa500002a73735`;
- `tools/apply_subagent_tombstone_wiring.py` = `40ab3a448e33fb8a8c3ce045ef31a815d0554823`;
- `tools/materialize_agent_wiring.py` = `30fb89286eb4457b25b2145918279fec2d735042`;
- `tools/materialize_agent_wiring_with_tombstones.py` = `859039a5e408bc84e7046372cdb509131eb37a97`.

Fresh independent local reproduction of those exact bytes/materializers proves the previous handoff mixed an intermediate server SHA with the final byte size.

Correct canonical transformed pair after the full wrapper:
- `payload/account_pool.py` -> `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes, SHA-256 `5d233686d882a2819e9ed19b73d4ed6ce55ef794385db2447c2801000844c38a`;
- `payload/server.py` -> **`273db94a8f9b153e95c910df221755e28c0f46a7`**, 116047 bytes, SHA-256 `d1492ef4a0dc2842c0bdde417945091d3949485283ebf7be729bdbcced0010a1`.

Intermediate server identity after `apply_startup_status_cleanup.py`, BEFORE tombstone wiring:
- `5c04b8cce34b29e63bf1839d59476f8081763c2b`, **115901 bytes**.

Therefore `5c04... / 116047` is internally inconsistent and MUST NOT be used as final Agent pair/Stage-B/Windows identity. The canonical wrapper applies tombstone wiring after the base pair materializer; final server is `273db94a... / 116047`.

Local checks on corrected final pair:
- both files compile: PASS;
- cross-file dynamic reservation contract: PASS;
- `reselect_avoiding`: present;
- pending transport recovery marker: present;
- `DynamicReservationLeaseSession`: present;
- durable tombstone path: present exactly once;
- owner-mode instruction isolation: present;
- reservation owner exclusion: present;
- `run_selected` account/thread-safe selection: present.

Durable correction manifest:
- `autonomy/evidence/notion/20260823T2340Z_agent_exact_pair_target_correction.json`;
- control commit creating it: `732abe4f2d113b1b075706f47dc0a122b475b7b7`.

The older machine recipe `autonomy/evidence/notion/20260823T2055Z_agent_exact_pair_handoff.json` / blob `bef5fd03dda26945ea33a6f7ddc585756c6de5fd` is superseded ONLY for final server target identity. Its preimages/materializer SHAs remain useful; its `5c04... / 116047` target must not be propagated.

Disposable PR #23 also asserts stale `5c04... / 116047`; any eventual result from that exact old tree cannot prove the current canonical full-wrapper server identity. Do not duplicate Circle/reconnect diagnostics; repair/use a fresh same-byte composition only after local corrected pair reproduction.

## Corrected delegated engineer/owner five-file set
Use only these exact blobs:
- `payload/delegation_policy.py` = `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `payload/delegation_dispatcher.py` = `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `payload/notion_delegated_model_step.py` = `f36e9c91355dec667173b6265dd550554fb0f05d`;
- `payload/subagent_entrypoint.py` = `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`;
- `payload/server_subagent_lifecycle.py` = `f47838b338f2bd94163cf466110f939c065ac041`.

Do not use old entrypoint `aebefce4...`: wrong imported type name. Previous exact-byte checks: five-file compile PASS; owner prompt propagation/repr isolation/thread rebase semantics PASS.

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
- `tests.test_account_pool_parallelism`.

No-replay/tombstone focused cluster was previously locally green; do not polish it absent a newly reproduced failure. Final same-byte suite still reruns load-bearing post-replace/restart/cancellation tests.

## Coverage/readiness
Core already closed the previous coverage gap:
- final coverage verifier blob `2df0e51ab385d003b2cbdf9126aad0176d62bed6`, commit `cc2e81743cda251911617cf5ebe68061a8de68df`;
- Windows-readiness v5 blob `d6fde58cc908d5cbab553aef887422f86aa82fbb`, commit `147f1442ff12292d2827b333d95cbbca86d7855a`.
Do not reopen unless a new concrete failure appears.

## Core boundary
NOTION_AGENT does not modify PR #7/NCM28/Core Stage-B. Before targeted Windows, on the SAME corrected bytes:
1. reproduce/read back `c9ca6f3b... / 48066` + `273db94a... / 116047`;
2. corrected five-file owner/engineer set + full Agent matrix green;
3. Core Stage-B/full local matrix green;
4. coverage `2df0e51a...` PASS;
5. readiness `d6fde58c... --candidate-root` PASS.
Only after that one targeted Windows Server 2022 run is allowed. Live `Codex -> bridge -> Notion`, rotation/restart/soak comes later after native gates and encrypted runtime restore.

## Persistent memory
Normative protocol: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + exact `autonomy/v3/tools/capsule_runtime_v4.py`.
Fresh current pointer at this pass: `LATEST` blob `a48a4d427d7a04cf468d0d996dd18090c1c0573a`, capsule `20260823T195728Z-63312ff0f1`, archive SHA-256 `842e7dbe4f70b7c71144f23a997eba570712a1d79c0f5ddb4eeeb4c440b572ca`.
A new LATEST must not be published unless the entire normative `restore -> checkpoint -> pack v4 -> immutable upload -> readback every part+manifest -> reread LATEST -> CAS update_file` cycle completes. Durable Git evidence/handoff is not a substitute for pretending a partial capsule is valid.

## Next exact step
1. Core/Agent composition must immediately replace stale server target `5c04.../116047` with corrected canonical final target `273db94a.../116047`.
2. Reproduce both corrected final bytes from frozen preimages + exact materializers and keep them reachable in the same-byte composition/evidence surface; read back SHA+size+compile.
3. Run full Agent matrix on those exact bytes plus corrected five-file delegated set.
4. Hand Core exact corrected pair and test manifest; Core performs same-byte Stage-B/full local matrix + coverage/readiness.
5. No Windows or live Notion/Codex before all local gates above are green.
