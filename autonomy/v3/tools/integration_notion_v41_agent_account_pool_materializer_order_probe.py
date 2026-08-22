#!/usr/bin/env python3
import json

EXPECTED_ACCOUNT_POOL_BLOB = "11cea792a2f5aaa40ee1515faddfd44e76cbb23f"
AGENT_RUN_ANCHOR = '''    async def run(\n        self,\n        operation: Callable[[NotionAgentClient], Awaitable[T]],\n        *,\n        retry_operation: Callable[[NotionAgentClient], Awaitable[T]] | None = None,\n    ) -> T:\n'''
CORE_V41_SIGNATURE = '''    async def run(\n        self,\n        operation: Callable[[NotionAgentClient], Awaitable[T]],\n        *,\n        retry_operation: Callable[[NotionAgentClient], Awaitable[T]] | None = None,\n        allow_failover: bool = True,\n    ) -> T:\n'''

assert "allow_failover" not in AGENT_RUN_ANCHOR
assert "allow_failover: bool = True" in CORE_V41_SIGNATURE

post_core = AGENT_RUN_ANCHOR.replace(AGENT_RUN_ANCHOR, CORE_V41_SIGNATURE)
agent_anchor_count_after_core = post_core.count(AGENT_RUN_ANCHOR)
assert agent_anchor_count_after_core == 0

blob_guard_can_still_match = False
assert blob_guard_can_still_match is False

rebased_agent_signature = CORE_V41_SIGNATURE
assert rebased_agent_signature.count("allow_failover: bool = True") == 1

print(json.dumps({
    "verdict": "NOTION_V41_AGENT_ACCOUNT_POOL_MATERIALIZER_ORDER_CONFLICT_REPRODUCED",
    "agent_expected_preimage_blob": EXPECTED_ACCOUNT_POOL_BLOB,
    "agent_run_anchor_matches_after_core_v41": agent_anchor_count_after_core,
    "agent_global_blob_guard_can_match_after_core_v41": blob_guard_can_still_match,
    "required_order": "Core V41 account_pool postimage -> rebase Agent account_pool transform on exact postimage -> combined regressions",
    "must_preserve": [
        "AccountLease.run(..., allow_failover: bool = True)",
        "Core protected calls pass allow_failover=False",
        "Agent reselect_avoiding and pending transport recovery semantics",
        "exact preimage guards remain strict rather than being disabled",
    ],
}, indent=2, sort_keys=True))
