from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from autonomy.evidence.notion.20260824T0752Z_stageb_server_owned_lock_boundary_candidate import run_stageb_under_request_locks


class Registry:
    def __init__(self) -> None:
        self.tasks: set[asyncio.Task[object]] = set()

    def start(self, coroutine):
        task = asyncio.create_task(coroutine)
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)
        return task

    async def wait_client(self, task):
        return await asyncio.shield(task)


@asynccontextmanager
async def nop():
    yield


class Shared:
    def __init__(self) -> None:
        self.conv = asyncio.Lock()
        self.aff = asyncio.Lock()
        self.active = 0
        self.max_active = 0

    @asynccontextmanager
    async def conversation(self):
        async with self.conv:
            yield

    @asynccontextmanager
    async def affinity(self):
        async with self.aff:
            yield


async def main() -> None:
    shared = Shared()
    registry = Registry()
    first_entered = asyncio.Event()
    release_first = asyncio.Event()
    second_entered = asyncio.Event()

    async def execute_first():
        shared.active += 1
        shared.max_active = max(shared.max_active, shared.active)
        first_entered.set()
        try:
            await release_first.wait()
            return {"id": "resp-fixed"}
        finally:
            shared.active -= 1

    async def execute_second():
        shared.active += 1
        shared.max_active = max(shared.max_active, shared.active)
        second_entered.set()
        try:
            return {"id": "resp-second"}
        finally:
            shared.active -= 1

    first = registry.start(
        run_stageb_under_request_locks(
            inference_slot=nop(),
            conversation_lock=shared.conversation(),
            affinity_lock=shared.affinity(),
            execute=execute_first,
        )
    )
    await first_entered.wait()

    waiter = asyncio.create_task(registry.wait_client(first))
    await asyncio.sleep(0)
    waiter.cancel()
    try:
        await waiter
    except asyncio.CancelledError:
        pass

    assert not first.done(), "client cancellation cancelled server-owned transaction"
    assert shared.conv.locked() and shared.aff.locked(), "request locks released while transaction pending"

    second = registry.start(
        run_stageb_under_request_locks(
            inference_slot=nop(),
            conversation_lock=shared.conversation(),
            affinity_lock=shared.affinity(),
            execute=execute_second,
        )
    )
    await asyncio.sleep(0.03)
    assert not second_entered.is_set(), "same-key second request entered before first durable transaction finished"

    release_first.set()
    assert await first == {"id": "resp-fixed"}
    assert await second == {"id": "resp-second"}
    assert shared.max_active == 1

    # Negative control: locks owned by the client/generator are released while a
    # detached provider/commit task is still alive, allowing same-key overlap.
    conv = asyncio.Lock()
    remote_started = asyncio.Event()
    remote_release = asyncio.Event()

    async def remote():
        remote_started.set()
        await remote_release.wait()

    async with conv:
        detached = asyncio.create_task(remote())
        await remote_started.wait()
    assert not conv.locked() and not detached.done(), "negative control did not expose early lock release"

    competitor_entered = False
    async with conv:
        competitor_entered = True
    assert competitor_entered and not detached.done()
    remote_release.set()
    await detached

    print("STAGEB_SERVER_OWNED_LOCK_BOUNDARY_PASS 6/6")


if __name__ == "__main__":
    asyncio.run(main())
