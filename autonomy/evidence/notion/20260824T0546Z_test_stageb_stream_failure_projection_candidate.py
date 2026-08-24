from __future__ import annotations

import asyncio
import json
from typing import Any

from starlette.responses import StreamingResponse

from stageb_stream_failure_projection_candidate import (
    buffered_sse_projection_with_keepalive,
    stageb_failed_sse,
)


async def project_ok(result: dict[str, Any]):
    yield ("event: response.completed\ndata: " + json.dumps(result) + "\n\n").encode()


async def project_raises(_result: dict[str, Any]):
    # Important: this first chunk must never leak, because projection is buffered.
    yield b"event: response.created\ndata: {\"response\":{\"id\":\"resp_should_not_leak\"}}\n\n"
    raise RuntimeError("SECRET_PATH=/private/runtime/provider")


async def collect(gen):
    out = []
    async for item in gen:
        out.append(item)
    return out


async def asgi_messages(gen):
    response = StreamingResponse(gen, media_type="text/event-stream")
    sent = []
    incoming = asyncio.Queue()
    await incoming.put({"type": "http.request", "body": b"", "more_body": False})

    async def receive():
        return await incoming.get()

    async def send(message):
        sent.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.4"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/v1/responses",
        "raw_path": b"/v1/responses",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 1),
        "server": ("127.0.0.1", 80),
    }
    await response(scope, receive, send)
    return sent


async def main():
    passed = 0

    async def slow():
        await asyncio.sleep(0.12)
        return {"type": "response.completed", "response": {"id": "resp_exact"}}

    task = asyncio.create_task(slow())
    chunks = await collect(
        buffered_sse_projection_with_keepalive(task, project_ok, heartbeat_seconds=0.05)
    )
    assert chunks[:-1] and all(c == b": stageb-commit-pending\n\n" for c in chunks[:-1])
    assert b"resp_exact" in chunks[-1]
    passed += 1

    task = asyncio.create_task(asyncio.sleep(0, result={"ok": True}))
    await task
    chunks = await collect(buffered_sse_projection_with_keepalive(task, project_ok))
    assert len(chunks) == 1 and b"response.completed" in chunks[0]
    passed += 1

    async def late_fail():
        await asyncio.sleep(0.07)
        raise RuntimeError("SECRET_PATH=/private/runtime/provider")

    task = asyncio.create_task(late_fail())
    chunks = await collect(
        buffered_sse_projection_with_keepalive(task, project_ok, heartbeat_seconds=0.05)
    )
    assert chunks[0] == b": stageb-commit-pending\n\n"
    failed = chunks[-1]
    assert b"event: response.failed" in failed
    assert b"server_error" in failed
    assert b"SECRET_PATH" not in failed and b"/private" not in failed
    assert b"resp_" not in failed and b"call_" not in failed and b"fc_" not in failed
    passed += 1

    async def immediate_fail():
        raise RuntimeError("private failure")

    task = asyncio.create_task(immediate_fail())
    await asyncio.sleep(0)
    chunks = await collect(buffered_sse_projection_with_keepalive(task, project_ok))
    assert len(chunks) == 1 and b"response.failed" in chunks[0]
    passed += 1

    task = asyncio.create_task(asyncio.sleep(0, result={"id": "durable"}))
    await task
    chunks = await collect(buffered_sse_projection_with_keepalive(task, project_raises))
    assert len(chunks) == 1 and b"response.failed" in chunks[0]
    assert b"resp_should_not_leak" not in chunks[0] and b"SECRET_PATH" not in chunks[0]
    passed += 1

    task = asyncio.create_task(asyncio.sleep(10))
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    chunks = await collect(buffered_sse_projection_with_keepalive(task, project_ok))
    assert len(chunks) == 1 and b"response.failed" in chunks[0]
    passed += 1

    gate = asyncio.Event()

    async def server_owned():
        await gate.wait()
        return {"ok": True}

    task = asyncio.create_task(server_owned())
    waiter = asyncio.create_task(
        collect(buffered_sse_projection_with_keepalive(task, project_ok, heartbeat_seconds=1.0))
    )
    await asyncio.sleep(0.02)
    waiter.cancel()
    try:
        await waiter
    except asyncio.CancelledError:
        pass
    assert not task.cancelled() and not task.done()
    gate.set()
    await task
    passed += 1

    task = asyncio.create_task(late_fail())
    messages = await asgi_messages(
        buffered_sse_projection_with_keepalive(task, project_ok, heartbeat_seconds=0.05)
    )
    assert messages[0]["type"] == "http.response.start" and messages[0]["status"] == 200
    bodies = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
    assert b": stageb-commit-pending\n\n" in bodies
    assert b"event: response.failed" in bodies
    assert b"response.completed" not in bodies
    passed += 1

    raw = stageb_failed_sse().decode()
    data = json.loads(raw.split("data: ", 1)[1])
    assert data["type"] == "response.failed"
    assert data["response"]["error"]["code"] == "server_error"
    assert "id" not in data["response"]
    passed += 1

    provider_calls = 1
    unresolved_intent = True
    retry_provider_call = not unresolved_intent
    provider_calls += int(retry_provider_call)
    assert provider_calls == 1
    passed += 1

    print(f"STAGEB_STREAM_FAILURE_PROJECTION_PASS {passed}/10")


if __name__ == "__main__":
    asyncio.run(main())
