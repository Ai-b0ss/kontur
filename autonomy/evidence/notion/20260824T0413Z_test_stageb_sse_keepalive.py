import asyncio
import importlib.util
import json
from pathlib import Path

HELPER = Path(__file__).with_name("20260824T0413Z_stageb_sse_keepalive_candidate.py")
spec = importlib.util.spec_from_file_location("stageb_sse_keepalive_candidate", HELPER)
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
buffered_sse_projection_with_keepalive = module.buffered_sse_projection_with_keepalive

CANONICAL = {
    "id": "resp_fixed",
    "object": "response",
    "status": "completed",
    "output": [{
        "type": "function_call",
        "id": "fc_fixed",
        "call_id": "call_fixed",
        "name": "read_file",
        "arguments": "{\"path\":\"a.txt\"}",
    }],
}

async def project(response):
    event = {"type": "response.completed", "response": response}
    yield ("event: response.completed\ndata: " + json.dumps(event, separators=(",", ":")) + "\n\n").encode()
    yield b"data: [DONE]\n\n"

async def collect(agen):
    return [chunk async for chunk in agen]

async def test_slow_keepalive_then_exact_result():
    calls = 0
    async def work():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.12)
        return CANONICAL
    task = asyncio.create_task(work())
    chunks = await collect(buffered_sse_projection_with_keepalive(task, project, heartbeat_seconds=0.03))
    comments = [c for c in chunks if c.startswith(b":")]
    assert len(comments) >= 2
    for c in comments:
        assert b"resp_" not in c and b"call_" not in c and b"fc_" not in c
        assert b"read_file" not in c and b"a.txt" not in c
    final = b"".join(chunks)
    assert b"resp_fixed" in final and b"call_fixed" in final and b"fc_fixed" in final
    assert calls == 1

async def test_fast_result_has_no_forced_heartbeat():
    async def work():
        return CANONICAL
    task = asyncio.create_task(work())
    chunks = await collect(buffered_sse_projection_with_keepalive(task, project, heartbeat_seconds=0.2))
    assert not any(c.startswith(b":") for c in chunks)
    assert b"call_fixed" in b"".join(chunks)

async def test_client_cancel_does_not_cancel_transaction():
    committed = asyncio.Event()
    async def work():
        await asyncio.sleep(0.10)
        committed.set()
        return CANONICAL
    task = asyncio.create_task(work())
    agen = buffered_sse_projection_with_keepalive(task, project, heartbeat_seconds=0.02)
    first = await anext(agen)
    assert first.startswith(b":")
    await agen.aclose()
    assert not task.cancelled()
    result = await task
    assert committed.is_set() and result is CANONICAL

async def test_transaction_error_propagates_without_protocol_payload():
    class Boom(RuntimeError): pass
    async def work():
        await asyncio.sleep(0.06)
        raise Boom("commit failed")
    task = asyncio.create_task(work())
    agen = buffered_sse_projection_with_keepalive(task, project, heartbeat_seconds=0.02)
    seen = []
    try:
        async for chunk in agen:
            seen.append(chunk)
    except Boom as exc:
        assert str(exc) == "commit failed"
    else:
        raise AssertionError("Boom not propagated")
    assert seen and all(c.startswith(b":") for c in seen)
    assert b"response." not in b"".join(seen)

async def test_nonpositive_interval_is_bounded_not_busy_loop():
    async def work():
        await asyncio.sleep(0.11)
        return CANONICAL
    task = asyncio.create_task(work())
    chunks = await collect(buffered_sse_projection_with_keepalive(task, project, heartbeat_seconds=0))
    comments = [c for c in chunks if c.startswith(b":")]
    assert 1 <= len(comments) <= 4

async def main():
    tests = [
        test_slow_keepalive_then_exact_result,
        test_fast_result_has_no_forced_heartbeat,
        test_client_cancel_does_not_cancel_transaction,
        test_transaction_error_propagates_without_protocol_payload,
        test_nonpositive_interval_is_bounded_not_busy_loop,
    ]
    for t in tests:
        await t()
    print(f"STAGEB_SSE_KEEPALIVE_PASS {len(tests)}/{len(tests)}")

asyncio.run(main())
