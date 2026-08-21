#!/usr/bin/env python3
import asyncio
import json


class Generation:
    def __init__(self, name, maximum_parallel, counter):
        self.name = name
        self.sem = asyncio.Semaphore(maximum_parallel)
        self.counter = counter
        self.release = asyncio.Event()

    async def launch(self, task_id):
        async with self.sem:
            self.counter["active"] += 1
            self.counter["peak"] = max(self.counter["peak"], self.counter["active"])
            self.counter["events"].append(
                f"enter:{self.name}:{task_id}:{self.counter['active']}"
            )
            try:
                await self.release.wait()
            finally:
                self.counter["active"] -= 1
                self.counter["events"].append(
                    f"exit:{self.name}:{task_id}:{self.counter['active']}"
                )


class CurrentServerLifecycle:
    """Faithful concurrency shape of current ServerSubagentLifecycle.

    Each entrypoint owns a separate SubagentLifecycle(maximum_parallel), while a
    rebind publishes the replacement before the retired generation drains.
    """

    def __init__(self, maximum_parallel=2):
        self.maximum_parallel = maximum_parallel
        self.counter = {"active": 0, "peak": 0, "events": []}
        self.current = None
        self.retired = []

    def bind(self, name):
        if self.current:
            self.retired.append(self.current)
        self.current = Generation(name, self.maximum_parallel, self.counter)
        return self.current

    async def launch(self, task_id):
        return await self.current.launch(task_id)


class CandidateGlobalGateLifecycle(CurrentServerLifecycle):
    """Candidate contract: one server-wide permit pool spans all generations."""

    def __init__(self, maximum_parallel=2):
        super().__init__(maximum_parallel)
        self.global_sem = asyncio.Semaphore(maximum_parallel)

    async def launch(self, task_id):
        generation = self.current
        async with self.global_sem:
            return await generation.launch(task_id)


async def run_current():
    server = CurrentServerLifecycle(2)
    old = server.bind("old")
    old_1 = asyncio.create_task(server.launch("old-1"))
    old_2 = asyncio.create_task(server.launch("old-2"))
    while server.counter["active"] < 2:
        await asyncio.sleep(0)

    new = server.bind("new")
    new_1 = asyncio.create_task(server.launch("new-1"))
    new_2 = asyncio.create_task(server.launch("new-2"))
    for _ in range(200):
        if server.counter["peak"] >= 4:
            break
        await asyncio.sleep(0)

    peak = server.counter["peak"]
    new.release.set()
    old.release.set()
    await asyncio.gather(old_1, old_2, new_1, new_2)
    return {
        "peak_provider_concurrency": peak,
        "configured_maximum_parallel": 2,
        "violates_global_limit": peak > 2,
        "events": server.counter["events"],
    }


async def run_candidate():
    server = CandidateGlobalGateLifecycle(2)
    old = server.bind("old")
    old_1 = asyncio.create_task(server.launch("old-1"))
    old_2 = asyncio.create_task(server.launch("old-2"))
    while server.counter["active"] < 2:
        await asyncio.sleep(0)

    new = server.bind("new")
    new_1 = asyncio.create_task(server.launch("new-1"))
    new_2 = asyncio.create_task(server.launch("new-2"))
    await asyncio.sleep(0.02)
    peak_before_release = server.counter["peak"]

    old.release.set()
    for _ in range(200):
        if any(event.startswith("enter:new:") for event in server.counter["events"]):
            break
        await asyncio.sleep(0)
    new.release.set()
    await asyncio.gather(old_1, old_2, new_1, new_2)
    return {
        "peak_provider_concurrency": server.counter["peak"],
        "peak_before_old_drain": peak_before_release,
        "configured_maximum_parallel": 2,
        "violates_global_limit": server.counter["peak"] > 2,
        "events": server.counter["events"],
    }


async def main():
    current = await run_current()
    candidate = await run_candidate()
    assert current["peak_provider_concurrency"] == 4
    assert current["violates_global_limit"] is True
    assert candidate["peak_provider_concurrency"] == 2
    assert candidate["peak_before_old_drain"] == 2
    assert candidate["violates_global_limit"] is False
    print(
        json.dumps(
            {
                "verdict": "REPRODUCED_PER_GENERATION_PARALLELISM_OVERBOOK_AND_GLOBAL_GATE_PASS",
                "current": current,
                "candidate": candidate,
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
