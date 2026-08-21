#!/usr/bin/env python3
from __future__ import annotations

import json
import tempfile
from dataclasses import dataclass
from pathlib import Path

class SimulatedProcessCrash(BaseException):
    pass

@dataclass(frozen=True)
class Context:
    task_id: str
    parent_turn_id: str
    target: str = "notion"

def delegated_identity(ctx: Context) -> str:
    return f"{ctx.target}:{ctx.parent_turn_id}:{ctx.task_id}"

class CurrentInMemorySession:
    """Exact relevant current semantics: child history/seen ids live only in memory."""
    def __init__(self, ctx: Context, counter: Path):
        self.ctx = ctx
        self.counter = counter
        self.history = [{"type":"message","role":"user","content":"increment once"}]
        self.seen = set()

    def run_first_tool_and_crash(self):
        call_id = "call-1"
        if call_id in self.seen:
            raise RuntimeError("duplicate call")
        self.seen.add(call_id)
        self.history.append({"type":"assistant_tool_calls","calls":[call_id]})
        value = int(self.counter.read_text())
        self.counter.write_text(str(value + 1))
        # Equivalent to process death after mutating executor committed but before
        # function_call_output / final child result was durably published.
        raise SimulatedProcessCrash()

class DurableCandidate:
    """Candidate contract, not product code."""
    def __init__(self, ctx: Context, counter: Path, state_path: Path):
        self.ctx = ctx
        self.counter = counter
        self.state_path = state_path

    def _load(self):
        if not self.state_path.exists():
            return {"tasks": {}}
        return json.loads(self.state_path.read_text())

    def _save(self, state):
        tmp = self.state_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, sort_keys=True))
        tmp.replace(self.state_path)

    def run_first_tool_and_crash(self):
        state = self._load()
        key = delegated_identity(self.ctx)
        task = state["tasks"].setdefault(key, {"status":"pending"})
        if task.get("status") in {"tool_inflight_mutating","uncertain"}:
            raise RuntimeError("automatic retry blocked: uncertain mutating tool")
        task.update({"status":"tool_inflight_mutating","call_id":"call-1","tool":"write_file"})
        self._save(state)  # durable BEFORE entering mutating executor
        value = int(self.counter.read_text())
        self.counter.write_text(str(value + 1))
        raise SimulatedProcessCrash()

    def retry(self):
        state = self._load()
        task = state["tasks"][delegated_identity(self.ctx)]
        if task.get("status") == "tool_inflight_mutating":
            task["status"] = "uncertain"
            self._save(state)
            raise RuntimeError("automatic retry blocked: uncertain mutating tool")
        raise AssertionError("unexpected state")

def main():
    with tempfile.TemporaryDirectory(prefix="notion-child-restart-") as td:
        root = Path(td)
        current_counter = root/"current.counter"
        current_counter.write_text("0")
        ctx = Context(task_id="child-1", parent_turn_id="parent-A")

        # Process 1 mutates then dies.
        try:
            CurrentInMemorySession(ctx, current_counter).run_first_tool_and_crash()
        except SimulatedProcessCrash:
            pass
        # Process 2 has no durable child state, so the same logical launch is fresh.
        try:
            CurrentInMemorySession(ctx, current_counter).run_first_tool_and_crash()
        except SimulatedProcessCrash:
            pass
        current_effects = int(current_counter.read_text())

        safe_counter = root/"safe.counter"
        safe_counter.write_text("0")
        state_path = root/"child-state.json"
        first = DurableCandidate(ctx, safe_counter, state_path)
        try:
            first.run_first_tool_and_crash()
        except SimulatedProcessCrash:
            pass
        blocked = False
        try:
            DurableCandidate(ctx, safe_counter, state_path).retry()
        except RuntimeError as exc:
            blocked = "uncertain mutating tool" in str(exc)
        safe_effects = int(safe_counter.read_text())

        assert current_effects == 2
        assert safe_effects == 1
        assert blocked

        print(json.dumps({
            "verdict":"NOTION_DELEGATED_RESTART_SIDE_EFFECT_GAP_REPRODUCED",
            "current_process_restart_side_effects":current_effects,
            "candidate_side_effects":safe_effects,
            "candidate_automatic_retry_blocked":blocked,
            "required_identity":"(target,parent_turn_id,task_id)",
            "required_boundary":"durably mark mutating tool inflight before executor; restart => uncertain",
        }, sort_keys=True))

if __name__ == "__main__":
    main()
