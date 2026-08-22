#!/usr/bin/env python3
import hashlib
import json


def current_session_id(session_prefix: str, task_id: str) -> str:
    return f"{session_prefix}-{task_id}"


def candidate_session_id(session_prefix: str, task_id: str) -> str:
    canonical = json.dumps(
        [session_prefix, task_id],
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return "subagent-session-" + hashlib.sha256(canonical).hexdigest()[:48]


def main() -> None:
    left = ("delegate-parent-a", "b-c")
    right = ("delegate-parent-a-b", "c")

    old_left = current_session_id(*left)
    old_right = current_session_id(*right)
    new_left = candidate_session_id(*left)
    new_right = candidate_session_id(*right)

    assert left != right
    assert old_left == old_right == "delegate-parent-a-b-c"
    assert new_left != new_right
    assert candidate_session_id(*left) == new_left
    assert candidate_session_id(*right) == new_right
    assert all(ch.isalnum() or ch in "._-" for ch in new_left)
    assert len(new_left) <= 159

    print(
        json.dumps(
            {
                "verdict": "QWEN_SUBAGENT_SESSION_TUPLE_COLLISION_REPRODUCED_CANDIDATE_PASS",
                "current_collision": old_left,
                "left_pair": left,
                "right_pair": right,
                "candidate_left": new_left,
                "candidate_right": new_right,
                "candidate_distinct": new_left != new_right,
                "candidate_stable": candidate_session_id(*left) == new_left,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
