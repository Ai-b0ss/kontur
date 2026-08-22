#!/usr/bin/env python3
"""Offline parity regression for owner-mode blank prompt validation.

Qwen now rejects explicit owner prompts that are empty or whitespace-only while preserving
valid owner prompt bytes exactly. Notion currently rejects only the empty string, so a
whitespace-only owner prompt is accepted as the application authority.
"""
from __future__ import annotations

import json


def notion_current(owner_prompt: object) -> str:
    if not isinstance(owner_prompt, str) or not owner_prompt:
        return "REJECT"
    return owner_prompt


def parity_contract(owner_prompt: object) -> str:
    if not isinstance(owner_prompt, str) or not owner_prompt.strip():
        return "REJECT"
    # Validation may inspect trim(), but the valid prompt itself must stay byte-exact.
    return owner_prompt


def main() -> None:
    cases = ["", "   ", "\n\t", "  OWNER\n  "]
    current = [notion_current(value) for value in cases]
    candidate = [parity_contract(value) for value in cases]

    assert current[0] == "REJECT"
    assert current[1] == "   "
    assert current[2] == "\n\t"
    assert candidate[:3] == ["REJECT", "REJECT", "REJECT"]
    assert candidate[3] == cases[3]

    print(
        json.dumps(
            {
                "verdict": "NOTION_WHITESPACE_OWNER_GAP_REPRODUCED_PARITY_CONTRACT_PASS",
                "current": current,
                "candidate": candidate,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
