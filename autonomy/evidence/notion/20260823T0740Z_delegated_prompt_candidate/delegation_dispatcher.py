from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Mapping

from payload.delegation_policy import (
    DelegateTarget,
    DelegatedPromptMode,
    DelegationRequest,
    delegated_conversation_key,
    validate_delegation_request,
)


@dataclass(frozen=True, slots=True)
class DelegationContext:
    """Provider-neutral context handed to one delegated child task.

    The conversation key is local and isolated. Provider account ids and remote
    thread ids are deliberately absent so a child can never inherit the parent's
    affinity by accident. Private owner policy stays in memory only and is hidden
    from repr/log-oriented dataclass rendering.
    """

    task_id: str
    parent_turn_id: str
    conversation_key: str
    objective: str
    max_model_turns: int
    prompt_mode: DelegatedPromptMode = "engineer"
    owner_system_prompt: str | None = field(default=None, repr=False)


@dataclass(frozen=True, slots=True)
class DelegationResult:
    task_id: str
    parent_turn_id: str
    target: DelegateTarget
    output: str


class DelegationDispatchError(RuntimeError):
    pass


class DelegationSideEffectUncertain(asyncio.CancelledError):
    """Cancellation after a delegated local side effect may already have started."""

    def __init__(self, task_id: str, call_id: str) -> None:
        super().__init__("delegated local tool outcome is uncertain after cancellation")
        self.task_id = str(task_id)
        self.call_id = str(call_id)


class DelegationSideEffectUncertainError(RuntimeError):
    """Non-cancellation failure after a local side effect may already have started."""

    def __init__(self, task_id: str, call_id: str) -> None:
        super().__init__("delegated local tool outcome is uncertain")
        self.task_id = str(task_id)
        self.call_id = str(call_id)


DelegationAdapter = Callable[[DelegationContext], Awaitable[str]]


class DelegationDispatcher:
    """Dispatch validated child work without sharing provider-specific state."""

    def __init__(self, adapters: Mapping[DelegateTarget, DelegationAdapter]) -> None:
        self._adapters = dict(adapters)

    async def dispatch(self, request: DelegationRequest) -> DelegationResult:
        request = validate_delegation_request(request)
        adapter = self._adapters.get(request.target)
        if adapter is None:
            raise DelegationDispatchError(
                f"delegation target is not configured: {request.target}"
            )

        context = DelegationContext(
            task_id=request.task_id,
            parent_turn_id=request.parent_turn_id,
            conversation_key=delegated_conversation_key(request),
            objective=request.objective,
            max_model_turns=request.max_model_turns,
            prompt_mode=request.prompt_mode,
            owner_system_prompt=request.owner_system_prompt,
        )
        output = await adapter(context)
        if not isinstance(output, str):
            raise DelegationDispatchError("delegation adapter must return text output")
        if not output.strip():
            raise DelegationDispatchError("delegation adapter returned empty text output")

        return DelegationResult(
            task_id=request.task_id,
            parent_turn_id=request.parent_turn_id,
            target=request.target,
            output=output,
        )
