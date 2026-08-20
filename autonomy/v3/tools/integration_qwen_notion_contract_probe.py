#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re

QWEN_SAFE_TASK_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
QWEN_SAFE_BATCH_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$")


def _digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def qwen_internal_task_id(*, target: str, canonical_task_id: str) -> str:
    """Stable opaque id for a delegated task entering Qwen.

    The parent-facing task identity remains the original canonical Notion id.
    This internal id only satisfies Qwen's narrower SAFE_TASK_ID domain.
    """
    return f"delegate-{_digest(target + chr(0) + canonical_task_id)[:32]}"


def qwen_persisted_batch_id(*, target: str, parent_turn_id: str, canonical_task_id: str) -> str:
    """Stable persisted batch identity reused across retry/restart.

    A future adapter must reuse this identity and keep retryUncertain disabled by
    default so Qwen's persisted uncertain/running state can block duplicate side effects.
    """
    material = target + chr(0) + parent_turn_id + chr(0) + canonical_task_id
    return f"delegate-{_digest(material)[:40]}"


def main() -> None:
    cases = ["child-a", "child/1", "задача-1", "x" * 81]
    rows = []
    for canonical_task_id in cases:
        internal = qwen_internal_task_id(target="qwen", canonical_task_id=canonical_task_id)
        batch = qwen_persisted_batch_id(
            target="qwen",
            parent_turn_id="parent",
            canonical_task_id=canonical_task_id,
        )
        rows.append(
            {
                "task_id": canonical_task_id,
                "raw_qwen_safe": bool(QWEN_SAFE_TASK_ID.fullmatch(canonical_task_id)),
                "internal_task_id": internal,
                "internal_qwen_safe": bool(QWEN_SAFE_TASK_ID.fullmatch(internal)),
                "batch_id": batch,
                "batch_qwen_safe": bool(QWEN_SAFE_BATCH_ID.fullmatch(batch)),
            }
        )

    assert rows[0]["raw_qwen_safe"] is True
    assert any(row["raw_qwen_safe"] is False for row in rows[1:])
    assert all(row["internal_qwen_safe"] for row in rows)
    assert all(row["batch_qwen_safe"] for row in rows)
    assert qwen_internal_task_id(target="qwen", canonical_task_id="child/1") == qwen_internal_task_id(
        target="qwen", canonical_task_id="child/1"
    )
    assert qwen_persisted_batch_id(target="qwen", parent_turn_id="parent", canonical_task_id="child/1") != qwen_persisted_batch_id(
        target="qwen", parent_turn_id="other-parent", canonical_task_id="child/1"
    )

    print(json.dumps({"verdict": "PASS", "cases": rows}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
