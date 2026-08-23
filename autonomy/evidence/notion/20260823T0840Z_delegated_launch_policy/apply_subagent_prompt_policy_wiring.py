from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

EXPECTED_ENTRYPOINT_BLOB = "ff489004c4ff8f195eea028f6b1e314feb57408d"
EXPECTED_LIFECYCLE_BLOB = "96b07cf8e8069586b33b516a1d66e38b6439a4f9"

ENTRY_IMPORT_ANCHOR = "from dataclasses import dataclass\n"
ENTRY_IMPORT_REPLACEMENT = "from dataclasses import dataclass, field\n"
ENTRY_POLICY_IMPORT_ANCHOR = "from payload.delegation_policy import DelegateTarget, DelegationRequest\n"
ENTRY_POLICY_IMPORT_REPLACEMENT = "from payload.delegation_policy import DelegateTarget, DelegationRequest, PromptMode\n"

ENTRY_LAUNCH_ANCHOR = """@dataclass(frozen=True, slots=True)
class SubagentLaunch:
    task_id: str
    parent_turn_id: str
    objective: str
    target: DelegateTarget = "notion"
    max_model_turns: int = 8
"""
ENTRY_LAUNCH_REPLACEMENT = """@dataclass(frozen=True, slots=True)
class SubagentLaunch:
    task_id: str
    parent_turn_id: str
    objective: str
    target: DelegateTarget = "notion"
    max_model_turns: int = 8
    prompt_mode: PromptMode = "engineer"
    owner_system_prompt: str | None = field(default=None, repr=False)
"""

ENTRY_REQUEST_ANCHOR = """                target=launch.target,
                max_model_turns=launch.max_model_turns,
            )
"""
ENTRY_REQUEST_REPLACEMENT = """                target=launch.target,
                max_model_turns=launch.max_model_turns,
                prompt_mode=launch.prompt_mode,
                owner_system_prompt=launch.owner_system_prompt,
            )
"""

LIFECYCLE_REQUEST_ANCHOR = """                target=launch.target,
                max_model_turns=launch.max_model_turns,
            )
        )
"""
LIFECYCLE_REQUEST_REPLACEMENT = """                target=launch.target,
                max_model_turns=launch.max_model_turns,
                prompt_mode=launch.prompt_mode,
                owner_system_prompt=launch.owner_system_prompt,
            )
        )
"""

LIFECYCLE_REBUILD_ANCHOR = """            target=request.target,
            max_model_turns=request.max_model_turns,
        )
"""
LIFECYCLE_REBUILD_REPLACEMENT = """            target=request.target,
            max_model_turns=request.max_model_turns,
            prompt_mode=request.prompt_mode,
            owner_system_prompt=request.owner_system_prompt,
        )
"""


def git_blob_sha(text: str) -> str:
    raw = text.encode("utf-8")
    return hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()


def _replace_exact(text: str, anchor: str, replacement: str, label: str) -> str:
    count = text.count(anchor)
    if count != 1:
        raise RuntimeError(f"{label}_PREIMAGE_MISMATCH:{count}")
    return text.replace(anchor, replacement, 1)


def apply_entrypoint(text: str, *, enforce_blob: bool = True) -> str:
    if enforce_blob:
        actual = git_blob_sha(text)
        if actual != EXPECTED_ENTRYPOINT_BLOB:
            raise RuntimeError(f"SUBAGENT_ENTRYPOINT_SOURCE_BLOB_MISMATCH:{actual}")
    updated = text
    for anchor, replacement, label in (
        (ENTRY_IMPORT_ANCHOR, ENTRY_IMPORT_REPLACEMENT, "ENTRY_DATACLASS_IMPORT"),
        (ENTRY_POLICY_IMPORT_ANCHOR, ENTRY_POLICY_IMPORT_REPLACEMENT, "ENTRY_POLICY_IMPORT"),
        (ENTRY_LAUNCH_ANCHOR, ENTRY_LAUNCH_REPLACEMENT, "ENTRY_LAUNCH"),
        (ENTRY_REQUEST_ANCHOR, ENTRY_REQUEST_REPLACEMENT, "ENTRY_REQUEST"),
    ):
        updated = _replace_exact(updated, anchor, replacement, label)
    compile(updated, "payload/subagent_entrypoint.py", "exec")
    return updated


def apply_lifecycle(text: str, *, enforce_blob: bool = True) -> str:
    if enforce_blob:
        actual = git_blob_sha(text)
        if actual != EXPECTED_LIFECYCLE_BLOB:
            raise RuntimeError(f"SERVER_SUBAGENT_LIFECYCLE_SOURCE_BLOB_MISMATCH:{actual}")
    updated = _replace_exact(
        text,
        LIFECYCLE_REQUEST_ANCHOR,
        LIFECYCLE_REQUEST_REPLACEMENT,
        "LIFECYCLE_REQUEST",
    )
    updated = _replace_exact(
        updated,
        LIFECYCLE_REBUILD_ANCHOR,
        LIFECYCLE_REBUILD_REPLACEMENT,
        "LIFECYCLE_REBUILD",
    )
    compile(updated, "payload/server_subagent_lifecycle.py", "exec")
    return updated


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    root = Path(args.root)
    entry = root / "payload" / "subagent_entrypoint.py"
    lifecycle = root / "payload" / "server_subagent_lifecycle.py"
    entry_text = entry.read_text(encoding="utf-8")
    lifecycle_text = lifecycle.read_text(encoding="utf-8")
    new_entry = apply_entrypoint(entry_text)
    new_lifecycle = apply_lifecycle(lifecycle_text)
    if args.check:
        print("SUBAGENT_PROMPT_POLICY_WIRING_PREIMAGE_OK")
        return 0
    entry.write_text(new_entry, encoding="utf-8")
    lifecycle.write_text(new_lifecycle, encoding="utf-8")
    print("SUBAGENT_PROMPT_POLICY_WIRING_APPLIED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
