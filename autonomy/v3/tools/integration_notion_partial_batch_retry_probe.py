#!/usr/bin/env python3
"""Offline regression for Notion delegated batch partial-success replay safety.

The current SubagentLifecycle.run_many() waits for all admitted siblings, but if any
child raises it then raises that exception and discards successful sibling results.
A caller retrying the same batch can therefore re-run an already-successful child
and repeat a local side effect.

This probe contains only a minimal semantic reproduction and a candidate contract:
completed siblings are ledgered and replayed; only failed siblings are eligible for
retry. A durable ledger is still required for process-restart safety.
"""

import asyncio
import json
from dataclasses import dataclass


@dataclass(frozen=True)
class Result:
    task_id: str
    output: str


class CurrentLifecycle:
    def __init__(self):
        self.active = set()
        self.calls = {}
        self.side_effects = []

    async def _run(self, task_id):
        self.calls[task_id] = self.calls.get(task_id, 0) + 1
        if task_id == "ok":
            self.side_effects.append("WRITE")
            await asyncio.sleep(0.01)
            return Result(task_id, "done")
        await asyncio.sleep(0)
        raise RuntimeError("child failed")

    async def run_many(self, ids):
        self.active.update(ids)
        tasks = [asyncio.create_task(self._run(task_id)) for task_id in ids]
        try:
            outcomes = await asyncio.gather(*tasks, return_exceptions=True)
            for outcome in outcomes:
                if isinstance(outcome, BaseException):
                    raise outcome
            return outcomes
        finally:
            self.active.difference_update(ids)


class CandidateLifecycle:
    """Minimal same-process contract model, not a production implementation."""

    def __init__(self):
        self.calls = {}
        self.side_effects = []
        self.settled = {}

    async def _run(self, task_id):
        self.calls[task_id] = self.calls.get(task_id, 0) + 1
        if task_id == "ok":
            self.side_effects.append("WRITE")
            await asyncio.sleep(0.01)
            return Result(task_id, "done")
        await asyncio.sleep(0)
        raise RuntimeError("child failed")

    async def run_many(self, ids):
        outcomes = [None] * len(ids)
        tasks = []
        positions = []
        for index, task_id in enumerate(ids):
            if task_id in self.settled:
                outcomes[index] = self.settled[task_id]
                continue
            positions.append((index, task_id))
            tasks.append(asyncio.create_task(self._run(task_id)))

        fresh = await asyncio.gather(*tasks, return_exceptions=True)
        for (index, task_id), outcome in zip(positions, fresh):
            outcomes[index] = outcome
            if isinstance(outcome, Result):
                self.settled[task_id] = outcome
        return outcomes


async def main():
    current = CurrentLifecycle()
    for _ in range(2):
        try:
            await current.run_many(["ok", "fails"])
        except RuntimeError:
            pass

    candidate = CandidateLifecycle()
    first = await candidate.run_many(["ok", "fails"])
    second = await candidate.run_many(["ok", "fails"])

    result = {
        "verdict": "REPRODUCED_CURRENT_DUPLICATE_AND_CANDIDATE_CONTRACT_PASS",
        "current": {
            "ok_calls": current.calls.get("ok", 0),
            "failed_calls": current.calls.get("fails", 0),
            "side_effects": len(current.side_effects),
            "duplicate_side_effect": len(current.side_effects) == 2,
        },
        "candidate_contract": {
            "ok_calls": candidate.calls.get("ok", 0),
            "failed_calls": candidate.calls.get("fails", 0),
            "side_effects": len(candidate.side_effects),
            "successful_sibling_replayed_not_reexecuted": candidate.calls.get("ok", 0) == 1,
            "failed_sibling_retryable": candidate.calls.get("fails", 0) == 2,
            "first_types": [type(item).__name__ for item in first],
            "second_types": [type(item).__name__ for item in second],
        },
    }

    assert result["current"]["duplicate_side_effect"] is True
    assert result["candidate_contract"]["successful_sibling_replayed_not_reexecuted"] is True
    assert result["candidate_contract"]["failed_sibling_retryable"] is True
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    asyncio.run(main())
