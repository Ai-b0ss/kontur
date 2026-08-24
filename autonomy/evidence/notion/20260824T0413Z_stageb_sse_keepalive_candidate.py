from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable
from typing import Any


async def buffered_sse_projection_with_keepalive(
    task: asyncio.Task[dict[str, Any]],
    project: Callable[[dict[str, Any]], AsyncIterator[bytes]],
    *,
    heartbeat_seconds: float = 10.0,
) -> AsyncIterator[bytes]:
    """Keep SSE alive without exposing response/provider data before durable commit.

    `task` is server-owned and must already be registered outside the client
    connection lifecycle. Timeout/cancellation of this waiter never cancels it.
    Only an SSE comment is emitted while the durable transaction is pending.
    """
    interval = max(0.05, float(heartbeat_seconds))
    while not task.done():
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=interval)
        except asyncio.TimeoutError:
            # SSE comments carry no response/provider identity or payload.
            yield b": stageb-commit-pending\n\n"
        except asyncio.CancelledError:
            # The client connection owns only this projection, never `task`.
            raise

    # Retrieving result here propagates transaction failure after any neutral
    # heartbeat comments, without fabricating a protocol response.
    result = task.result()
    async for chunk in project(result):
        yield chunk
