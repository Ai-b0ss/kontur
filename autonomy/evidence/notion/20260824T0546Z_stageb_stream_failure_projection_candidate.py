from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Callable
from typing import Any


_SAFE_FAILURE_MESSAGE = (
    "The bridge could not safely publish this response. "
    "The request outcome is retained for fail-closed recovery."
)


def stageb_failed_sse(*, sequence_number: int = 0) -> bytes:
    """Return a sanitized Responses terminal failure event.

    No provider/tool/response identifier or exception text is exposed.  Codex
    currently recognizes ``response.failed``.  Its generic server-error path is
    retryable, so duplicate-provider protection remains the responsibility of
    the durable provider-intent gate on the next request.
    """
    event = {
        "type": "response.failed",
        "sequence_number": int(sequence_number),
        "response": {
            "status": "failed",
            "error": {
                "code": "server_error",
                "message": _SAFE_FAILURE_MESSAGE,
            },
            "output": [],
        },
    }
    return (
        "event: response.failed\n"
        + "data: "
        + json.dumps(event, ensure_ascii=False, separators=(",", ":"))
        + "\n\n"
    ).encode("utf-8")


async def buffered_sse_projection_with_keepalive(
    task: asyncio.Task[dict[str, Any]],
    project: Callable[[dict[str, Any]], AsyncIterator[bytes]],
    *,
    heartbeat_seconds: float = 10.0,
) -> AsyncIterator[bytes]:
    """Project a server-owned durable transaction into a safe SSE stream.

    While the durable transaction is pending, only a neutral SSE comment is
    emitted.  The client-side waiter never cancels ``task``.  Once ``task`` is
    done, the complete canonical SSE projection is buffered before any protocol
    event is exposed.  A transaction/projection failure becomes one sanitized
    ``response.failed`` event instead of an abrupt HTTP-200 stream termination.
    """
    interval = max(0.05, float(heartbeat_seconds))
    while not task.done():
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=interval)
        except asyncio.TimeoutError:
            yield b": stageb-commit-pending\n\n"
        except asyncio.CancelledError:
            # ``shield(task)`` also raises CancelledError when the server-owned
            # task itself was cancelled. Distinguish that from cancellation of
            # this client-side waiter.
            if task.done():
                break
            raise
        except Exception:
            # A completed task may surface its exception through ``wait_for``
            # before the loop gets a chance to observe ``task.done()``. Defer
            # serialization to the sanitized terminal-failure path below.
            break

    if task.cancelled():
        yield stageb_failed_sse()
        return

    try:
        result = task.result()
        chunks: list[bytes] = []
        async for chunk in project(result):
            if not isinstance(chunk, (bytes, bytearray, memoryview)):
                raise TypeError("SSE projection must yield bytes")
            chunks.append(bytes(chunk))
    except Exception:
        # Do not serialize exception text: it may contain paths/provider details.
        yield stageb_failed_sse()
        return

    for chunk in chunks:
        yield chunk
