from __future__ import annotations

from dataclasses import dataclass, field
import copy


class PersistenceError(RuntimeError):
    pass


class ReplayBlocked(RuntimeError):
    pass


@dataclass
class Segment:
    replay_fp: str | None = None
    replay_payload: dict | None = None
    replay_updated_at: float = 0.0
    inflight_fp: str | None = None
    inflight_started_at: float = 0.0
    stale: list[str] = field(default_factory=list)


class Store:
    def __init__(self):
        self.disk: dict[str, Segment] = {}
        self.fail_next = False

    def _commit(self, staged: dict[str, Segment]):
        if self.fail_next:
            self.fail_next = False
            raise PersistenceError("forced")
        self.disk = copy.deepcopy(staged)

    def get(self, key: str):
        return copy.deepcopy(self.disk.get(key))

    def mark_intent(self, key: str, fp: str, now: float = 1.0):
        staged = copy.deepcopy(self.disk)
        seg = staged.setdefault(key, Segment())
        if seg.replay_fp == fp and seg.replay_payload is not None:
            return "replay"
        if seg.inflight_fp is not None:
            raise ReplayBlocked("unresolved provider outcome")
        seg.inflight_fp = fp
        seg.inflight_started_at = now
        self._commit(staged)
        return "intent"

    def finalize(self, key: str, fp: str, payload: dict, now: float = 2.0):
        staged = copy.deepcopy(self.disk)
        seg = staged[key]
        if seg.inflight_fp != fp:
            raise ReplayBlocked("intent mismatch")
        seg.replay_fp = fp
        seg.replay_payload = copy.deepcopy(payload)
        seg.replay_updated_at = now
        seg.inflight_fp = None
        seg.inflight_started_at = 0.0
        self._commit(staged)

    def expire_replay(self, key: str, now: float, ttl: float = 6 * 3600):
        staged = copy.deepcopy(self.disk)
        seg = staged[key]
        if seg.replay_payload is not None and seg.replay_updated_at + ttl < now:
            if seg.replay_fp:
                seg.stale.append(seg.replay_fp)
            seg.replay_payload = None
        # Unresolved provider intent is deliberately not TTL-cleared.
        self._commit(staged)


class Provider:
    def __init__(self):
        self.calls = 0

    def call(self):
        self.calls += 1
        return {"id": f"resp-{self.calls}", "call_id": f"call-{self.calls}"}


# 1. Failed durable intent publication => provider never starts.
s = Store()
p = Provider()
s.fail_next = True
try:
    s.mark_intent("seg", "A")
except PersistenceError:
    pass
else:
    raise AssertionError
assert p.calls == 0 and s.get("seg") is None

# 2. Crash after intent but before provider => exact retry is fail-closed.
s = Store()
p = Provider()
assert s.mark_intent("seg", "A") == "intent"
try:
    s.mark_intent("seg", "A")
except ReplayBlocked:
    pass
else:
    raise AssertionError
assert p.calls == 0

# 3. Provider advanced; crash before final publication => no second provider call.
s = Store()
p = Provider()
s.mark_intent("seg", "A")
first = p.call()
try:
    s.mark_intent("seg", "A")
except ReplayBlocked:
    pass
else:
    raise AssertionError
assert p.calls == 1

# 4. Final publication succeeds; restart/retry returns the exact saved payload.
s = Store()
p = Provider()
s.mark_intent("seg", "A")
first = p.call()
s.finalize("seg", "A", first)
seg = s.get("seg")
assert seg.replay_payload == first and seg.inflight_fp is None
assert s.mark_intent("seg", "A") == "replay"
assert p.calls == 1

# 5. Final publication failure leaves the durable intent and blocks retry.
s = Store()
p = Provider()
s.mark_intent("seg", "A")
first = p.call()
s.fail_next = True
try:
    s.finalize("seg", "A", first)
except PersistenceError:
    pass
else:
    raise AssertionError
seg = s.get("seg")
assert seg.inflight_fp == "A" and seg.replay_payload is None
try:
    s.mark_intent("seg", "A")
except ReplayBlocked:
    pass
else:
    raise AssertionError
assert p.calls == 1

# 6. Different request in the same ambiguous remote segment is also blocked.
try:
    s.mark_intent("seg", "B")
except ReplayBlocked:
    pass
else:
    raise AssertionError
assert p.calls == 1

# 7. A distinct conversation/segment remains independent.
assert s.mark_intent("seg2", "B") == "intent"

# 8. Unresolved intent is not expired by the ordinary exact-response replay TTL.
s = Store()
s.mark_intent("seg", "A", now=1.0)
assert s.get("seg").inflight_fp == "A"
s._commit(copy.deepcopy(s.disk))
assert s.get("seg").inflight_fp == "A"

print("DURABLE_REPLAY_V22_PREPROVIDER_INTENT_TOMBSTONE_HARNESS_PASS")
