#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

SCHEMA = "notion_windows_ready_candidate_v4"
HEX40 = re.compile(r"^[0-9a-f]{40}$")
FINAL_GATE_COVERAGE_VERIFIER_BLOB = "76ebba1f3e7cb4e7d2fa49d46868cac24b555535"

REQUIRED_BLOBS = (
    "conversation_segments.py",
    "server.py",
    "account_pool.py",
    "reservation_aware_lease.py",
    "subagent_tombstone_store.py",
)

REQUIRED_GATES = (
    "stage_a_v32_fail_closed_floor",
    "agent_exact_materialization",
    "agent_tombstone_post_replace_sync_failure",
    "agent_tombstone_restart",
    "agent_delegated_cancellation",
    "agent_dynamic_reservation",
    # Startup cleanup is a load-bearing Agent/Core composition boundary. Both
    # direct failure chaining and repeated-cancellation/shield behavior must be
    # green on the exact same-byte candidate.
    "agent_startup_status_cleanup",
    "agent_startup_status_repeated_cancellation",
    "agent_prompt_modes",
    "agent_prompt_policy_identity",
    "agent_responses_prompt_mode_http_contract",
    "agent_responses_prompt_wiring_contract",
    "agent_delegation_policy",
    "agent_delegation_dispatcher",
    "agent_delegated_model_step",
    "agent_subagent_entrypoint",
    "agent_foreground_slot_routing",
    "agent_server_subagent_wiring_materializer",
    "protected_no_failover",
    "strict_provider_intent_finalize",
    "canonical_responses_replay",
    "canonical_compaction_replay",
    "restart_exact_replay",
    "stream_nonstream_same_canonical_result",
    "stream_disconnect_commit_survives",
    "ambiguous_transport_single_attempt",
    "removed_account_fail_closed",
    "ttl_replay_expiry",
    "size_budget",
    "oversize_tombstone_fail_closed",
    "stale_retry_after_ring_eviction",
    "rollback_floor",
    "codex_shell_env_secret_exclusion",
    "final_gate_coverage",
)


def fail(errors: list[str]) -> int:
    print("NOTION_WINDOWS_READY_NOT_READY")
    for item in errors:
        print(f"MISSING_OR_INVALID:{item}")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()

    try:
        doc = json.loads(args.manifest.read_text(encoding="utf-8"))
    except Exception as exc:
        return fail([f"manifest:{type(exc).__name__}"])

    errors: list[str] = []
    if doc.get("schema") != SCHEMA:
        errors.append("schema")

    for key in ("core_head", "agent_head", "composition_materializer_blob"):
        value = doc.get(key)
        if not isinstance(value, str) or not HEX40.fullmatch(value):
            errors.append(key)

    if doc.get("final_gate_coverage_verifier_blob") != FINAL_GATE_COVERAGE_VERIFIER_BLOB:
        errors.append("final_gate_coverage_verifier_blob")

    if doc.get("circle_connectivity") != "PASS":
        errors.append("circle_connectivity")
    if doc.get("native_windows_run_started") is not False:
        errors.append("native_windows_run_started")
    if doc.get("readiness_label") != "READY_FOR_TARGETED_WINDOWS_CIRCLE":
        errors.append("readiness_label")

    blobs = doc.get("composed_blobs")
    if not isinstance(blobs, dict):
        errors.append("composed_blobs")
    else:
        for key in REQUIRED_BLOBS:
            value = blobs.get(key)
            if not isinstance(value, str) or not HEX40.fullmatch(value):
                errors.append(f"composed_blobs.{key}")

    gates = doc.get("local_gates")
    if not isinstance(gates, dict):
        errors.append("local_gates")
    else:
        for key in REQUIRED_GATES:
            if gates.get(key) != "PASS":
                errors.append(f"local_gates.{key}")

    if doc.get("stage_b_unified_candidate") != "PASS":
        errors.append("stage_b_unified_candidate")
    if doc.get("v50_only") is not False:
        errors.append("v50_only")

    if errors:
        return fail(errors)
    print("READY_FOR_TARGETED_WINDOWS_CIRCLE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
