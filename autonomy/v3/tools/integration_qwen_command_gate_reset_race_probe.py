#!/usr/bin/env python3
import asyncio
import json


async def reproduce_current():
    state = {"session": "old", "events": []}
    started = asyncio.Event()
    finish = asyncio.Event()

    async def normal_request():
        started.set()
        await finish.wait()
        state["session"] = "resurrected"
        state["events"].append("normal_persist")

    async def reset_command():
        # Current server dispatches commandHandler before SessionRequestGate.acquire().
        state["session"] = None
        state["events"].append("reset_ack")

    task = asyncio.create_task(normal_request())
    await started.wait()
    await reset_command()
    finish.set()
    await task
    return state


async def verify_candidate_contract():
    state = {"session": "old", "events": []}
    gate = asyncio.Lock()
    started = asyncio.Event()
    finish = asyncio.Event()

    async def normal_request():
        async with gate:
            started.set()
            await finish.wait()
            state["session"] = "old-finished"
            state["events"].append("normal_persist")

    async def reset_command():
        async with gate:
            state["session"] = None
            state["events"].append("reset_ack")

    task = asyncio.create_task(normal_request())
    await started.wait()
    reset = asyncio.create_task(reset_command())
    await asyncio.sleep(0)
    finish.set()
    await task
    await reset
    return state


async def main():
    current = await reproduce_current()
    candidate = await verify_candidate_contract()
    assert current["events"] == ["reset_ack", "normal_persist"]
    assert current["session"] == "resurrected"
    assert candidate["events"] == ["normal_persist", "reset_ack"]
    assert candidate["session"] is None
    print(json.dumps({
        "verdict": "QWEN_COMMAND_GATE_RESET_RACE_REPRODUCED",
        "current": current,
        "candidate": candidate,
    }, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
