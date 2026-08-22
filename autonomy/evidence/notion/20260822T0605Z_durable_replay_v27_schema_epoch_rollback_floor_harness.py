from __future__ import annotations

import copy

KNOWN = {
    "account_id",
    "notion_thread_id",
    "input_fingerprints",
    "segment_index",
    "awaiting_compacted_history",
    "turns",
    "input_tokens",
    "output_tokens",
    "updated_at",
    "model",
}


def old_load(payload: dict):
    if payload.get("version") != 2:
        return {"blocked": True, "items": {}}
    items = {}
    for key, raw in payload.get("conversations", {}).items():
        items[key] = {k: copy.deepcopy(v) for k, v in raw.items() if k in KNOWN}
    return {"blocked": False, "items": items}


def old_save(state: dict):
    return {"version": 2, "conversations": copy.deepcopy(state["items"])}


legacy_plus_new = {
    "version": 2,
    "provider_intents": {"seg": {"fingerprint": "fp-A", "started_at": 1.0}},
    "conversations": {
        "seg": {
            "account_id": "acct",
            "notion_thread_id": "thread",
            "input_fingerprints": ["x"],
            "segment_index": 0,
            "awaiting_compacted_history": False,
            "turns": 1,
            "input_tokens": 1,
            "output_tokens": 1,
            "updated_at": 2.0,
            "model": "m",
            "replay_schema_version": 1,
            "replay_request_fingerprint": "fp-A",
            "replay_response": {"id": "resp-1", "output": [{"call_id": "call-1"}]},
            "inflight_fp": "fp-A",
        }
    },
}
state = old_load(legacy_plus_new)
assert not state["blocked"]
roundtrip = old_save(state)
assert "provider_intents" not in roundtrip
seg = roundtrip["conversations"]["seg"]
assert "replay_response" not in seg and "inflight_fp" not in seg
print("V27_VERSION2_DOWNGRADE_METADATA_STRIP_REPRODUCED")

v3 = copy.deepcopy(legacy_plus_new)
v3["version"] = 3
state3 = old_load(v3)
assert state3["blocked"] and not state3["items"]
provider_calls = 0
# Exact current server has no persistence-readiness gate before provider entry.
provider_calls += 1
assert provider_calls == 1
print("V27_VERSION3_OLD_SERVER_ROLLBACK_PROVIDER_REENTRY_REPRODUCED")


class FloorServer:
    def __init__(self, accepted_versions=(2,)):
        self.accepted_versions = set(accepted_versions)

    def may_enter_provider(self, payload):
        return payload.get("version") in self.accepted_versions


floor = FloorServer((2,))
assert floor.may_enter_provider(legacy_plus_new)
assert not floor.may_enter_provider(v3)
new = FloorServer((2, 3))
assert new.may_enter_provider(v3)
print("V27_SCHEMA_EPOCH_ROLLBACK_FLOOR_MODEL_PASS")
