import asyncio
import importlib.util
from pathlib import Path

candidate_path = Path(__file__).with_name(
    "20260822T0310Z_durable_replay_v21_commit_task_registry_candidate.py"
)
spec = importlib.util.spec_from_file_location("v21_commit_registry_candidate", candidate_path)
if spec is None or spec.loader is None:
    raise RuntimeError("candidate module could not be loaded")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
CommitTaskRegistry = module.CommitTaskRegistry
CommitTaskRegistryClosed = module.CommitTaskRegistryClosed


async def main():
    reg = CommitTaskRegistry()
    gate = asyncio.Event()
    finished = []

    async def commit():
        await gate.wait()
        finished.append("ok")
        return 7

    task = reg.create(commit())
    assert reg.active == 1
    gate.set()
    assert await task == 7
    await asyncio.sleep(0)
    assert reg.active == 0 and finished == ["ok"]

    reg = CommitTaskRegistry()

    async def boom():
        raise ValueError("x")

    task = reg.create(boom())
    try:
        await task
    except ValueError:
        pass
    await asyncio.sleep(0)
    assert len(reg.observed_errors) == 1
    assert isinstance(reg.observed_errors[0], ValueError)

    reg = CommitTaskRegistry()
    gate = asyncio.Event()

    async def later():
        await gate.wait()
        return 1

    reg.create(later())

    async def release():
        await asyncio.sleep(0.02)
        gate.set()

    asyncio.create_task(release())
    result = await reg.drain(timeout=0.2)
    assert result == {"completed": 1, "cancelled_after_timeout": 0}
    assert reg.active == 0

    reg = CommitTaskRegistry()
    cancelled = asyncio.Event()

    async def stuck():
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    reg.create(stuck())
    result = await reg.drain(timeout=0.01)
    assert result == {"completed": 0, "cancelled_after_timeout": 1}
    assert cancelled.is_set() and reg.active == 0

    try:
        reg.create(asyncio.sleep(0))
    except CommitTaskRegistryClosed:
        pass
    else:
        raise AssertionError

    print("DURABLE_REPLAY_V21_COMMIT_TASK_REGISTRY_CANDIDATE_PASS")


asyncio.run(main())
