#!/usr/bin/env python3
from __future__ import annotations

import asyncio
from dataclasses import dataclass


@dataclass
class FakePool:
    name: str
    account_id: str = "account-A"
    busy: bool = False

    async def run(self, entered: asyncio.Event, release: asyncio.Event, shared: dict) -> None:
        if self.busy:
            raise RuntimeError("same pool instance is already busy")
        self.busy = True
        active = shared.setdefault("active", {})
        peak = shared.setdefault("peak", {})
        active[self.account_id] = active.get(self.account_id, 0) + 1
        peak[self.account_id] = max(peak.get(self.account_id, 0), active[self.account_id])
        entered.set()
        try:
            await release.wait()
        finally:
            active[self.account_id] -= 1
            self.busy = False


class PublishBeforeDrainLifecycle:
    """Minimal model of current ServerSubagentLifecycle rebind semantics."""

    def __init__(self, pool: FakePool) -> None:
        self.pool = pool

    async def launch(self, entered: asyncio.Event, release: asyncio.Event, shared: dict) -> None:
        await self.pool.run(entered, release, shared)

    async def rebind_and_drain(self, replacement: FakePool, old_task: asyncio.Task) -> None:
        # Current product publishes the replacement generation first, then drains old work.
        self.pool = replacement
        await old_task


class DrainBeforePublishLifecycle:
    """Conservative candidate contract: no overlapping logical account generations."""

    def __init__(self, pool: FakePool) -> None:
        self.pool = pool
        self._transition = asyncio.Lock()

    async def launch(self, entered: asyncio.Event, release: asyncio.Event, shared: dict) -> None:
        async with self._transition:
            pool = self.pool
        await pool.run(entered, release, shared)

    async def rebind_and_drain(self, replacement: FakePool, old_task: asyncio.Task) -> None:
        async with self._transition:
            await old_task
            self.pool = replacement


async def current_overlap() -> int:
    shared: dict = {}
    old = FakePool("old")
    new = FakePool("new")
    lifecycle = PublishBeforeDrainLifecycle(old)

    old_entered = asyncio.Event()
    old_release = asyncio.Event()
    old_task = asyncio.create_task(lifecycle.launch(old_entered, old_release, shared))
    await old_entered.wait()

    rebind = asyncio.create_task(lifecycle.rebind_and_drain(new, old_task))
    await asyncio.sleep(0)

    new_release = asyncio.Event()
    new_release.set()
    await lifecycle.launch(asyncio.Event(), new_release, shared)

    old_release.set()
    await rebind
    return shared["peak"]["account-A"]


async def candidate_peak() -> int:
    shared: dict = {}
    old = FakePool("old")
    new = FakePool("new")
    lifecycle = DrainBeforePublishLifecycle(old)

    old_entered = asyncio.Event()
    old_release = asyncio.Event()
    old_task = asyncio.create_task(lifecycle.launch(old_entered, old_release, shared))
    await old_entered.wait()

    rebind = asyncio.create_task(lifecycle.rebind_and_drain(new, old_task))
    await asyncio.sleep(0)

    new_entered = asyncio.Event()
    new_release = asyncio.Event()
    new_release.set()
    new_task = asyncio.create_task(lifecycle.launch(new_entered, new_release, shared))
    await asyncio.sleep(0.01)
    assert not new_entered.is_set(), "new generation must not start before old logical account drains"

    old_release.set()
    await rebind
    await new_task
    return shared["peak"]["account-A"]


async def main() -> None:
    current = await current_overlap()
    candidate = await candidate_peak()
    assert current == 2
    assert candidate == 1
    print(
        "NOTION_REBIND_SAME_ACCOUNT_OVERLAP_PASS "
        "current_peak=2 candidate_peak=1"
    )


if __name__ == "__main__":
    asyncio.run(main())
