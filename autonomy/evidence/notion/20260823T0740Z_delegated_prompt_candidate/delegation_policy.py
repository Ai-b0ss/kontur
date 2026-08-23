from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


DelegateTarget = Literal["notion", "qwen"]
DelegatedPromptMode = Literal["engineer", "owner"]


@dataclass(frozen=True, slots=True)
class DelegationRequest:
    task_id: str
    parent_turn_id: str
    objective: str
    target: DelegateTarget = "notion"
    max_model_turns: int = 8
    prompt_mode: DelegatedPromptMode = "engineer"
    owner_system_prompt: str | None = field(default=None, repr=False)


class DelegationPolicyError(ValueError):
    pass


def _normalized_identity(value: str) -> str:
    """Return the local task identity used for isolation checks and keys."""

    return value.strip()


def validate_delegation_request(request: DelegationRequest) -> DelegationRequest:
    """Validate and canonicalize a provider-neutral delegated task request.

    Delegated work gets its own task identity. The parent turn id is correlation only:
    account/thread affinity must never be inherited implicitly from the parent.

    Identity validation is performed on stripped values and the returned request uses
    those same canonical values. This prevents downstream code from validating one
    identity while storing or reporting a whitespace alias of it.

    The owner's private system prompt is carried only as in-memory delegated policy.
    It is deliberately absent from the delegated conversation key and hidden from
    dataclass repr. Engineer mode discards dormant owner text so it cannot become a
    second, accidental system instruction later in the delegated path.
    """
    if not isinstance(request.task_id, str):
        raise DelegationPolicyError("delegated task_id must be a string")
    if not isinstance(request.parent_turn_id, str):
        raise DelegationPolicyError("delegated parent_turn_id must be a string")
    if not isinstance(request.objective, str):
        raise DelegationPolicyError("delegated objective must be a string")
    if not isinstance(request.target, str) or request.target not in ("notion", "qwen"):
        raise DelegationPolicyError("unsupported delegation target")
    if not isinstance(request.prompt_mode, str) or request.prompt_mode not in ("engineer", "owner"):
        raise DelegationPolicyError("unsupported delegated prompt mode")
    if request.owner_system_prompt is not None and not isinstance(request.owner_system_prompt, str):
        raise DelegationPolicyError("delegated owner_system_prompt must be text")
    if (
        not isinstance(request.max_model_turns, int)
        or isinstance(request.max_model_turns, bool)
        or request.max_model_turns < 1
        or request.max_model_turns > 24
    ):
        raise DelegationPolicyError(
            "delegated max_model_turns must be an integer between 1 and 24"
        )

    task_id = _normalized_identity(request.task_id)
    parent_turn_id = _normalized_identity(request.parent_turn_id)
    if not task_id:
        raise DelegationPolicyError("delegated task_id is required")
    if not parent_turn_id:
        raise DelegationPolicyError("delegated parent_turn_id is required")
    if task_id == parent_turn_id:
        raise DelegationPolicyError("delegated task must have an independent turn identity")
    objective = request.objective.strip()
    if not objective:
        raise DelegationPolicyError("delegated objective is required")

    owner_system_prompt = request.owner_system_prompt
    if request.prompt_mode == "owner":
        if owner_system_prompt is None or not owner_system_prompt.strip():
            raise DelegationPolicyError("owner delegated mode requires owner_system_prompt")
    else:
        owner_system_prompt = None

    return DelegationRequest(
        task_id=task_id,
        parent_turn_id=parent_turn_id,
        objective=objective,
        target=request.target,
        max_model_turns=request.max_model_turns,
        prompt_mode=request.prompt_mode,
        owner_system_prompt=owner_system_prompt,
    )


def delegated_conversation_key(request: DelegationRequest) -> str:
    """Return an isolated local conversation key for delegated work.

    This intentionally contains no provider account id, remote thread id, prompt mode,
    or private owner prompt. A Notion delegate enters the normal account-pool allocator
    as independent foreground work; Qwen delegation can use the same envelope without
    leaking Notion affinity or private policy into persistent identity.
    """
    request = validate_delegation_request(request)
    return f"delegate:{request.target}:{request.task_id}"
