from __future__ import annotations

from dataclasses import asdict, dataclass
import copy


class PersistenceError(RuntimeError):
    pass


class AmbiguousProviderOutcome(RuntimeError):
    pass


class IntentCapacityExceeded(RuntimeError):
    pass


MAX_UNRESOLVED = 128


@dataclass
class Intent:
    request_fingerprint: str
    request_kind: str
    created_at: float


@dataclass
class Segment:
    account_id: str
    notion_thread_id: str
    replay_fingerprint: str
    replay_payload: dict
    updated_at: float


class Store:
    def __init__(self):
        self.disk = {"version": 3, "conversations": {}, "provider_intents": {}}
        self.fail_next = False

    def _commit(self, staged):
        if self.fail_next:
            self.fail_next = False
            raise PersistenceError("forced")
        self.disk = copy.deepcopy(staged)

    def begin_provider(self, key, fp, kind, now=1.0):
        current = self.disk
        seg = current["conversations"].get(key)
        if seg and seg["replay_fingerprint"] == fp:
            return "replay", copy.deepcopy(seg["replay_payload"])
        if current["provider_intents"].get(key) is not None:
            raise AmbiguousProviderOutcome("unresolved provider outcome")
        if len(current["provider_intents"]) >= MAX_UNRESOLVED:
            raise IntentCapacityExceeded
        staged = copy.deepcopy(current)
        staged["provider_intents"][key] = asdict(Intent(fp, kind, now))
        self._commit(staged)
        return "intent", None

    def finalize(self, key, fp, *, account, thread, payload, now=2.0):
        current = self.disk
        intent = current["provider_intents"].get(key)
        if not intent or intent["request_fingerprint"] != fp:
            raise AmbiguousProviderOutcome("intent mismatch")
        staged = copy.deepcopy(current)
        staged["conversations"][key] = asdict(
            Segment(account, thread, fp, copy.deepcopy(payload), now)
        )
        del staged["provider_intents"][key]
        self._commit(staged)

    def cleanup_conversations(self, cutoff):
        staged = copy.deepcopy(self.disk)
        staged["conversations"] = {
            key: value
            for key, value in staged["conversations"].items()
            if value["updated_at"] >= cutoff
        }
        self._commit(staged)


s = Store()
assert not s.disk["conversations"]
assert s.begin_provider("conv-A", "fp-A", "turn")[0] == "intent"
assert "conv-A" not in s.disk["conversations"]
print("V28_FIRST_REQUEST_INTENT_WITHOUT_FAKE_SEGMENT_PASS")

try:
    s.begin_provider("conv-A", "fp-A", "turn")
except AmbiguousProviderOutcome:
    pass
else:
    raise AssertionError

payload = {"id": "resp-1", "output": [{"type": "function_call", "call_id": "call-1"}]}
s.finalize("conv-A", "fp-A", account="acct-1", thread="thread-1", payload=payload)
assert "conv-A" not in s.disk["provider_intents"]
assert s.disk["conversations"]["conv-A"]["notion_thread_id"] == "thread-1"
assert s.begin_provider("conv-A", "fp-A", "turn") == ("replay", payload)
print("V28_FINALIZE_ATOMIC_SEGMENT_PLUS_REPLAY_PASS")

s = Store()
s.begin_provider("conv-B", "fp-B", "compaction")
s.fail_next = True
try:
    s.finalize("conv-B", "fp-B", account="acct-2", thread="thread-2", payload={"compact": True})
except PersistenceError:
    pass
else:
    raise AssertionError
assert "conv-B" in s.disk["provider_intents"] and "conv-B" not in s.disk["conversations"]
print("V28_FINAL_WRITE_FAILURE_PRESERVES_INTENT_PASS")

s.cleanup_conversations(cutoff=10**9)
assert "conv-B" in s.disk["provider_intents"]
print("V28_INTENT_LEDGER_SURVIVES_CONVERSATION_CLEANUP_PASS")

s = Store()
for i in range(MAX_UNRESOLVED):
    s.begin_provider(f"c{i}", f"f{i}", "turn")
try:
    s.begin_provider("overflow", "fx", "turn")
except IntentCapacityExceeded:
    pass
else:
    raise AssertionError
try:
    s.begin_provider("c0", "f0", "turn")
except AmbiguousProviderOutcome:
    pass
else:
    raise AssertionError
assert len(s.disk["provider_intents"]) == MAX_UNRESOLVED
print("V28_SEPARATE_INTENT_CAPACITY_PASS")
print("DURABLE_REPLAY_V28_SEPARATE_INTENT_LEDGER_MODEL_PASS")
