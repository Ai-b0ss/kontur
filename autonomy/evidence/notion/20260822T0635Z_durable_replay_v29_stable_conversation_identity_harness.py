from __future__ import annotations


def codex_conversation_key(body):
    meta = body.get("client_metadata")
    if not isinstance(meta, dict):
        return None
    value = meta.get("thread_id") or meta.get("session_id")
    return value if isinstance(value, str) and value else None


class Store:
    def __init__(self):
        self.intents = {}

    def begin(self, key, fp):
        if key is None:
            return False
        self.intents[key] = fp
        return True


anonymous = {"client_metadata": {"turn_id": "turn-1"}, "input": [{"type": "message"}]}
assert codex_conversation_key(anonymous) is None
store = Store()
assert store.begin(codex_conversation_key(anonymous), "fp") is False
print("V29_NONE_CONVERSATION_KEY_HAS_NO_DURABLE_INTENT_SLOT_REPRODUCED")

synthetic = {
    "client_metadata": {
        "turn_id": "turn-1",
        "thread_id": "conversation-1",
        "prompt_mode": "engineer",
    }
}
assert codex_conversation_key(synthetic) == "conversation-1"
assert store.begin(codex_conversation_key(synthetic), "fp") is True
print("V29_SYNTHETIC_PROBE_HAS_STABLE_THREAD_ID_CONFIRMED")

# The real CLI probe currently checks only resulting JSONL actions and project files;
# it has no request-capture assertion proving thread_id/session_id on actual wire traffic.
real_probe_proves_metadata = False
assert not real_probe_proves_metadata
print("V29_REAL_CODEX_METADATA_EVIDENCE_GAP_CONFIRMED")

provider_calls = 0
if codex_conversation_key(anonymous) is None:
    status = 400
else:
    provider_calls += 1
    status = 200
assert status == 400 and provider_calls == 0
print("DURABLE_REPLAY_V29_STABLE_IDENTITY_FAILCLOSED_MODEL_PASS")
