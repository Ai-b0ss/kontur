from dataclasses import dataclass
import copy


class PersistenceError(RuntimeError):
    pass


class ReplayBlocked(RuntimeError):
    pass


@dataclass
class Segment:
    replay_fp: str | None = None
    replay_payload: dict | None = None
    inflight_fp: str | None = None


class Store:
    def __init__(self):
        self.disk = {}

    def get(self, key):
        return copy.deepcopy(self.disk.get(key))

    def mark_intent(self, key, fp):
        staged = copy.deepcopy(self.disk)
        seg = staged.setdefault(key, Segment())
        if seg.replay_fp == fp and seg.replay_payload is not None:
            return "replay"
        if seg.inflight_fp is not None:
            raise ReplayBlocked("unresolved provider outcome")
        seg.inflight_fp = fp
        self.disk = staged
        return "intent"

    def finalize(self, key, fp, payload):
        staged = copy.deepcopy(self.disk)
        seg = staged[key]
        if seg.inflight_fp != fp:
            raise ReplayBlocked("intent mismatch")
        seg.replay_fp = fp
        seg.replay_payload = copy.deepcopy(payload)
        seg.inflight_fp = None
        self.disk = staged


class Provider:
    def __init__(self):
        self.calls = 0

    def compact(self):
        self.calls += 1
        return {"output": [{"type": "compaction", "summary": f"summary-{self.calls}"}]}


# V16 alone: provider can advance before exact compact replay is durable.
store = Store()
provider = Provider()
fp = "compact-A"
first = provider.compact()  # crash before V16 final durable replay publication
assert store.get("seg") is None
second = provider.compact()
assert provider.calls == 2 and first != second
print("V16_COMPACTION_PREPUBLICATION_CRASH_REPRODUCED")

# V26: V22 intent boundary must cover compaction too.
store = Store()
provider = Provider()
assert store.mark_intent("seg", fp) == "intent"
first = provider.compact()  # crash before finalize
try:
    store.mark_intent("seg", fp)
except ReplayBlocked:
    pass
else:
    raise AssertionError("retry must not re-enter provider")
assert provider.calls == 1
print("V26_COMPACTION_PREPROVIDER_INTENT_PASS")

# Successful compaction clears intent and exact retry reuses the durable payload.
store = Store()
provider = Provider()
assert store.mark_intent("seg", fp) == "intent"
first = provider.compact()
store.finalize("seg", fp, first)
assert store.mark_intent("seg", fp) == "replay"
assert store.get("seg").replay_payload == first and provider.calls == 1
print("V26_COMPACTION_EXACT_REPLAY_PASS")
