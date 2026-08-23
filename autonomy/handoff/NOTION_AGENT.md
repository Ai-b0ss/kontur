# Notion — ротация / агентность / делегирование — handoff

Обновлено: 2026-08-23 ~22:55 МСК.

## Источник истины
- Product repo: `Ai-b0ss/notion-agent-bridge`.
- Agent PR #8 exact head: `4b344547d5e95bd4b3c62f5b80186059d849ff08`.
- Core PR #7 exact head: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.
- Свежая owner-policy из `Ai-b0ss/kontur#9` важнее старых текстов: Notion Circle connectivity уже доказана; reconnect не повторять.
- Windows пока запрещён: сначала exact Agent pair + corrected delegated composition + полный Agent matrix + Core Stage-B/full matrix на тех же байтах + coverage/readiness PASS.

## Exact Agent pair
Frozen preimages PR #8:
- `payload/account_pool.py` = Git blob `11cea792a2f5aaa40ee1515faddfd44e76cbb23f`, 43173 bytes;
- `payload/server.py` = Git blob `f02cef6a0ffc202c75fbe71c520c72ac19ff876d`, 112748 bytes.

Canonical current materializers:
- `tools/apply_account_pool_dynamic_reservation.py` = `80aeb1872c1cab7f51c33039584b5786e441f9f0`;
- `tools/apply_startup_status_cleanup.py` = `20c2fb2e550daab52f3d27e791fa500002a73735`;
- `tools/apply_subagent_tombstone_wiring.py` = `40ab3a448e33fb8a8c3ce045ef31a815d0554823`;
- `tools/materialize_agent_wiring.py` = `30fb89286eb4457b25b2145918279fec2d735042`;
- `tools/materialize_agent_wiring_with_tombstones.py` = `859039a5e408bc84e7046372cdb509131eb37a97`.

Deterministic transformed targets after accepted startup-cleanup fix:
- `payload/account_pool.py` -> `c9ca6f3b4545e469966369a4220a6a2a60bf3697`, 48066 bytes;
- `payload/server.py` -> `5c04b8cce34b29e63bf1839d59476f8081763c2b`, 116047 bytes.

`ba52edc7...` is stale and forbidden. Target hashes alone are not durable materialization proof until exact bytes are read back from a reachable composition tree/evidence.

Machine-readable recipe: `autonomy/evidence/notion/20260823T2055Z_agent_exact_pair_handoff.json` = blob `bef5fd03dda26945ea33a6f7ddc585756c6de5fd`.

## Corrected delegated engineer/owner five-file set
Use only these exact blobs:
- `payload/delegation_policy.py` = `fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e`;
- `payload/delegation_dispatcher.py` = `a9d15b79b421cd29b094b549be06d2b0319e26d9`;
- `payload/notion_delegated_model_step.py` = `f36e9c91355dec667173b6265dd550554fb0f05d`;
- `payload/subagent_entrypoint.py` = `2d57651b408ef2e6c75f29855f7cdbaeafa97c2e`;
- `payload/server_subagent_lifecycle.py` = `f47838b338f2bd94163cf466110f939c065ac041`.

Do not use old entrypoint `aebefce4...`: it imports the wrong type name.

Fresh local exact-byte verification in NOTION_AGENT pulse `20260823T1937Z`:
- all five files were reconstructed from GitHub blob readback and independently Git-hashed to the exact SHAs above;
- `py_compile` of all five = PASS;
- owner policy propagation smoke = PASS: `SubagentLaunch -> DelegationRequest -> DelegationContext`; private prompt preserved only in owner mode, absent from repr/identity, engineer mode drops dormant owner text;
- Notion delegated model step = PASS: first new owner thread starts with the exact private owner prompt; same-client continuation reuses thread without repeating the private prompt; A->B failover starts fresh with no old thread id; return to stale A also rebases fresh;
- `ServerSubagentLifecycle` owner propagation/rebuild/status path = PASS.

## Disposable exact composition proof branch
A disposable Linux-only branch/PR was created from exact PR #8 head without moving PR #8/Core refs:
- branch `ci/notion-agent-exact-matrix-4b344-20260823`;
- draft PR #23;
- current head `a78500bee531348221d4bc45acf84246027b6071`;
- base exact `4b344547d5e95bd4b3c62f5b80186059d849ff08`.

Its tree contains exactly the corrected five-file set above plus an isolated `.circleci/config.yml`. The job is Linux-only and:
1. verifies pair preimages;
2. checks exact five-file blobs and compiles them;
3. runs canonical pair `--check` then apply;
4. asserts transformed pair `c9ca6f3b...`/48066 and `5c04b8cc...`/116047;
5. compiles transformed pair and requires no transaction journal;
6. runs direct owner/engineer propagation smoke;
7. runs the mandatory prompt/routing/failover/delegation/tool-loop/lifecycle/tombstone matrix including post-replace sync failure and restart/cancellation safety.

Current GitHub combined-status surface for `a78500b...` is empty. This is neither PASS nor FAIL. Do not duplicate the diagnostic or re-prove Circle connectivity; only consume a concrete result if/when it appears.

## Mandatory Agent matrix on composed exact bytes
Must include at least:
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

No-replay/tombstone boundary had prior focused local PASS; do not polish it again absent a newly reproduced failure. Final same-byte suite still must rerun load-bearing post-replace/restart/cancellation tests on the composed bytes.

## Coverage/readiness — stale-gap correction
The old handoff claim that final coverage was still incomplete is obsolete and MUST NOT drive work.
Core already closed it:
- canonical final coverage verifier blob `2df0e51ab385d003b2cbdf9126aad0176d62bed6`, commit `cc2e81743cda251911617cf5ebe68061a8de68df`;
- Windows-readiness v5 blob `d6fde58cc908d5cbab553aef887422f86aa82fbb`, commit `147f1442ff12292d2827b333d95cbbca86d7855a`.
Do not spend another pulse rediscovering/re-fixing coverage unless a new concrete failure appears.

## Core boundary
NOTION_AGENT does not modify PR #7/NCM28/Core Stage-B. Core consumes exact Agent bytes/recipe.
Before targeted Windows, on the SAME bytes:
1. fresh pair readback/blob/size/compile;
2. corrected five-file set + full Agent matrix;
3. Core Stage-B/full local matrix;
4. coverage `2df0e51a...` PASS;
5. readiness `d6fde58c... --candidate-root` PASS.
Only after that exactly one targeted Windows Server 2022 run is allowed. Live `Codex -> bridge -> Notion`, rotation/restart/soak comes later after native gates and encrypted runtime restore.

## Persistent memory
Normative protocol: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json` + `autonomy/v3/tools/capsule_runtime_v4.py`. Unknown capsule bytes must never be reconstructed from conversation memory. Publish LATEST only via full `restore/checkpoint -> pack v4 -> immutable upload -> readback all parts+manifest -> reread LATEST -> CAS update_file`.

At this pulse start, `LATEST` was fresh-read as blob `9bd748cca1c80ffcb5409e0c7c16fd3991012aec`, capsule `20260823T155545Z-4ef01292f2`, archive SHA-256 `ea3fcafdc26cdad76b0c1c6dc2923d6ea6a8513e4db314e40406f7bb46ca7191`. A new pointer is not published unless the entire normative v4 cycle completes; durable Git handoff/#9 evidence is not a substitute for pretending a partial capsule is valid.

## Next exact step
1. Prefer an actual concrete result from disposable PR #23 if it becomes visible; do not create another connectivity probe.
2. Independently finish byte-exact local pair materialization/readback if the exact private source bridge is available.
3. Hand Core reachable exact transformed pair + corrected five-file blobs + test manifest.
4. Core composes Stage-B on those SAME bytes and runs coverage/readiness.
5. No Windows or live Notion/Codex before all local gates above are green.
