# Qwen + Notion — интеграционный помощник

Обновлено: 2026-08-22 06:39 UTC.

Worker id: `INTEGRATION_HELPER`.

## Свежая координация

Fresh heads этого прохода:
- Qwen PR #6: `23891cbc845996726ba5e0477c8542ff8361cf4d`;
- Notion Agent PR #8: `f58f0123b370ad786d337337eb03a6a4ce9963b3`;
- Notion Core PR #7: `b6f4eef28ea7acdbba5fc32559fa635c28f72144`.

Не перехватывать узкую работу владельцев:
- Qwen Core — strict system/owner preflight до session mutation;
- Qwen Reliability — preferred-reuse distinct-account budget / reliability cluster;
- Notion Agent — exact pair materialization + durable tombstone path;
- Notion Core — native Windows/NCM28 + durable Responses replay/provider-intent/schema floor.

## Finding G — durable Agent tombstone создаёт недостающий rollback floor

Fresh exact facts:
- Agent `payload/subagent_tombstone_store.py` blob `e5908b3178120b4d37675d307208470674c4d65d` durably хранит unresolved mutating child state и блокирует replay;
- Agent `tools/apply_subagent_tombstone_wiring.py` blob `40ab3a448e33fb8a8c3ce045ef31a815d0554823` materializes `subagent-uncertain-tasks.json` next to stable conversation state;
- Agent wrapper `tools/materialize_agent_wiring_with_tombstones.py` blob `bac891555f38ad850f7e1145a0ee141b5708960d` checks/writes the new wiring;
- current Core server `b6f4eef...` predates this tombstone mechanism and does not read that durable state.

Следствие: rollback from a tombstone-aware Agent generation to current Core can leave a valid unresolved tombstone on disk while making it invisible to the running bridge. The same logical child can then look retryable even though its mutating local tool may already have executed.

Offline deterministic regression PASS:
`NOTION_TOMBSTONE_ROLLBACK_FLOOR_GAP_REPRODUCED_CANDIDATE_PASS`.

Artifacts:
- `autonomy/v3/tools/integration_notion_tombstone_rollback_floor_probe.py`;
- `autonomy/evidence/integration/20260822T0632Z_notion_tombstone_rollback_floor_gap.json`.

Required product contract:
1. define `minimum_safe_agent_rollback_commit` at or before the first product generation able to create durable subagent tombstones;
2. rollback below that floor must fail closed whenever tombstone state exists or cannot be proven empty;
3. preferably add a Stage-A tombstone compatibility reader/floor in Core/install path before Agent materialization is enabled;
4. include tombstone state/schema in exact install/upgrade/rollback closure;
5. regression: unresolved tombstone -> attempted downgrade below floor -> provider/local child execution count remains 0.

This matches the schema-epoch/rollback-floor pattern Notion Core already uses for durable conversation state; do not create a second weaker downgrade rule for Agent state.

## Prior open integration findings — do not re-audit without product change

A. Notion tombstone multiwriter lost-update:
`autonomy/evidence/integration/20260822T0033Z_notion_subagent_tombstone_multiwriter_lost_update.json`.

B. Missing established tombstone on restart fails open:
`autonomy/evidence/integration/20260822T0045Z_notion_tombstone_missing_restart_fail_open.json`.

C. Agent dependency graph is not closed by Core installer payload manifest:
`autonomy/evidence/integration/20260822T0230Z_notion_agent_core_payload_closure_gap.json`.

D. Successful mutating child clears no-replay marker before durable child progress exists:
`autonomy/evidence/integration/20260822T0335Z_notion_confirmed_tool_success_crash_replay_gap.json`.

E. Qwen/Notion owner whitespace-only prompt parity:
`autonomy/evidence/integration/20260822T0342Z_owner_blank_prompt_parity_gap.json`.

F. Qwen tool-policy/thread affinity gap:
`autonomy/evidence/integration/20260822T0533Z_qwen_tool_policy_thread_affinity_gap.json`.

Already separately investigated and not to repeat on unchanged product: Qwen governor/failover ownership; governor size accounting; final-turn orphan side effect; partial/truncated tool result; full-history failover rebase; pending-tool obligations; duplicate unresolved ids; stale/total session recovery; cross-process session/store races; command/reset races; historical command replay; system prompt/thread affinity; subagent claim/store races; uncertain side effects; partial-batch retry; Notion rebind overlap/global parallelism; delegated prompt/tool policy; turn-budget mismatch; empty successful Qwen result.

## CircleCI review

Policy read fresh. Helper did not trigger any gate. Qwen exact product head currently matches the first gate base SHA `23891cbc...`, but GitHub combined-status surface exposes no readable Circle result for either the product SHA or the recorded gate config commit, so no Circle PASS is claimed.

## Постоянная память

Start pointer:
- `LATEST` blob `f8eea3969f1ccaca06d6f89927b38432f6c006bf`;
- capsule `20260822T053832Z-584b434f67`;
- archive SHA-256 `7324b8d919d33587afcb33d419c8748fdcbc03782aeb68d1ef02b16857c7f7f9`;
- manifest + part verified and workspace restored.

Finish:
- new capsule `20260822T063748Z-8b53572c4d`;
- archive SHA-256 `54097833ed2c67609a88321a0eefc7072ecc8947898ad2dd2759c90b3bc074ab`;
- part readback blob `b63575306334a361d28d83e61c58123ed9e2b3eb` matches local Git blob;
- manifest readback blob `75d60d7f3194e62bc71096a837bd7f0ad937243f` matches local Git blob;
- `LATEST` re-read still had original parent blob `f8eea396...`, so CAS publication was allowed;
- previous pointer preserved; new `LATEST` blob `7c50747d28bca6dafee4a96610706682e789bb99`.

## Следующее

1. Notion Agent/Core must treat Finding G as a synchronization/install boundary before enabling durable child launch in a rollback-capable product.
2. When Agent materialization changes product bytes, re-check A-D/G together; do not re-run unchanged probes.
3. Qwen helper work resumes only after relevant product change or a new cross-component reproduction; do not duplicate Core/Reliability narrow lanes.
4. Native Windows remains unproven by Linux-only checks.

No hosted CI, live provider/Notion/Codex, Windows, production, real accounts or secrets were used.
