#!/usr/bin/env python3
from __future__ import annotations
from dataclasses import dataclass
from typing import Literal
import json

class ContractError(RuntimeError):
    pass

# Exact shape of the current Notion adapter boundary:
# adapter(ctx) -> str, dispatcher rejects non-string and empty/whitespace.
def current_notion_publish(adapter_return):
    if not isinstance(adapter_return, str):
        raise ContractError("delegation adapter must return text output")
    if not adapter_return.strip():
        raise ContractError("delegation adapter returned empty text output")
    return {"status": "completed", "output": adapter_return}

@dataclass(frozen=True)
class QwenResult:
    ok: bool
    text: str = ""
    uncertain: bool = False
    skipped: bool = False
    code: str | None = None
    resumed: bool = False

# Candidate neutral contract: preserve completion state separately from human-readable text.
State = Literal["completed", "uncertain", "failed", "skipped"]

@dataclass(frozen=True)
class NeutralOutcome:
    state: State
    output: str = ""
    code: str | None = None
    resumed: bool = False

def qwen_to_neutral(r: QwenResult) -> NeutralOutcome:
    if r.ok:
        return NeutralOutcome("completed", r.text, r.code, r.resumed)
    if r.uncertain:
        return NeutralOutcome("uncertain", r.text, r.code, r.resumed)
    if r.skipped:
        return NeutralOutcome("skipped", r.text, r.code, r.resumed)
    return NeutralOutcome("failed", r.text, r.code, r.resumed)

def must_not_auto_retry(outcome: NeutralOutcome) -> bool:
    return outcome.state == "uncertain"

def main():
    cases = {
        "completed_with_text": QwenResult(ok=True, text="done"),
        "completed_empty_text": QwenResult(ok=True, text=""),
        "uncertain_after_side_effect": QwenResult(
            ok=False, uncertain=True, code="QWEN_SUBAGENT_AGENT_UNCERTAIN_RETRY_BLOCKED"
        ),
        "ordinary_failure": QwenResult(ok=False, code="QWEN_SUBAGENT_AGENT_FAILED"),
        "skipped_after_prior_failure": QwenResult(
            ok=False, skipped=True, code="QWEN_SUBAGENT_AGENT_PREVIOUS_FAILURE"
        ),
        "resumed_completed_empty": QwenResult(ok=True, text="", resumed=True),
    }

    current = {}
    for name, result in cases.items():
        try:
            current[name] = current_notion_publish(result.text)
        except ContractError as e:
            current[name] = {"rejected": str(e)}

    assert current["completed_with_text"]["status"] == "completed"
    assert "rejected" in current["completed_empty_text"]
    assert "rejected" in current["uncertain_after_side_effect"]
    assert "rejected" in current["ordinary_failure"]
    assert "rejected" in current["skipped_after_prior_failure"]
    assert "rejected" in current["resumed_completed_empty"]

    fabricated = current_notion_publish("Qwen task did not finish")
    assert fabricated["status"] == "completed"

    neutral = {name: qwen_to_neutral(result) for name, result in cases.items()}
    assert neutral["completed_empty_text"].state == "completed"
    assert neutral["completed_empty_text"].output == ""
    assert neutral["uncertain_after_side_effect"].state == "uncertain"
    assert must_not_auto_retry(neutral["uncertain_after_side_effect"])
    assert neutral["ordinary_failure"].state == "failed"
    assert neutral["skipped_after_prior_failure"].state == "skipped"
    assert neutral["resumed_completed_empty"].state == "completed"
    assert neutral["resumed_completed_empty"].resumed

    evidence = {
        "verdict": "PASS",
        "current_contract_loss_reproduced": True,
        "current_representable_cases": 1,
        "current_total_cases": len(cases),
        "unsafe_fabricated_text_misclassified_as_completed": True,
        "candidate_states": sorted({o.state for o in neutral.values()}),
        "uncertain_blocks_auto_retry": must_not_auto_retry(neutral["uncertain_after_side_effect"]),
        "empty_completed_is_valid": neutral["completed_empty_text"].state == "completed",
        "provider_affinity_fields_required": False,
    }
    print(json.dumps(evidence, sort_keys=True))

if __name__ == "__main__":
    main()
