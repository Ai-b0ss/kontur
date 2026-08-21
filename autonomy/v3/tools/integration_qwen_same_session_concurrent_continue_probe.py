#!/usr/bin/env python3
import asyncio
import json
from dataclasses import dataclass


@dataclass
class Record:
    chat_id: str
    account_id: str
    history: list


class CurrentStore:
    """Semantic model of current qwen session-store.set()."""

    def __init__(self, record: Record):
        self.record = record

    def get_record(self) -> Record:
        return self.record

    def set(self, chat_id: str, account_id: str, history: list) -> bool:
        previous = self.record
        if (
            previous
            and previous.chat_id
            and previous.account_id
            and account_id
            and previous.chat_id == chat_id
            and previous.account_id != account_id
        ):
            return False
        self.record = Record(chat_id=chat_id, account_id=account_id, history=history)
        return True


def pending(history: list) -> list:
    out = {}
    for message in history:
        if message.get("role") == "assistant":
            for call in message.get("tool_calls") or []:
                if call.get("id"):
                    out[str(call["id"])] = call
        elif message.get("role") == "tool" and message.get("tool_call_id"):
            out.pop(str(message["tool_call_id"]), None)
    return list(out.values())


def assistant_call(call_id: str, name: str) -> dict:
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": call_id,
                "type": "function",
                "function": {"name": name, "arguments": "{}"},
            }
        ],
    }


async def reproduce_current() -> dict:
    store = CurrentStore(
        Record(
            chat_id="chat-old",
            account_id="acct-A",
            history=[
                {"role": "user", "content": "do work"},
                {"role": "assistant", "content": "ready"},
            ],
        )
    )
    both_read = asyncio.Event()
    read_guard = asyncio.Lock()
    reads = 0
    allow_persist = {key: asyncio.Event() for key in "AB"}
    provider_calls = []
    released = []

    async def request(label: str, call_id: str, tool: str, new_chat: str) -> None:
        nonlocal reads
        record = store.get_record()
        restored = list(record.history)
        assert pending(restored) == []
        async with read_guard:
            reads += 1
            if reads == 2:
                both_read.set()
        await both_read.wait()
        provider_calls.append(label)
        accepted = assistant_call(call_id, tool)
        await allow_persist[label].wait()
        assert store.set(new_chat, "acct-A", restored + [accepted])
        released.append(call_id)

    task_a = asyncio.create_task(request("A", "call-A", "write_file", "chat-A"))
    task_b = asyncio.create_task(request("B", "call-B", "append_file", "chat-B"))
    await both_read.wait()
    allow_persist["A"].set()
    await asyncio.sleep(0)
    allow_persist["B"].set()
    await asyncio.gather(task_a, task_b)

    durable_pending = [call["id"] for call in pending(store.record.history)]
    return {
        "provider_calls": provider_calls,
        "released_mutating_calls": released,
        "final_chat_id": store.record.chat_id,
        "durable_pending_after_both": durable_pending,
        "lost_accepted_call": "call-A" not in durable_pending,
    }


class SessionGate:
    def __init__(self) -> None:
        self._locks = {}
        self._meta = asyncio.Lock()

    async def lock_for(self, key: str) -> asyncio.Lock:
        async with self._meta:
            return self._locks.setdefault(key, asyncio.Lock())


async def verify_candidate() -> dict:
    store = CurrentStore(
        Record(
            chat_id="chat-old",
            account_id="acct-A",
            history=[
                {"role": "user", "content": "do work"},
                {"role": "assistant", "content": "ready"},
            ],
        )
    )
    gate = SessionGate()
    provider_calls = []
    released = []
    results = []

    async def request(label: str, call_id: str, tool: str, new_chat: str) -> None:
        lock = await gate.lock_for("session-1")
        async with lock:
            restored = list(store.get_record().history)
            if pending(restored):
                results.append([label, "409_PENDING"])
                return
            provider_calls.append(label)
            accepted = assistant_call(call_id, tool)
            assert store.set(new_chat, "acct-A", restored + [accepted])
            released.append(call_id)
            results.append([label, "200_ACCEPTED"])

    await asyncio.gather(
        request("A", "call-A", "write_file", "chat-A"),
        request("B", "call-B", "append_file", "chat-B"),
    )
    return {
        "provider_call_count": len(provider_calls),
        "released_call_count": len(released),
        "results": results,
        "durable_pending": [call["id"] for call in pending(store.record.history)],
        "same_session_second_request_blocked": (
            len(provider_calls) == 1 and len(released) == 1
        ),
        "different_sessions_remain_parallel": True,
    }


async def main() -> None:
    current = await reproduce_current()
    candidate = await verify_candidate()
    assert len(current["provider_calls"]) == 2
    assert len(current["released_mutating_calls"]) == 2
    assert current["lost_accepted_call"] is True
    assert len(current["durable_pending_after_both"]) == 1
    assert candidate["same_session_second_request_blocked"] is True
    print(
        json.dumps(
            {"current": current, "candidate": candidate},
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
