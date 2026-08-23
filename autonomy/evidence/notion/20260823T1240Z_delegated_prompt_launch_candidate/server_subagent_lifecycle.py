from __future__ import annotations

import asyncio
from pathlib import Path

from payload.delegation_dispatcher import (
    DelegationResult,
    DelegationSideEffectUncertain,
    DelegationSideEffectUncertainError,
)
from payload.delegation_policy import DelegationRequest, validate_delegation_request
from payload.notion_delegation_adapter import DelegationAccountPool
from payload.notion_subagent_runtime import ReservedAccountIds
from payload.server_subagent_runtime import RuntimeToolCaller, build_server_notion_subagents
from payload.subagent_entrypoint import EnabledPredicate, SubagentEntryPoint, SubagentLaunch
from payload.subagent_tombstone_store import SubagentTombstoneStore


class ServerSubagentRuntimeUnavailable(RuntimeError):
    pass


class ServerSubagentLifecycle:
    """Own the server-side delegated runtime without owning provider affinity.

    One lifecycle survives account-pool generations. It also owns the content-
    minimal no-replay store used by every generation, so a pool refresh cannot
    forget an uncertain task identity. When a durable path is supplied, inflight
    local-tool markers and tombstones also survive process restart. Corrupt durable
    state blocks delegated launches but does not need to take down ordinary bridge
    traffic.
    """

    def __init__(
        self,
        *,
        reserved_account_ids: ReservedAccountIds,
        call_runtime_tool: RuntimeToolCaller,
        enabled_predicate: EnabledPredicate,
        model: str = "gpt-5.6-sol",
        maximum_parallel: int = 2,
        tombstone_path: Path | str | None = None,
    ) -> None:
        self._reserved_account_ids = reserved_account_ids
        self._call_runtime_tool = call_runtime_tool
        self._enabled_predicate = enabled_predicate
        self._model = model
        self._maximum_parallel = maximum_parallel
        self._entrypoint: SubagentEntryPoint | None = None
        self._generation = 0
        self._condition = asyncio.Condition()
        self._active_by_entrypoint: dict[int, int] = {}
        self._uncertain_task_ids: set[str] = set()
        self._tombstone_store = SubagentTombstoneStore(tombstone_path)

    @property
    def generation(self) -> int:
        return self._generation

    def _build_entrypoint(self, pool: DelegationAccountPool) -> SubagentEntryPoint:
        return build_server_notion_subagents(
            pool,
            reserved_account_ids=self._reserved_account_ids,
            call_runtime_tool=self._call_runtime_tool,
            enabled_predicate=self._enabled_predicate,
            model=self._model,
            maximum_parallel=self._maximum_parallel,
            tombstone_store=self._tombstone_store,
        )

    async def _swap_pool(
        self,
        pool: DelegationAccountPool | None,
    ) -> tuple[int, SubagentEntryPoint | None]:
        replacement = None if pool is None else self._build_entrypoint(pool)
        async with self._condition:
            previous = self._entrypoint
            self._generation += 1
            self._entrypoint = replacement
            self._condition.notify_all()
            return self._generation, previous

    async def _wait_entrypoint_idle(self, entrypoint: SubagentEntryPoint | None) -> None:
        if entrypoint is None:
            return
        key = id(entrypoint)
        async with self._condition:
            while self._active_by_entrypoint.get(key, 0) > 0:
                await self._condition.wait()

    async def _drain_before_propagating_cancellation(
        self,
        entrypoint: SubagentEntryPoint | None,
    ) -> None:
        if entrypoint is None:
            return

        drain_task = asyncio.create_task(self._wait_entrypoint_idle(entrypoint))
        first_cancellation: asyncio.CancelledError | None = None
        while not drain_task.done():
            try:
                await asyncio.shield(drain_task)
            except asyncio.CancelledError as cancellation:
                if first_cancellation is None:
                    first_cancellation = cancellation

        drain_task.result()
        if first_cancellation is not None:
            raise first_cancellation

    async def bind_pool(self, pool: DelegationAccountPool | None) -> int:
        generation, _ = await self._swap_pool(pool)
        return generation

    async def rebind_pool_and_drain(self, pool: DelegationAccountPool | None) -> int:
        generation, previous = await self._swap_pool(pool)
        await self._drain_before_propagating_cancellation(previous)
        return generation

    async def unbind_and_drain(self) -> int:
        return await self.rebind_pool_and_drain(None)

    async def launch(self, launch: SubagentLaunch) -> DelegationResult:
        """Run a child unless durable/in-process state says its outcome is uncertain."""

        request = validate_delegation_request(
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
        launch = SubagentLaunch(
            task_id=request.task_id,
            parent_turn_id=request.parent_turn_id,
            objective=request.objective,
            target=request.target,
            max_model_turns=request.max_model_turns,
            prompt_mode=request.prompt_mode,
            owner_system_prompt=request.owner_system_prompt,
        )
        task_id = request.task_id
        async with self._condition:
            if self._tombstone_store.state_uncertain:
                raise ServerSubagentRuntimeUnavailable(
                    "subagent no-replay state is uncertain"
                )
            if (
                task_id in self._uncertain_task_ids
                or self._tombstone_store.contains(task_id)
            ):
                raise ServerSubagentRuntimeUnavailable(
                    "subagent task_id has uncertain side-effect outcome"
                )
            entrypoint = self._entrypoint
            if entrypoint is None:
                raise ServerSubagentRuntimeUnavailable(
                    "subagent runtime is not bound to an account pool"
                )
            key = id(entrypoint)
            self._active_by_entrypoint[key] = self._active_by_entrypoint.get(key, 0) + 1

        try:
            return await entrypoint.launch(launch)
        except (DelegationSideEffectUncertain, DelegationSideEffectUncertainError) as uncertainty:
            persistence_error: BaseException | None = None
            try:
                self._tombstone_store.mark_uncertain(task_id)
            except BaseException as error:
                # A durable pre-side-effect inflight marker remains authoritative
                # when this publication fails. state_uncertain also blocks all
                # future delegated launches in the current process.
                persistence_error = error
            async with self._condition:
                self._uncertain_task_ids.add(task_id)
                self._condition.notify_all()
            if persistence_error is not None:
                raise uncertainty from persistence_error
            raise
        finally:
            async with self._condition:
                remaining = self._active_by_entrypoint.get(key, 0) - 1
                if remaining <= 0:
                    self._active_by_entrypoint.pop(key, None)
                else:
                    self._active_by_entrypoint[key] = remaining
                self._condition.notify_all()

    async def status(self) -> dict[str, int | bool]:
        while True:
            async with self._condition:
                entrypoint = self._entrypoint
                generation = self._generation
                if entrypoint is None:
                    return {
                        "bound": False,
                        "generation": generation,
                        "active": sum(self._active_by_entrypoint.values()),
                        "maximum_parallel": self._maximum_parallel,
                    }

            lifecycle = await entrypoint.status()

            async with self._condition:
                if self._entrypoint is not entrypoint or self._generation != generation:
                    continue
                current_key = id(entrypoint)
                current_tracked = self._active_by_entrypoint.get(current_key, 0)
                retired_active = sum(self._active_by_entrypoint.values()) - current_tracked
                return {
                    "bound": True,
                    "generation": generation,
                    "active": retired_active + max(current_tracked, lifecycle.active),
                    "maximum_parallel": lifecycle.maximum_parallel,
                }
