from __future__ import annotations

from dataclasses import dataclass, field
from typing import Awaitable, Callable

from payload.delegation_dispatcher import DelegationDispatcher, DelegationResult
from payload.delegation_policy import DelegateTarget, DelegatedPromptMode, DelegationRequest
from payload.subagent_lifecycle import SubagentLifecycle, SubagentLifecycleStatus


class SubagentEntryPointDisabled(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class SubagentLaunch:
    task_id: str
    parent_turn_id: str
    objective: str
    target: DelegateTarget = "notion"
    max_model_turns: int = 8
    prompt_mode: DelegatedPromptMode = "engineer"
    owner_system_prompt: str | None = field(default=None, repr=False)


EnabledPredicate = Callable[[], bool]


class SubagentEntryPoint:
    """Explicit, disabled-by-default boundary for future real subagent launches.

    This entry point owns no provider account/thread state. It only converts a
    launch request into the provider-neutral delegation envelope and hands it to
    the bounded lifecycle. Provider adapters remain responsible for legitimate
    slot selection and isolated remote conversations.
    """

    def __init__(
        self,
        dispatcher: DelegationDispatcher,
        *,
        enabled: bool = False,
        enabled_predicate: EnabledPredicate | None = None,
        maximum_parallel: int = 2,
    ) -> None:
        self._enabled = enabled
        self._enabled_predicate = enabled_predicate
        self._lifecycle = SubagentLifecycle(
            dispatcher,
            maximum_parallel=maximum_parallel,
        )

    def _is_enabled(self) -> bool:
        if self._enabled_predicate is not None:
            return bool(self._enabled_predicate())
        return self._enabled

    async def status(self) -> SubagentLifecycleStatus:
        return await self._lifecycle.status()

    async def launch(self, launch: SubagentLaunch) -> DelegationResult:
        if not self._is_enabled():
            raise SubagentEntryPointDisabled("subagent entry point is disabled")
        return await self._lifecycle.run_child(
            DelegationRequest(
                task_id=launch.task_id,
                parent_turn_id=launch.parent_turn_id,
                objective=launch.objective,
                target=launch.target,
                max_model_turns=launch.max_model_turns,
                prompt_mode=launch.prompt_mode,
                owner_system_prompt=launch.owner_system_prompt,
            )
        )
