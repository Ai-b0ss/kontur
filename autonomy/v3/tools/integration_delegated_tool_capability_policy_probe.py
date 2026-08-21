#!/usr/bin/env python3
import hashlib, json

NOTION_DEFAULT = {"list_files","read_file","write_file","edit_file","run_shell"}
QWEN_FILES_TRUE = {"list_dir","read_file","write_file","edit_file","append_file"}
QWEN_TERMINAL_TRUE = {"bash"}

# Example parent turn intentionally exposes only read-only project tools.
parent_allowed = {"list_files","read_file"}

# Current provider-neutral envelope has no capability field. The two child runtimes
# therefore fall back to their own defaults/fixed catalogs.
current_notion_child = set(NOTION_DEFAULT)
current_qwen_child = set(QWEN_FILES_TRUE | QWEN_TERMINAL_TRUE)

assert current_notion_child - parent_allowed == {"write_file","edit_file","run_shell"}
assert {"write_file","edit_file","append_file","bash"}.issubset(current_qwen_child - {"read_file"})

# Candidate neutral contract: explicit immutable capability allowlist. Unknown or
# missing policy must fail closed for delegated execution rather than widen access.
def canonical_policy(tools):
    if tools is None:
        raise ValueError("delegated tool capability policy required")
    clean=[]
    for raw in tools:
        name=str(raw).strip()
        if not name or name in clean:
            raise ValueError("invalid/duplicate delegated tool capability")
        clean.append(name)
    clean.sort()
    payload=json.dumps(clean,separators=(",",":"),ensure_ascii=True)
    return tuple(clean), hashlib.sha256(payload.encode()).hexdigest()

allowed, fp = canonical_policy(parent_allowed)
assert set(allowed)==parent_allowed
assert "write_file" not in allowed and "run_shell" not in allowed

# A Qwen adapter cannot safely approximate read-only with files=true: that also
# enables write/edit/append. It must either support a granular allowlist or reject
# this policy until the Qwen executor can represent it exactly.
def qwen_current_mapping(allowed):
    s=set(allowed)
    if s <= {"list_dir","read_file"}:
        # Current boolean `files` cannot express read-only because files=true adds writes.
        return {"representable": False, "reason": "QWEN_FILES_FLAG_IS_COARSE"}
    return {"representable": False, "reason": "GRANULAR_ALLOWLIST_REQUIRED"}

qmap=qwen_current_mapping({"read_file"})
assert qmap["representable"] is False

# A Notion child can filter its fixed catalog exactly before exposing tools.
notion_filtered = current_notion_child & parent_allowed
assert notion_filtered == parent_allowed

print(json.dumps({
    "verdict":"DELEGATED_TOOL_CAPABILITY_POLICY_GAP_REPRO_PASS",
    "parent_policy":"read_only",
    "current_notion_escalated_tools":sorted(current_notion_child-parent_allowed),
    "current_qwen_defaults_include_mutators":sorted({"write_file","edit_file","append_file","bash"} & current_qwen_child),
    "neutral_envelope_can_express_policy":False,
    "candidate_policy_fingerprint":fp,
    "candidate_notion_exact_filter":sorted(notion_filtered),
    "candidate_qwen_current_mapping_fail_closed":qmap,
},ensure_ascii=False,sort_keys=True))
