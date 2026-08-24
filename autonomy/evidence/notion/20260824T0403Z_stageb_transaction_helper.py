from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from typing import Any, Protocol


class StageBTransactionError(RuntimeError):
    pass


class StageBReplayRehydrateError(StageBTransactionError):
    pass


class StageBRoute(Protocol):
    account_id: str


class StageBStore(Protocol):
    async def assert_provider_ready(self) -> None: ...
    async def replay_for(self, key: str | None, request_fingerprint: str) -> dict[str, Any] | None: ...
    async def get(self, key: str | None) -> Any: ...
    async def begin_provider_intent(
        self,
        key: str | None,
        *,
        request_fingerprint: str,
        account_id: str,
        request_kind: str,
    ) -> None: ...
    async def finalize_provider_intent(self, key: str | None, **kwargs: Any) -> None: ...


@dataclass(slots=True)
class StageBRequest:
    conversation_key: str
    request_fingerprint: str
    request_kind: str
    input_fingerprints: tuple[str, ...]
    segment_index: int
    awaiting_compacted_history: bool
    turns: int
    model: str
    context_fingerprint: str


@dataclass(slots=True)
class StageBProviderResult:
    notion_thread_id: str
    input_tokens: int
    output_tokens: int
    value: Any


class StageBTransactionCoordinator:
    """Commit provider work before any cache/reservation/client publication.

    `acquire_route` must perform only local/account-pool selection. The first
    remote side effect is allowed only inside `run_provider`, after the durable
    intent write has succeeded. `run_provider` owns deliberate same-account
    planner correction steps and must not perform implicit failover/retry.
    """

    def __init__(
        self,
        *,
        store: StageBStore,
        acquire_route: Callable[[Any], AbstractAsyncContextManager[StageBRoute]],
        run_provider: Callable[[StageBRoute, Any], Awaitable[StageBProviderResult]],
        render: Callable[[StageBProviderResult], dict[str, Any]],
        rehydrate_replay: Callable[[Any, dict[str, Any]], Awaitable[None]],
        publish_ephemeral: Callable[[StageBRoute, StageBProviderResult, dict[str, Any]], Awaitable[None]],
    ) -> None:
        self.store = store
        self.acquire_route = acquire_route
        self.run_provider = run_provider
        self.render = render
        self.rehydrate_replay = rehydrate_replay
        self.publish_ephemeral = publish_ephemeral

    async def execute(self, request: StageBRequest, route_hint: Any = None) -> dict[str, Any]:
        await self.store.assert_provider_ready()
        replay = await self.store.replay_for(
            request.conversation_key,
            request.request_fingerprint,
        )
        # replay_for/get may run cleanup, whose persistence can itself fail.
        await self.store.assert_provider_ready()
        if replay is not None:
            segment = await self.store.get(request.conversation_key)
            await self.store.assert_provider_ready()
            try:
                await self.rehydrate_replay(segment, replay)
            except Exception as exc:
                raise StageBReplayRehydrateError("durable replay could not rehydrate ephemeral state") from exc
            return replay

        segment = await self.store.get(request.conversation_key)
        await self.store.assert_provider_ready()

        async with self.acquire_route(route_hint if route_hint is not None else segment) as route:
            # This strict write is the commit boundary before the first possible
            # provider-side effect. Failure must therefore leave provider_calls=0.
            await self.store.begin_provider_intent(
                request.conversation_key,
                request_fingerprint=request.request_fingerprint,
                account_id=route.account_id,
                request_kind=request.request_kind,
            )

            result = await self.run_provider(route, segment)
            canonical = self.render(result)

            # One strict atomic store update publishes progress + exact rendered
            # response and clears the matching intent. Nothing ephemeral/client-
            # visible is allowed before it succeeds.
            await self.store.finalize_provider_intent(
                request.conversation_key,
                request_fingerprint=request.request_fingerprint,
                account_id=route.account_id,
                request_kind=request.request_kind,
                rendered_response=canonical,
                notion_thread_id=result.notion_thread_id,
                input_fingerprints=request.input_fingerprints,
                segment_index=request.segment_index,
                awaiting_compacted_history=request.awaiting_compacted_history,
                turns=request.turns,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                model=request.model,
                context_fingerprint=request.context_fingerprint,
            )

            # Cache/affinity/reservation are deliberately after the durable
            # commit. If this fails, the caller receives no result; an exact retry
            # rehydrates from durable replay without another provider call.
            await self.publish_ephemeral(route, result, canonical)
            return canonical


class CommitTaskRegistry:
    """Server-owned tasks outlive a disconnected SSE client after work starts."""

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task[Any]] = set()
        self._closing = False

    def start(self, awaitable: Awaitable[Any]) -> asyncio.Task[Any]:
        if self._closing:
            raise RuntimeError("commit registry is shutting down")
        task = asyncio.create_task(awaitable)
        self._tasks.add(task)
        task.add_done_callback(self._done)
        return task

    def _done(self, task: asyncio.Task[Any]) -> None:
        self._tasks.discard(task)
        if task.cancelled():
            return
        # Retrieve the exception so detached provider/commit failures never turn
        # into "Task exception was never retrieved" warnings.
        task.exception()

    async def wait_client(self, task: asyncio.Task[Any]) -> Any:
        # Client cancellation cancels only this waiter, not the commit-critical
        # transaction. The registry retains ownership until the task completes.
        return await asyncio.shield(task)

    async def shutdown(self, timeout: float) -> None:
        self._closing = True
        pending = tuple(self._tasks)
        if not pending:
            return
        done, still_pending = await asyncio.wait(pending, timeout=max(0.0, timeout))
        for task in done:
            if not task.cancelled():
                task.exception()
        for task in still_pending:
            task.cancel()
        if still_pending:
            await asyncio.gather(*still_pending, return_exceptions=True)


async def buffered_sse_projection(
    task: asyncio.Task[dict[str, Any]],
    registry: CommitTaskRegistry,
    project: Callable[[dict[str, Any]], AsyncIterator[bytes]],
) -> AsyncIterator[bytes]:
    """Emit no protocol IDs/provider data until the durable transaction finishes."""
    result = await registry.wait_client(task)
    async for chunk in project(result):
        yield chunk
