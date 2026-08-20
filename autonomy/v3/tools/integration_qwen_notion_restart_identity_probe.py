#!/usr/bin/env python3
import hashlib
import json
import re

SAFE_TASK_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
SAFE_BATCH_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$")
SAFE_SESSION_PREFIX = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$")


def qwen_task_signature(tasks, context):
    normalized = {
        "tasks": [
            {"id": task["id"], "prompt": task["prompt"], "skills": task.get("skills", [])}
            for task in tasks
        ],
        "context": context,
    }
    # Node JSON.stringify on this ASCII-only fixture is equivalent to these separators.
    payload = json.dumps(normalized, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def stable_qwen_delegate_identity(parent_turn_id, task_id):
    canonical = f"{parent_turn_id.strip()}\0{task_id.strip()}".encode("utf-8")
    digest = hashlib.sha256(canonical).hexdigest()
    return {
        "task_id": f"qwen-task-{digest[:24]}",
        "batch_id": f"qwen-batch-{digest[:32]}",
        "session_prefix": f"qwen-delegate-{digest[:32]}",
    }


def main():
    tasks = [{"id": "child-1", "prompt": "fix file", "skills": []}]
    base = {
        "mode": "engineer",
        "model": "qwen3.8-max",
        "settings": {
            "terminal": True,
            "files": True,
            "webSearch": False,
            "thinking": False,
            "maxRounds": 8,
            "streamRecoveryAttempts": 2,
        },
        "ownerPromptSha256": None,
    }
    first = dict(base, sessionPrefix="subagent-agent-11111111-1111-1111-1111-111111111111")
    restarted = dict(base, sessionPrefix="subagent-agent-22222222-2222-2222-2222-222222222222")
    first_signature = qwen_task_signature(tasks, first)
    restarted_signature = qwen_task_signature(tasks, restarted)
    assert first_signature != restarted_signature, "random sessionPrefix unexpectedly preserved batch signature"

    ids1 = stable_qwen_delegate_identity("parent/α", "child/1")
    ids2 = stable_qwen_delegate_identity("parent/α", "child/1")
    assert ids1 == ids2
    assert SAFE_TASK_ID.fullmatch(ids1["task_id"])
    assert SAFE_BATCH_ID.fullmatch(ids1["batch_id"])
    assert SAFE_SESSION_PREFIX.fullmatch(ids1["session_prefix"])

    stable_first = dict(base, sessionPrefix=ids1["session_prefix"])
    stable_second = dict(base, sessionPrefix=ids2["session_prefix"])
    assert qwen_task_signature(tasks, stable_first) == qwen_task_signature(tasks, stable_second)

    print(json.dumps({
        "verdict": "PASS",
        "current_random_prefix_breaks_persisted_signature": True,
        "stable_identity_is_restart_deterministic": True,
        "stable_ids": ids1,
        "first_signature": first_signature,
        "restarted_signature": restarted_signature,
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
