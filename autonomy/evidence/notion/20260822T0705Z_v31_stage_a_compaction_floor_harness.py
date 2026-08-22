from __future__ import annotations

import asyncio
from dataclasses import dataclass


class DurableStateUnavailable(RuntimeError):
    pass


@dataclass
class FakeStore:
    blocked_on_get: bool = False
    already_blocked: bool = False
    persistent: bool = True

    async def get(self, key):
        if self.blocked_on_get:
            self.already_blocked = True
        return None

    async def require_persistence_ready(self):
        if self.persistent and self.already_blocked:
            raise DurableStateUnavailable("durable conversation state is unavailable")


async def v30_ordinary(store: FakeStore, provider_counter: list[int]):
    await store.get("conversation")
    try:
        await store.require_persistence_ready()
    except DurableStateUnavailable:
        return 503
    provider_counter[0] += 1
    return 200


async def v30_compaction_actual_gap(store: FakeStore, provider_counter: list[int]):
    await store.get("conversation")
    provider_counter[0] += 1
    return 200


async def v31_compaction(store: FakeStore, provider_counter: list[int]):
    await store.get("conversation")
    try:
        await store.require_persistence_ready()
    except DurableStateUnavailable:
        return 503
    provider_counter[0] += 1
    return 200


async def main():
    count = [0]
    assert await v30_ordinary(FakeStore(blocked_on_get=True), count) == 503
    assert count[0] == 0

    count = [0]
    assert await v30_compaction_actual_gap(FakeStore(blocked_on_get=True), count) == 200
    assert count[0] == 1

    count = [0]
    assert await v31_compaction(FakeStore(blocked_on_get=True), count) == 503
    assert count[0] == 0

    count = [0]
    assert await v31_compaction(FakeStore(), count) == 200
    assert count[0] == 1

    print("V31_STAGE_A_COMPACTION_FLOOR_MODEL_PASS")


if __name__ == "__main__":
    asyncio.run(main())
