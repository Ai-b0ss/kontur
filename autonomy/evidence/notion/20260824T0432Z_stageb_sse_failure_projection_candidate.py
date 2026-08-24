from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable
from typing import Any


async def buffered_sse_projection_with_keepalive_and_failure(
    task: asyncio.Task[dict[str, Any]],
    project: Callable[[dict[str, Any]], AsyncIterator[bytes]],
    project_failure: Callable[[BaseException], AsyncIterator[bytes]],
    *,
    heartbeat_seconds: float = 10.0,
) -> AsyncIterator[bytes]:
    """Project only neutral keepalives before commit and an explicit failure after it.

    The server-owned task is never cancelled by this projection. `project_failure`
    is intentionally supplied by the Responses layer so this generic Stage-B helper
    does not invent response IDs or protocol event structure.
    """
    interval = max(0.05, float(heartbeat_seconds))
    while not task.done():
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=interval)
        except asyncio.TimeoutError:
            yield b": stageb-commit-pending\n\n"
        except asyncio.CancelledError:
            raise
        except BaseException:
            # The task itself failed. Its exact failure is projected below.
            break

    try:
        result = task.result()
    except asyncio.CancelledError:
        raise
    except BaseException as exc:
        async for chunk in project_failure(exc):
            yield chunk
        return

    async for chunk in project(result):
        yield chunk
