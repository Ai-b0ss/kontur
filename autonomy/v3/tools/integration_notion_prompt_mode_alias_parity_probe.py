#!/usr/bin/env python3
"""Offline regression for Notion/Qwen prompt-mode selector parity.

Fresh Notion prompt_modes.py currently uses:
  metadata.get('notion_prompt_mode', metadata.get('prompt_mode', 'engineer'))
  str(raw_mode or 'engineer').strip().lower()
That makes an explicit empty primary alias silently become engineer and lets a
conflicting secondary alias be ignored. Qwen Core now rejects empty/conflicting
mode aliases fail-closed. This probe records the cross-product contract only; it
never imports or mutates product code.
"""
import json


def current_notion(metadata):
    raw = metadata.get("notion_prompt_mode", metadata.get("prompt_mode", "engineer"))
    return str(raw or "engineer").strip().lower()


def candidate(metadata):
    aliases = []
    for key in ("notion_prompt_mode", "prompt_mode"):
        if key not in metadata:
            continue
        value = metadata[key]
        if not isinstance(value, str) or not value.strip():
            raise ValueError("NOTION_SYSTEM_PROMPT_MODE_INVALID")
        normalized = value.strip().lower()
        if normalized not in {"engineer", "owner"}:
            raise ValueError("NOTION_SYSTEM_PROMPT_MODE_INVALID")
        aliases.append(normalized)
    if not aliases:
        return "engineer"
    if any(value != aliases[0] for value in aliases[1:]):
        raise ValueError("NOTION_SYSTEM_PROMPT_MODE_INVALID")
    return aliases[0]


def rejected(fn, metadata):
    try:
        return {"rejected": False, "value": fn(metadata)}
    except ValueError as error:
        return {"rejected": True, "error": str(error)}


cases = {
    "missing_defaults_engineer": {},
    "empty_primary": {"notion_prompt_mode": ""},
    "blank_primary": {"notion_prompt_mode": "  \n"},
    "conflicting_aliases": {"notion_prompt_mode": "engineer", "prompt_mode": "owner"},
    "equivalent_aliases": {"notion_prompt_mode": " OWNER ", "prompt_mode": "owner"},
}
current = {name: rejected(current_notion, data) for name, data in cases.items()}
fixed = {name: rejected(candidate, data) for name, data in cases.items()}

assert current["missing_defaults_engineer"]["value"] == "engineer"
assert current["empty_primary"]["value"] == "engineer"
assert current["conflicting_aliases"]["value"] == "engineer"
assert fixed["missing_defaults_engineer"]["value"] == "engineer"
assert fixed["empty_primary"]["rejected"]
assert fixed["blank_primary"]["rejected"]
assert fixed["conflicting_aliases"]["rejected"]
assert fixed["equivalent_aliases"]["value"] == "owner"
print(json.dumps({"verdict": "NOTION_PROMPT_MODE_ALIAS_PARITY_GAP_REPRODUCED", "current": current, "candidate": fixed}, sort_keys=True))
