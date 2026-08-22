#!/usr/bin/env python3
"""Offline regression for confirmed mutating child tool success followed by hard crash.

Models the exact current ordering in Notion Agent:
  durable begin_call -> local side effect -> confirmed ok=true -> durable resolve_call
  -> tool result appended only to process-local DelegatedToolLoopSession history.

A hard process crash after resolve_call but before any durable child-history/final-result
publication loses the only no-replay marker. Restarting the same logical child can then
execute the already-successful mutation again.
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path


class CurrentGuard:
    def __init__(self, path: Path) -> None:
        self.path = path
        if path.exists():
            raw = json.loads(path.read_text(encoding="utf-8"))
            self.inflight = {tuple(item) for item in raw["inflight"]}
        else:
            self.inflight: set[tuple[str, str]] = set()
            self._save()

    def _save(self) -> None:
        self.path.write_text(
            json.dumps({"inflight": sorted(map(list, self.inflight))}, sort_keys=True),
            encoding="utf-8",
        )

    def contains(self, task_id: str) -> bool:
        return any(task == task_id for task, _ in self.inflight)

    def begin(self, task_id: str, call_id: str) -> None:
        if self.contains(task_id):
            raise RuntimeError("task already guarded")
        self.inflight.add((task_id, call_id))
        self._save()

    def resolve(self, task_id: str, call_id: str) -> None:
        self.inflight.remove((task_id, call_id))
        self._save()


class CandidateGuard:
    """Contract model: confirmed local success stays dirty until durable child commit."""

    def __init__(self, path: Path) -> None:
        self.path = path
        if path.exists():
            raw = json.loads(path.read_text(encoding="utf-8"))
            self.inflight = {tuple(item) for item in raw["inflight"]}
            self.dirty = set(raw["dirty"])
        else:
            self.inflight: set[tuple[str, str]] = set()
            self.dirty: set[str] = set()
            self._save()

    def _save(self) -> None:
        self.path.write_text(
            json.dumps(
                {
                    "inflight": sorted(map(list, self.inflight)),
                    "dirty": sorted(self.dirty),
                },
                sort_keys=True,
            ),
            encoding="utf-8",
        )

    def contains(self, task_id: str) -> bool:
        return task_id in self.dirty or any(task == task_id for task, _ in self.inflight)

    def begin(self, task_id: str, call_id: str) -> None:
        if self.contains(task_id):
            raise RuntimeError("task has durable unresolved/completed-uncommitted side effect")
        self.inflight.add((task_id, call_id))
        self._save()

    def tool_succeeded(self, task_id: str, call_id: str) -> None:
        self.inflight.remove((task_id, call_id))
        self.dirty.add(task_id)
        self._save()

    def publish_durable_child_completion(self, task_id: str) -> None:
        # This transition is legal only after child history/final result has its own
        # strict durable publication. Current product has no such publication yet.
        self.dirty.discard(task_id)
        self._save()


def reproduce_current(tmp: Path) -> dict[str, object]:
    path = tmp / "current.json"
    side_effects: list[str] = []
    guard = CurrentGuard(path)
    guard.begin("child-1", "call-write")
    side_effects.append("WRITE")
    guard.resolve("child-1", "call-write")

    # Hard crash here: process-local child history containing the tool result is lost.
    restarted = CurrentGuard(path)
    restart_blocked = restarted.contains("child-1")
    if not restart_blocked:
        restarted.begin("child-1", "call-write-replayed")
        side_effects.append("WRITE")

    return {
        "side_effect_count": len(side_effects),
        "restart_blocked": restart_blocked,
        "duplicate": len(side_effects) == 2,
    }


def verify_candidate_contract(tmp: Path) -> dict[str, object]:
    path = tmp / "candidate.json"
    side_effects: list[str] = []
    guard = CandidateGuard(path)
    guard.begin("child-1", "call-write")
    side_effects.append("WRITE")
    guard.tool_succeeded("child-1", "call-write")

    # Same crash boundary. The durable dirty marker survives and blocks relaunch.
    restarted = CandidateGuard(path)
    restart_blocked = restarted.contains("child-1")
    if not restart_blocked:
        side_effects.append("WRITE")

    return {
        "side_effect_count": len(side_effects),
        "restart_blocked": restart_blocked,
        "duplicate": len(side_effects) > 1,
    }


def main() -> None:
    with tempfile.TemporaryDirectory() as raw_tmp:
        tmp = Path(raw_tmp)
        current = reproduce_current(tmp)
        candidate = verify_candidate_contract(tmp)

    assert current == {
        "side_effect_count": 2,
        "restart_blocked": False,
        "duplicate": True,
    }, current
    assert candidate == {
        "side_effect_count": 1,
        "restart_blocked": True,
        "duplicate": False,
    }, candidate

    print(
        json.dumps(
            {
                "verdict": "CURRENT_REPLAY_REPRODUCED_CANDIDATE_CONTRACT_PASS",
                "current": current,
                "candidate": candidate,
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
