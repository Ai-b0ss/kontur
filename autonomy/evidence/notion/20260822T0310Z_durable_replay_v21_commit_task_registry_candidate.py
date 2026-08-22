from __future__ import annotations

import asyncio
from collections.abc import Awaitable
from typing import Any


class CommitTaskRegistryClosed(RuntimeError):
    pass


class CommitTaskRegistry:
    """Own commit-critical tasks independently of client/SSE lifetime."""

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task[Any]] = set()
        self._closed = False
        self._errors: list[BaseException] = []

    @property
    def active(self) -> int:
        return len(self._tasks)

    @property
    def observed_errors(self) -> tuple[BaseException, ...]:
        return tuple(self._errors)

    def create(self, awaitable: Awaitable[Any]) -> asyncio.Task[Any]:
        if self._closed:
            if hasattr(awaitable, "close"):
                awaitable.close()  # type: ignore[attr-defined]
            raise CommitTaskRegistryClosed("commit registry is draining")
        task = asyncio.create_task(awaitable)
        self._tasks.add(task)
        task.add_done_callback(self._done)
        return task

    def _done(self, task: asyncio.Task[Any]) -> None:
        self._tasks.discard(task)
        if task.cancelled():
            return
        try:
            exc = task.exception()
        except asyncio.CancelledError:
            return
        if exc is not None:
            self._errors.append(exc)

    async def drain(self, *, timeout: float) -> dict[str, int]:
        self._closed = True
        tasks = tuple(self._tasks)
        if not tasks:
            return {"completed": 0, "cancelled_after_timeout": 0}
        done, pending = await asyncio.wait(tasks, timeout=max(0.0, timeout))
        if pending:
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
        await asyncio.sleep(0)
        return {
            "completed": len(done),
            "cancelled_after_timeout": len(pending),
        }
