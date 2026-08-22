#!/usr/bin/env python3
"""Offline regression for the Notion Agent -> Core installer payload boundary.

The probe is intentionally independent of product files. It models exact fresh
source facts by blob SHA and checks that local modules directly imported by the
Agent server/materializer are present in the Core integrated-upgrade deployment
manifest. A deployment must fail closed before lifecycle/source mutation when the
closure is incomplete.
"""
from __future__ import annotations

import ast
import json

CORE_INTEGRATED_UPGRADE_BLOB = "0f4393e656307e3b17dfab105464de551f12a05d"
AGENT_SERVER_BLOB = "f02cef6a0ffc202c75fbe71c520c72ac19ff876d"
AGENT_SERVER_SUBAGENT_LIFECYCLE_BLOB = "5c9017350100a10e83072cb93f1b7aaced2c9ad7"
AGENT_MATERIALIZER_BLOB = "2ed85ece7d3323b1619ec0963d3021c1623d0e0a"

# Exact PAYLOAD_NAMES in integrated_upgrade.py at the blob above.
DEPLOYED = {
    "server.py",
    "account_pool.py",
    "diagnostics.py",
    "auth_contract.py",
    "migration_contract.py",
    "stable_identity.py",
    "stable_runtime_state.py",
    "thread_state_registry.py",
    "transport_evidence.py",
    "conversation_segments.py",
    # Exact R2 static bridge dependencies are present but not rewritten.
    "notion_images.py",
    "turn_affinity.py",
}

# Direct local imports in the current Agent server. Only imports relevant to the
# bridge-local payload closure are reproduced here.
SERVER_IMPORTS = """
from prompt_modes import PromptModeError
from account_pool import NotionAccountPool
from diagnostics import log_event
from conversation_segments import ConversationSegmentStore
from stable_runtime_state import stable_conversation_state_path
from auth_contract import AuthGateError
from notion_images import complete_with_images
from turn_affinity import TurnAffinityStore
from server_subagent_lifecycle import ServerSubagentLifecycle
"""

# The current materializer adds this import to server.py.
MATERIALIZER_IMPORTS = """
from reservation_aware_lease import DynamicReservationLeaseSession
"""

# The first direct dependency level of server_subagent_lifecycle.py shows that the
# gap is not just two files; the deployed runtime needs an explicit packaging
# contract for the whole child-agent graph.
SUBAGENT_LIFECYCLE_IMPORTS = """
from payload.delegation_dispatcher import DelegationResult
from payload.notion_delegation_adapter import DelegationAccountPool
from payload.notion_subagent_runtime import ReservedAccountIds
from payload.server_subagent_runtime import RuntimeToolCaller
from payload.subagent_entrypoint import SubagentEntryPoint
from payload.subagent_tombstone_store import SubagentTombstoneStore
"""


def top_level_local_modules(source: str) -> set[str]:
    tree = ast.parse(source)
    result: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom) or not node.module:
            continue
        module = node.module
        if module.startswith("payload."):
            result.add(module.split(".", 1)[1] + ".py")
        elif "." not in module:
            result.add(module + ".py")
    return result


current_required = top_level_local_modules(SERVER_IMPORTS)
after_materialize_required = current_required | top_level_local_modules(MATERIALIZER_IMPORTS)
child_required = top_level_local_modules(SUBAGENT_LIFECYCLE_IMPORTS)

missing_current = sorted(current_required - DEPLOYED)
missing_after_materialize = sorted(after_materialize_required - DEPLOYED)
missing_child_graph_level1 = sorted(child_required - DEPLOYED)

assert missing_current == ["prompt_modes.py", "server_subagent_lifecycle.py"]
assert "reservation_aware_lease.py" in missing_after_materialize
assert "subagent_tombstone_store.py" in missing_child_graph_level1
assert "delegation_dispatcher.py" in missing_child_graph_level1

print(json.dumps({
    "verdict": "NOTION_AGENT_CORE_INSTALL_PAYLOAD_CLOSURE_GAP_REPRODUCED",
    "source_blobs": {
        "integrated_upgrade.py": CORE_INTEGRATED_UPGRADE_BLOB,
        "payload/server.py": AGENT_SERVER_BLOB,
        "payload/server_subagent_lifecycle.py": AGENT_SERVER_SUBAGENT_LIFECYCLE_BLOB,
        "tools/apply_startup_status_cleanup.py": AGENT_MATERIALIZER_BLOB,
    },
    "missing_current_server_direct": missing_current,
    "missing_after_materializer_direct": missing_after_materialize,
    "missing_child_graph_level1": missing_child_graph_level1,
    "required_contract": (
        "Before lifecycle stop or source write, compute/verify an explicit deployable local-module "
        "closure for the materialized bridge. Every required module must be copied under a runtime "
        "namespace consistent with its imports, hash-bound in the outer journal/installed marker, "
        "backed up and rollback-safe. Incomplete closure must fail before mutation."
    ),
}, ensure_ascii=False, sort_keys=True))
