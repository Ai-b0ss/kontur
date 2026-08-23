#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

SCHEMA = "notion_windows_ready_candidate_v2"
HEX40 = re.compile(r"^[0-9a-f]{40}$")

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

    # Current owner policy: the Notion Circle project is already connected and
    # a clean connectivity probe passed. Linux/offline composition work may use
    # Circle, but native Windows remains forbidden until this exact local
    # same-byte candidate is fully green.
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

    # V50 is a useful Agent/Core composition layer, but it does not by itself
    # implement the Stage-B durable provider-intent/finalize and exact replay path.
    # A Windows-ready declaration must therefore identify one immutable unified
    # Stage-B candidate and its exact composed product blobs.
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
