#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass


@dataclass(frozen=True)
class Call:
    call_id: str
    name: str


@dataclass(frozen=True)
class Reply:
    text: str = ""
    tool_calls: tuple[Call, ...] = ()


class CurrentLoop:
    """Exact control-flow model of DelegatedToolLoopSession.run() budget handling."""

    def __init__(self, max_turns: int, model_step, tool_executor):
        self.max_turns = max_turns
        self.model_step = model_step
        self.tool_executor = tool_executor
        self.completed = 0
        self.history = []

    async def run(self):
        while self.completed < self.max_turns:
            reply = await self.model_step(self.completed, tuple(self.history))
            if not reply.tool_calls:
                if not reply.text.strip():
                    raise RuntimeError("finished without text")
                self.completed += 1
                return reply.text.strip()

            self.completed += 1
            self.history.append(("assistant_tool_calls", self.completed, reply.tool_calls))
            for call in reply.tool_calls:
                result = await self.tool_executor(call)
                self.history.append(("function_call_output", call.call_id, result))

        raise RuntimeError("delegated task exceeded model-turn budget")


class CandidateLoop(CurrentLoop):
    """Candidate: the last allowed model reply cannot start tools it can never consume."""

    async def run(self):
        while self.completed < self.max_turns:
            reply = await self.model_step(self.completed, tuple(self.history))
            if not reply.tool_calls:
                if not reply.text.strip():
                    raise RuntimeError("finished without text")
                self.completed += 1
                return reply.text.strip()

            next_turn = self.completed + 1
            if next_turn >= self.max_turns:
                # Count the provider/model turn, but fail before publishing call ids,
                # mutating local history or entering a local tool executor.
                self.completed = next_turn
                raise RuntimeError("delegated task exhausted model-turn budget before tool execution")

            self.completed = next_turn
            self.history.append(("assistant_tool_calls", self.completed, reply.tool_calls))
            for call in reply.tool_calls:
                result = await self.tool_executor(call)
                self.history.append(("function_call_output", call.call_id, result))

        raise RuntimeError("delegated task exceeded model-turn budget")


async def exercise(loop_cls):
    mutation_count = 0
    read_count = 0

    async def model_step(completed, history):
        del history
        if completed == 0:
            return Reply(tool_calls=(Call("read-1", "read_file"),))
        return Reply(tool_calls=(Call("write-final", "write_file"),))

    async def tool_executor(call):
        nonlocal mutation_count, read_count
        if call.name == "read_file":
            read_count += 1
            return {"ok": True, "content": "x"}
        if call.name == "write_file":
            mutation_count += 1
            return {"ok": True, "written": True}
        raise AssertionError(call.name)

    loop = loop_cls(2, model_step, tool_executor)
    error = None
    try:
        await loop.run()
    except RuntimeError as exc:
        error = str(exc)
    return {
        "read_count": read_count,
        "mutation_count": mutation_count,
        "completed_model_turns": loop.completed,
        "error": error,
        "history": [str(item[0]) for item in loop.history],
    }


async def main():
    current = await exercise(CurrentLoop)
    candidate = await exercise(CandidateLoop)

    assert current["read_count"] == 1
    assert current["mutation_count"] == 1
    assert current["completed_model_turns"] == 2
    assert current["error"] == "delegated task exceeded model-turn budget"

    assert candidate["read_count"] == 1
    assert candidate["mutation_count"] == 0
    assert candidate["completed_model_turns"] == 2
    assert "before tool execution" in candidate["error"]

    print(json.dumps({
        "verdict": "FINAL_TURN_ORPHAN_TOOL_SIDE_EFFECT_REPRODUCED_AND_GUARD_PASS",
        "current": current,
        "candidate": candidate,
        "contract": "A model reply that consumes the last allowed turn must not enter any local tool executor, because no remaining model turn exists to consume that result and finish the task.",
    }, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
