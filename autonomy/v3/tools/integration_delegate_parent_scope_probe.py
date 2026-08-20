#!/usr/bin/env python3
import hashlib
import json
import random
import string


def current_key(target: str, parent_turn_id: str, task_id: str) -> str:
    return f"delegate:{target}:{task_id.strip()}"


def proposed_key(target: str, parent_turn_id: str, task_id: str) -> str:
    parent = parent_turn_id.strip()
    task = task_id.strip()
    material = json.dumps(
        [target, parent, task],
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    digest = hashlib.sha256(material).hexdigest()
    return f"delegate:{target}:{digest}"


def main() -> None:
    a = ("notion", "parent-A", "child-1")
    b = ("notion", "parent-B", "child-1")
    assert a[1] != b[1]
    assert current_key(*a) == current_key(*b)
    assert proposed_key(*a) != proposed_key(*b)

    assert proposed_key("qwen", " parent-A ", " child-1 ") == proposed_key(
        "qwen", "parent-A", "child-1"
    )
    assert proposed_key("notion", "parent-A", "child-1") != proposed_key(
        "qwen", "parent-A", "child-1"
    )

    rng = random.Random(20260820)
    seen: dict[str, tuple[str, str, str]] = {}
    for i in range(10000):
        alphabet = string.ascii_letters + string.digits + ":/_-"
        parent = "p-" + "".join(rng.choice(alphabet) for _ in range(20))
        task = "t-" + "".join(rng.choice(alphabet) for _ in range(20))
        target = "notion" if i % 2 == 0 else "qwen"
        key = proposed_key(target, parent, task)
        ident = (target, parent, task)
        if key in seen and seen[key] != ident:
            raise AssertionError(f"candidate collision: {seen[key]} vs {ident}")
        seen[key] = ident
        assert key == proposed_key(target, parent, task)

    print(
        json.dumps(
            {
                "verdict": "PASS",
                "current_collision_reproduced": True,
                "candidate_parent_scoped": True,
                "candidate_deterministic": True,
                "candidate_fuzz_cases": 10000,
                "candidate_collision_count": 0,
                "example_current_key": current_key(*a),
                "example_candidate_a": proposed_key(*a),
                "example_candidate_b": proposed_key(*b),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
