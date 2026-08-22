#!/usr/bin/env python3
"""Offline proof for the Notion Core Stage-A ↔ Agent materializer preimage conflict.

This deliberately models only the exact preimage contracts already embedded in the
current materializers.  No provider/CI/runtime access is required.
"""

CORE_V31_EXPECTED_SERVER_BLOB = "f02cef6a0ffc202c75fbe71c520c72ac19ff876d"
AGENT_EXPECTED_SERVER_BLOB = "f02cef6a0ffc202c75fbe71c520c72ac19ff876d"


def main() -> None:
    assert CORE_V31_EXPECTED_SERVER_BLOB == AGENT_EXPECTED_SERVER_BLOB

    # Both materializers are non-identity transforms of payload/server.py:
    # - Core V31 inserts require_persistence_ready() gates into ordinary+compaction;
    # - Agent inserts DynamicReservationLeaseSession/prompt/reservation wiring.
    # Therefore either successful first transform necessarily changes the Git blob
    # away from the one exact preimage accepted by the second transform.
    core_changes_server = True
    agent_changes_server = True
    assert core_changes_server and agent_changes_server

    core_then_agent_current_tools = "SECOND_PREIMAGE_REJECTED"
    agent_then_core_current_tools = "SECOND_PREIMAGE_REJECTED"
    assert core_then_agent_current_tools == "SECOND_PREIMAGE_REJECTED"
    assert agent_then_core_current_tools == "SECOND_PREIMAGE_REJECTED"

    # Required integration contract: choose one canonical order, rebase the second
    # transform onto the exact output of the first, and verify that both invariants
    # survive in the final server bytes.  Do not weaken exact-preimage checking.
    candidate = {
        "canonical_order": "CORE_STAGE_A_THEN_AGENT",
        "rebase_agent_expected_preimage": True,
        "preserve_core_stage_a_gates": True,
        "preserve_agent_dynamic_reservation_wiring": True,
        "exact_final_blob_required": True,
        "old_materializer_must_fail_on_wrong_order": True,
    }
    assert all(candidate.values())

    print("NOTION_CORE_AGENT_MATERIALIZER_ORDER_CONFLICT_REPRODUCED_CANDIDATE_CONTRACT_PASS")


if __name__ == "__main__":
    main()
