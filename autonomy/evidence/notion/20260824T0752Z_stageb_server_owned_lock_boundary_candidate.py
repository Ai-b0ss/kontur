from __future__ import annotations

from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from typing import Any


async def run_stageb_under_request_locks(
    *,
    inference_slot: AbstractAsyncContextManager[Any],
    conversation_lock: AbstractAsyncContextManager[Any],
    affinity_lock: AbstractAsyncContextManager[Any],
    execute: Callable[[], Awaitable[Any]],
) -> Any:
    """Keep all per-request ownership until provider work is durably committed.

    The coroutine containing these context managers must be the server-owned
    commit task itself. The SSE/client waiter may be cancelled independently,
    but must never own/release these locks while this coroutine is still alive.
    """
    async with inference_slot:
        async with conversation_lock:
            async with affinity_lock:
                return await execute()
