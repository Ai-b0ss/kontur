#!/usr/bin/env python3
import json


def current_is_command(messages):
    users = [m for m in reversed(messages) if m.get("role") == "user"]
    if not users:
        return False
    content = users[0].get("content")
    text = content.strip() if isinstance(content, str) else ""
    return text.startswith("$qwen-api") or text.startswith("/qwen-api")


def candidate_is_command(messages):
    if not messages:
        return False
    last = messages[-1]
    if last.get("role") != "user":
        return False
    content = last.get("content")
    text = content.strip() if isinstance(content, str) else ""
    return text.startswith("$qwen-api") or text.startswith("/qwen-api")


def main():
    command_only = [{"role": "user", "content": "$qwen-api reset"}]
    historical_command_then_tool = [
        {"role": "user", "content": "$qwen-api reset"},
        {"role": "assistant", "content": "reset complete"},
        {"role": "tool", "tool_call_id": "call-1", "content": "done"},
    ]
    historical_command_then_assistant = [
        {"role": "user", "content": "$qwen-api account remove acct-A"},
        {"role": "assistant", "content": "removed"},
    ]
    normal_new_user = [
        {"role": "user", "content": "$qwen-api reset"},
        {"role": "assistant", "content": "reset complete"},
        {"role": "user", "content": "continue"},
    ]

    current = {
        "command_only": current_is_command(command_only),
        "historical_command_then_tool": current_is_command(historical_command_then_tool),
        "historical_command_then_assistant": current_is_command(historical_command_then_assistant),
        "normal_new_user": current_is_command(normal_new_user),
    }
    candidate = {
        "command_only": candidate_is_command(command_only),
        "historical_command_then_tool": candidate_is_command(historical_command_then_tool),
        "historical_command_then_assistant": candidate_is_command(historical_command_then_assistant),
        "normal_new_user": candidate_is_command(normal_new_user),
    }

    assert current == {
        "command_only": True,
        "historical_command_then_tool": True,
        "historical_command_then_assistant": True,
        "normal_new_user": False,
    }
    assert candidate == {
        "command_only": True,
        "historical_command_then_tool": False,
        "historical_command_then_assistant": False,
        "normal_new_user": False,
    }

    print(json.dumps({
        "verdict": "QWEN_HISTORICAL_COMMAND_REPLAY_REPRODUCED",
        "current": current,
        "candidate": candidate,
        "contract": "management command is executable only when the final message of the request is that user command",
    }, sort_keys=True))


if __name__ == "__main__":
    main()
