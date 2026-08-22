#!/usr/bin/env python3
"""Offline semantic regression for Qwen tool-policy/thread affinity.

This intentionally does not call Qwen.  It models the exact current server decision
(`existingChatId` depends on rollover + saved-account availability) against the
already-persisted `toolPromptHash` contract, then checks the minimal conservative
candidate: a changed exact tool prompt must force a fresh upstream thread.
"""
from __future__ import annotations

import hashlib
import json


def prompt_hash(prompt: str) -> str:
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16] if prompt else ""


def current_existing_chat_id(record: dict | None, *, saved_account_available: bool, rollover: bool):
    return (record.get("chatId") if record else None) if (not rollover and saved_account_available) else None


def candidate_existing_chat_id(
    record: dict | None,
    requested_tool_prompt_hash: str,
    *,
    saved_account_available: bool,
    rollover: bool,
):
    if not record or not record.get("chatId"):
        return None
    tool_policy_changed = record.get("toolPromptHash") != requested_tool_prompt_hash
    return record.get("chatId") if (not rollover and saved_account_available and not tool_policy_changed) else None


def main() -> None:
    read_write = (
        "# Tools\n"
        "- read_file{path:string}\n"
        "- write_file{path:string;content:string}\n"
        "Rules: tools allowed"
    )
    read_only = "# Tools\n- read_file{path:string}\nRules: tools allowed"
    required = read_only + "\n- You MUST call at least one tool in this turn using <tool_call> before answering."

    old_hash = prompt_hash(read_write)
    read_only_hash = prompt_hash(read_only)
    required_hash = prompt_hash(required)
    assert len({old_hash, read_only_hash, required_hash}) == 3

    record = {"chatId": "chat-old", "accountId": "acct-A", "toolPromptHash": old_hash}
    current = current_existing_chat_id(record, saved_account_available=True, rollover=False)
    candidate = candidate_existing_chat_id(
        record,
        read_only_hash,
        saved_account_available=True,
        rollover=False,
    )
    assert current == "chat-old"
    assert candidate is None

    assert candidate_existing_chat_id(
        record,
        old_hash,
        saved_account_available=True,
        rollover=False,
    ) == "chat-old"

    legacy = {"chatId": "chat-legacy", "accountId": "acct-A"}
    assert candidate_existing_chat_id(
        legacy,
        read_only_hash,
        saved_account_available=True,
        rollover=False,
    ) is None

    read_only_record = {
        "chatId": "chat-read-only",
        "accountId": "acct-A",
        "toolPromptHash": read_only_hash,
    }
    assert candidate_existing_chat_id(
        read_only_record,
        required_hash,
        saved_account_available=True,
        rollover=False,
    ) is None

    print(json.dumps({
        "verdict": "QWEN_TOOL_POLICY_THREAD_AFFINITY_GAP_REPRODUCED_CANDIDATE_PASS",
        "current_reuses_old_thread_after_tool_policy_change": True,
        "candidate_rebases_on_tool_policy_change": True,
        "candidate_keeps_thread_when_policy_hash_same": True,
        "legacy_record_rebases_once": True,
        "tool_choice_change_rebases": True,
        "old_hash": old_hash,
        "read_only_hash": read_only_hash,
        "required_hash": required_hash,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
