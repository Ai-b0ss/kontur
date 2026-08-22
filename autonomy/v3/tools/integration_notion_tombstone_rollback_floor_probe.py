from __future__ import annotations

import json


def agent_generation(tombstone: dict[str, object]) -> dict[str, bool]:
    """Model the current Agent generation: unresolved tombstones block replay."""

    unresolved = bool(tombstone["uncertain"] or tombstone["inflight"])
    return {
        "can_launch_child_A": not unresolved,
        "reads_tombstone": True,
    }


def core_generation_rollback(tombstone: dict[str, object]) -> dict[str, bool]:
    """Model rollback to current Core, whose server has no tombstone reader/wiring."""

    del tombstone
    return {
        "can_launch_child_A": True,
        "reads_tombstone": False,
    }


def guarded_rollback(
    tombstone: dict[str, object],
    *,
    compatibility_floor_installed: bool,
) -> dict[str, bool]:
    unresolved = bool(tombstone["uncertain"] or tombstone["inflight"])
    if unresolved and not compatibility_floor_installed:
        return {"rollback_allowed": False, "can_launch_child_A": False}
    return {"rollback_allowed": True, "can_launch_child_A": not unresolved}


def main() -> None:
    tombstone = {
        "uncertain": ["child-A"],
        "inflight": [{"task_id": "child-A", "call_id": "call-write-1"}],
    }
    before = agent_generation(tombstone)
    after = core_generation_rollback(tombstone)
    candidate = guarded_rollback(tombstone, compatibility_floor_installed=False)

    assert before["can_launch_child_A"] is False
    assert after["can_launch_child_A"] is True
    assert after["reads_tombstone"] is False
    assert candidate["rollback_allowed"] is False
    assert candidate["can_launch_child_A"] is False

    print(
        json.dumps(
            {
                "verdict": "NOTION_TOMBSTONE_ROLLBACK_FLOOR_GAP_REPRODUCED_CANDIDATE_PASS",
                "agent_before_rollback": before,
                "current_core_after_rollback": after,
                "candidate_contract": candidate,
                "risk": (
                    "rollback below tombstone-aware Agent generation makes unresolved "
                    "mutating child state invisible and replayable"
                ),
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
