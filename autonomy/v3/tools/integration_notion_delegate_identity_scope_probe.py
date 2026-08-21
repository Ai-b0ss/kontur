#!/usr/bin/env python3
from __future__ import annotations

import asyncio
from dataclasses import dataclass


@dataclass(frozen=True)
class Request:
    task_id: str
    parent_turn_id: str
    target: str = "notion"


class CurrentLifecycle:
    """Minimal exact-semantics model of PR #8 task-id reservation."""

    def __init__(self) -> None:
        self.active: set[str] = set()
        self.guard = asyncio.Lock()

    async def run(self, request: Request, entered: asyncio.Event, release: asyncio.Event):
        task_id = request.task_id.strip()
        async with self.guard:
            if task_id in self.active:
                raise RuntimeError("delegated task_id is already active")
            self.active.add(task_id)
        try:
            entered.set()
            await release.wait()
            return request
        finally:
            async with self.guard:
                self.active.discard(task_id)


class ScopedLifecycle:
    """Candidate contract: reserve the complete delegated identity, not bare task_id."""

    def __init__(self) -> None:
        self.active: set[tuple[str, str, str]] = set()
        self.guard = asyncio.Lock()

    @staticmethod
    def identity(request: Request) -> tuple[str, str, str]:
        return (
            request.target,
            request.parent_turn_id.strip(),
            request.task_id.strip(),
        )

    async def run(self, request: Request, entered: asyncio.Event, release: asyncio.Event):
        key = self.identity(request)
        async with self.guard:
            if key in self.active:
                raise RuntimeError("delegated identity is already active")
            self.active.add(key)
        try:
            entered.set()
            await release.wait()
            return request
        finally:
            async with self.guard:
                self.active.discard(key)


async def reproduce_current() -> dict[str, bool]:
    lifecycle = CurrentLifecycle()
    entered_a = asyncio.Event()
    release_a = asyncio.Event()
    first = asyncio.create_task(
        lifecycle.run(Request("child-1", "parent-A"), entered_a, release_a)
    )
    await entered_a.wait()

    false_conflict = False
    try:
        release_b = asyncio.Event()
        release_b.set()
        await lifecycle.run(
            Request("child-1", "parent-B"), asyncio.Event(), release_b
        )
    except RuntimeError as exc:
        false_conflict = "already active" in str(exc)

    release_a.set()
    await first
    return {"cross_parent_false_conflict": false_conflict}


async def verify_candidate() -> dict[str, bool]:
    lifecycle = ScopedLifecycle()
    entered_a = asyncio.Event()
    release_a = asyncio.Event()
    first = asyncio.create_task(
        lifecycle.run(Request("child-1", "parent-A"), entered_a, release_a)
    )
    await entered_a.wait()

    release_b = asyncio.Event()
    release_b.set()
    second = await lifecycle.run(
        Request("child-1", "parent-B"), asyncio.Event(), release_b
    )

    same_identity_blocked = False
    try:
        release_dup = asyncio.Event()
        release_dup.set()
        await lifecycle.run(
            Request("child-1", "parent-A"), asyncio.Event(), release_dup
        )
    except RuntimeError as exc:
        same_identity_blocked = "already active" in str(exc)

    release_a.set()
    await first
    return {
        "cross_parent_allowed": second.parent_turn_id == "parent-B",
        "same_delegated_identity_blocked": same_identity_blocked,
    }


async def main() -> None:
    current = await reproduce_current()
    candidate = await verify_candidate()

    assert current["cross_parent_false_conflict"] is True
    assert candidate["cross_parent_allowed"] is True
    assert candidate["same_delegated_identity_blocked"] is True

    print(
        "NOTION_DELEGATE_IDENTITY_SCOPE_PASS "
        "current_false_conflict=1 cross_parent_allowed=1 same_identity_blocked=1"
    )


if __name__ == "__main__":
    asyncio.run(main())
