#!/usr/bin/env python3
from __future__ import annotations
from dataclasses import dataclass
from typing import Literal
import hashlib, json

PromptMode = Literal["engineer", "owner"]

class ContractError(ValueError):
    pass

@dataclass(frozen=True)
class PromptPolicy:
    mode: PromptMode = "engineer"
    owner_system_prompt: str | None = None

def validate_policy(policy: PromptPolicy) -> PromptPolicy:
    if policy.mode not in ("engineer", "owner"):
        raise ContractError("unsupported prompt mode")
    if policy.mode == "owner":
        if not isinstance(policy.owner_system_prompt, str) or not policy.owner_system_prompt.strip():
            raise ContractError("owner_system_prompt required in owner mode")
        # Preserve the exact application prompt bytes. Do not strip/rewrite it.
        return policy
    if policy.owner_system_prompt is not None:
        raise ContractError("owner_system_prompt forbidden in engineer mode")
    return policy

def prompt_fingerprint(policy: PromptPolicy) -> str:
    policy = validate_policy(policy)
    payload = {
        "mode": policy.mode,
        "owner_prompt_sha256": (
            hashlib.sha256(policy.owner_system_prompt.encode("utf-8")).hexdigest()
            if policy.mode == "owner" else None
        ),
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()

def qwen_options(policy: PromptPolicy) -> dict:
    policy = validate_policy(policy)
    if policy.mode == "owner":
        return {"mode": "owner", "ownerSystemPrompt": policy.owner_system_prompt}
    return {"mode": "engineer"}

def main() -> None:
    exact = "\n  PRIVATE OWNER PROMPT — не переписывать  \n"
    p = PromptPolicy("owner", exact)
    out = qwen_options(p)
    assert out["mode"] == "owner"
    assert out["ownerSystemPrompt"] == exact
    assert out["ownerSystemPrompt"].encode("utf-8") == exact.encode("utf-8")

    fp1 = prompt_fingerprint(p)
    fp2 = prompt_fingerprint(PromptPolicy("owner", exact))
    fp3 = prompt_fingerprint(PromptPolicy("owner", exact + "!"))
    assert fp1 == fp2
    assert fp1 != fp3
    assert exact not in fp1
    assert qwen_options(PromptPolicy()) == {"mode": "engineer"}

    for bad in (PromptPolicy("owner", None), PromptPolicy("owner", "   ")):
        try:
            validate_policy(bad)
        except ContractError:
            pass
        else:
            raise AssertionError("owner mode without prompt must fail")

    try:
        validate_policy(PromptPolicy("engineer", "secret"))
    except ContractError:
        pass
    else:
        raise AssertionError("engineer mode with owner prompt must fail")

    evidence = {
        "verdict": "PASS",
        "owner_prompt_preserved_exactly": True,
        "owner_prompt_not_persisted": True,
        "fingerprint_stable": fp1 == fp2,
        "fingerprint_changes_with_prompt": fp1 != fp3,
        "qwen_mapping": {"engineer": "mode=engineer", "owner": "mode=owner + exact ownerSystemPrompt"},
    }
    serialized = json.dumps(evidence, ensure_ascii=False, sort_keys=True)
    assert exact not in serialized
    print(serialized)

if __name__ == "__main__":
    main()
