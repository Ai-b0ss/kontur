from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

EXPECTED_BLOB = "553bd3496c21a7949c3a5dfa03f33b9e09293213"


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, got {count}")
    return text.replace(old, new, 1)


def transform(text: str) -> str:
    text = replace_once(text, "import asyncio\nimport hashlib", "import asyncio\nimport copy\nimport hashlib", "copy import")
    text = replace_once(
        text,
        "STATE_VERSION = 2",
        "STATE_VERSION = 3\nLEGACY_STATE_VERSION = 2\nREPLAY_TTL = 6 * 60 * 60\nMAX_REPLAY_BYTES = 512 * 1024\nMAX_TOTAL_REPLAY_BYTES = 8 * 1024 * 1024\nMAX_COMPLETED_REQUEST_FINGERPRINTS = 32\nMAX_UNRESOLVED_PROVIDER_INTENTS = 128",
        "state constants",
    )
    text = replace_once(
        text,
        '''@dataclass(slots=True)\nclass ConversationSegment:\n    account_id: str\n    notion_thread_id: str\n    input_fingerprints: tuple[str, ...]\n    segment_index: int\n    awaiting_compacted_history: bool\n    turns: int\n    input_tokens: int\n    output_tokens: int\n    updated_at: float\n    model: str | None = None\n\n\nclass ConversationSegmentStore:''',
        '''@dataclass(slots=True)\nclass ConversationSegment:\n    account_id: str\n    notion_thread_id: str\n    input_fingerprints: tuple[str, ...]\n    segment_index: int\n    awaiting_compacted_history: bool\n    turns: int\n    input_tokens: int\n    output_tokens: int\n    updated_at: float\n    model: str | None = None\n    segment_context_fingerprint: str | None = None\n    replay_request_fingerprint: str | None = None\n    replay_payload: dict[str, Any] | None = None\n    replay_updated_at: float | None = None\n    replay_unavailable: bool = False\n    completed_request_fingerprints: tuple[str, ...] = ()\n\n\n@dataclass(slots=True)\nclass ProviderIntent:\n    request_fingerprint: str\n    request_kind: str\n    created_at: float\n\n\nclass ConversationSegmentStore:''',
        "dataclasses",
    )
    text = replace_once(text, "        self._items: dict[str, ConversationSegment] = {}\n        self._locks", "        self._items: dict[str, ConversationSegment] = {}\n        self._provider_intents: dict[str, ProviderIntent] = {}\n        self._locks", "intent storage")
    text = replace_once(
        text,
        "            return self._items.get(conversation_storage_key(key))\n\n    async def put(",
        '''            item = self._items.get(conversation_storage_key(key))\n            return copy.deepcopy(item) if item is not None else None\n\n    async def require_persistence_ready(self) -> None:\n        async with self._guard:\n            self._load_locked()\n            if self.path is not None and self._persistence_blocked:\n                raise RuntimeError("durable conversation state is unavailable")\n\n    async def get_provider_intent(self, key: str | None) -> ProviderIntent | None:\n        if key is None:\n            return None\n        async with self._guard:\n            self._load_locked()\n            item = self._provider_intents.get(conversation_storage_key(key))\n            return copy.deepcopy(item) if item is not None else None\n\n    async def begin_provider_intent(self, key: str | None, *, request_fingerprint: str, request_kind: str) -> None:\n        if not key:\n            raise RuntimeError("stable conversation identity is required")\n        async with self._guard:\n            self._load_locked()\n            self._require_write_ready_locked()\n            storage_key = conversation_storage_key(key)\n            existing = self._provider_intents.get(storage_key)\n            if existing is not None:\n                if existing.request_fingerprint == request_fingerprint:\n                    raise RuntimeError("provider outcome is unresolved")\n                raise RuntimeError("conversation has unresolved provider intent")\n            if len(self._provider_intents) >= MAX_UNRESOLVED_PROVIDER_INTENTS:\n                raise RuntimeError("unresolved provider intent capacity exhausted")\n            previous_items = copy.deepcopy(self._items)\n            previous_intents = copy.deepcopy(self._provider_intents)\n            self._provider_intents[storage_key] = ProviderIntent(request_fingerprint=request_fingerprint, request_kind=request_kind, created_at=time.time())\n            try:\n                self._save_locked(strict=True)\n            except Exception:\n                self._items = previous_items\n                self._provider_intents = previous_intents\n                raise\n\n    async def finalize_provider_result(\n        self, key: str | None, *, request_fingerprint: str, request_kind: str, replay_payload: dict[str, Any] | None,\n        account_id: str, notion_thread_id: str, input_fingerprints: tuple[str, ...], segment_index: int,\n        awaiting_compacted_history: bool, turns: int, input_tokens: int, output_tokens: int, model: str,\n        segment_context_fingerprint: str | None = None,\n    ) -> None:\n        if not key:\n            raise RuntimeError("stable conversation identity is required")\n        async with self._guard:\n            self._load_locked()\n            self._require_write_ready_locked()\n            storage_key = conversation_storage_key(key)\n            intent = self._provider_intents.get(storage_key)\n            if intent is None or intent.request_fingerprint != request_fingerprint or intent.request_kind != request_kind:\n                raise RuntimeError("matching provider intent is required")\n            payload_copy = copy.deepcopy(replay_payload) if replay_payload is not None else None\n            payload_size = len(json.dumps(payload_copy, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf8")) if payload_copy is not None else 0\n            replay_unavailable = payload_size > MAX_REPLAY_BYTES\n            if replay_unavailable:\n                payload_copy = None\n            prior = self._items.get(storage_key)\n            completed = list(prior.completed_request_fingerprints if prior else ())\n            if prior and prior.replay_request_fingerprint and prior.replay_request_fingerprint != request_fingerprint:\n                completed.append(prior.replay_request_fingerprint)\n            completed = completed[-MAX_COMPLETED_REQUEST_FINGERPRINTS:]\n            previous_items = copy.deepcopy(self._items)\n            previous_intents = copy.deepcopy(self._provider_intents)\n            now = time.time()\n            self._items[storage_key] = ConversationSegment(\n                account_id=account_id, notion_thread_id=notion_thread_id, input_fingerprints=input_fingerprints,\n                segment_index=segment_index, awaiting_compacted_history=awaiting_compacted_history, turns=turns,\n                input_tokens=input_tokens, output_tokens=output_tokens, updated_at=now, model=model,\n                segment_context_fingerprint=segment_context_fingerprint, replay_request_fingerprint=request_fingerprint,\n                replay_payload=payload_copy, replay_updated_at=now, replay_unavailable=replay_unavailable,\n                completed_request_fingerprints=tuple(completed),\n            )\n            self._provider_intents.pop(storage_key, None)\n            self._cleanup_locked()\n            self._enforce_replay_budget_locked()\n            try:\n                self._save_locked(strict=True)\n            except Exception:\n                self._items = previous_items\n                self._provider_intents = previous_intents\n                raise\n\n    async def put(''',
        "store API",
    )
    text = replace_once(text, '            if payload.get("version") != STATE_VERSION:\n                self._persistence_blocked = True\n                self._items = {}\n                return', '            version = payload.get("version")\n            if version not in {LEGACY_STATE_VERSION, STATE_VERSION}:\n                self._persistence_blocked = True\n                self._items = {}\n                self._provider_intents = {}\n                return', "version load")
    text = replace_once(
        text,
        '''                    model=(str(raw["model"]) if raw.get("model") else None),\n                )\n        except''',
        '''                    model=(str(raw["model"]) if raw.get("model") else None),\n                    segment_context_fingerprint=(str(raw["segment_context_fingerprint"]) if raw.get("segment_context_fingerprint") else None),\n                    replay_request_fingerprint=(str(raw["replay_request_fingerprint"]) if raw.get("replay_request_fingerprint") else None),\n                    replay_payload=(copy.deepcopy(raw.get("replay_payload")) if isinstance(raw.get("replay_payload"), dict) else None),\n                    replay_updated_at=(float(raw["replay_updated_at"]) if raw.get("replay_updated_at") is not None else None),\n                    replay_unavailable=bool(raw.get("replay_unavailable", False)),\n                    completed_request_fingerprints=tuple(str(x) for x in raw.get("completed_request_fingerprints", []) if isinstance(x, str)),\n                )\n            if version == STATE_VERSION:\n                for key, raw in payload.get("provider_intents", {}).items():\n                    if not isinstance(key, str) or not isinstance(raw, dict):\n                        continue\n                    self._provider_intents[key] = ProviderIntent(\n                        request_fingerprint=str(raw["request_fingerprint"]), request_kind=str(raw["request_kind"]),\n                        created_at=float(raw.get("created_at", 0)),\n                    )\n        except''',
        "v3 load fields",
    )
    text = replace_once(text, '                "active": len(self._items),\n                "ttl_seconds"', '                "active": len(self._items),\n                "unresolved_provider_intents": len(self._provider_intents),\n                "ttl_seconds"', "status")
    old_save = '''    def _save_locked(self) -> None:\n        if self.path is None or self._persistence_blocked:\n            return\n        payload = {\n            "version": STATE_VERSION,\n            "conversations": {\n                key: {**asdict(item), "input_fingerprints": list(item.input_fingerprints)}\n                for key, item in self._items.items()\n            },\n        }'''
    new_save = '''    def _require_write_ready_locked(self) -> None:\n        if self.path is not None and self._persistence_blocked:\n            raise RuntimeError("durable conversation state is unavailable")\n\n    def _enforce_replay_budget_locked(self) -> None:\n        now = time.time()\n        total = 0\n        candidates: list[tuple[str, float, int]] = []\n        for key, item in self._items.items():\n            if item.replay_payload is None:\n                continue\n            if item.replay_updated_at is None or now - item.replay_updated_at > REPLAY_TTL:\n                item.replay_payload = None\n                item.replay_unavailable = True\n                continue\n            size = len(json.dumps(item.replay_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf8"))\n            total += size\n            candidates.append((key, item.replay_updated_at, size))\n        if total <= MAX_TOTAL_REPLAY_BYTES:\n            return\n        for key, _, size in sorted(candidates, key=lambda row: row[1]):\n            item = self._items[key]\n            item.replay_payload = None\n            item.replay_unavailable = True\n            total -= size\n            if total <= MAX_TOTAL_REPLAY_BYTES:\n                break\n\n    def _save_locked(self, *, strict: bool = False) -> None:\n        if self.path is None:\n            return\n        if self._persistence_blocked:\n            if strict:\n                raise RuntimeError("durable conversation state is unavailable")\n            return\n        payload = {\n            "version": STATE_VERSION,\n            "conversations": {\n                key: {**asdict(item), "input_fingerprints": list(item.input_fingerprints), "completed_request_fingerprints": list(item.completed_request_fingerprints)}\n                for key, item in self._items.items()\n            },\n            "provider_intents": {key: asdict(item) for key, item in self._provider_intents.items()},\n        }'''
    text = replace_once(text, old_save, new_save, "save shape")
    text = replace_once(text, '''        except (FilesystemOwnershipError, OSError):\n            # Preserve a concurrent/foreign file and continue with in-memory state.\n            self._persistence_blocked = True\n''', '''        except (FilesystemOwnershipError, OSError) as exc:\n            # Preserve a concurrent/foreign file. Strict callers must observe failure.\n            self._persistence_blocked = True\n            if strict:\n                raise RuntimeError("durable conversation state write failed") from exc\n''', "strict save error")
    compile(text, "payload/conversation_segments.py", "exec")
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", type=Path)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    path = args.root / "payload/conversation_segments.py"
    raw = path.read_bytes()
    actual = git_blob_sha(raw)
    if actual != EXPECTED_BLOB:
        raise RuntimeError(f"preimage blob mismatch {actual} != {EXPECTED_BLOB}")
    rendered = transform(raw.decode("utf-8")).encode("utf-8")
    if not args.apply:
        print("V34_STAGE_B_STORE_EXACT_PREIMAGE_CHECK_PASS")
        return 0
    path.write_bytes(rendered)
    print("V34_STAGE_B_STORE_EXACT_PREIMAGE_APPLY_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
