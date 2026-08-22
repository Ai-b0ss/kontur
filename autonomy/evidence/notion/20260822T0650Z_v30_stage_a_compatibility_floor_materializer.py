from __future__ import annotations

import argparse
import hashlib
import os
import tempfile
from pathlib import Path

EXPECTED = {
    "payload/conversation_segments.py": "553bd3496c21a7949c3a5dfa03f33b9e09293213",
    "payload/server.py": "f02cef6a0ffc202c75fbe71c520c72ac19ff876d",
}


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise RuntimeError(f"{label}: expected exactly one preimage anchor, got {text.count(old)}")
    return text.replace(old, new, 1)


def transform_segments(text: str) -> str:
    old = '''    async def get(self, key: str | None) -> ConversationSegment | None:\n        if key is None:\n            return None\n        async with self._guard:\n            self._load_locked()\n            changed = self._cleanup_locked()\n            if changed:\n                self._save_locked()\n            return self._items.get(conversation_storage_key(key))\n\n    async def put(\n'''
    new = '''    async def get(self, key: str | None) -> ConversationSegment | None:\n        if key is None:\n            return None\n        async with self._guard:\n            self._load_locked()\n            changed = self._cleanup_locked()\n            if changed:\n                self._save_locked()\n            return self._items.get(conversation_storage_key(key))\n\n    async def require_persistence_ready(self) -> None:\n        \"\"\"Fail closed when configured durable state cannot be trusted/written.\"\"\"\n        async with self._guard:\n            self._load_locked()\n            if self.path is not None and self._persistence_blocked:\n                raise RuntimeError(\"durable conversation state is unavailable\")\n\n    async def put(\n'''
    return replace_once(text, old, new, "conversation_segments")


def transform_server(text: str) -> str:
    old = '''    affinity = await turn_affinities.get(turn_key)\n    segment = await conversation_segments.get(conversation_key)\n    affinity_matches_model = affinity is not None and affinity.model == model\n'''
    new = '''    affinity = await turn_affinities.get(turn_key)\n    segment = await conversation_segments.get(conversation_key)\n    # Stage-A compatibility floor for the later durable-replay schema epoch.\n    # get() can itself discover an unsupported/corrupt state or a cleanup write\n    # failure, so the gate is intentionally after get() and before provider entry.\n    if isinstance(conversation_segments, ConversationSegmentStore):\n        try:\n            await conversation_segments.require_persistence_ready()\n        except RuntimeError:\n            return JSONResponse(\n                {\n                    \"error\": {\n                        \"message\": \"Durable conversation state is unavailable\",\n                        \"type\": \"durable_state_unavailable\",\n                    }\n                },\n                status_code=503,\n            )\n    affinity_matches_model = affinity is not None and affinity.model == model\n'''
    return replace_once(text, old, new, "server")


def atomic_write(path: Path, data: bytes) -> None:
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".v30-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_name, path)
    except BaseException:
        try:
            os.unlink(tmp_name)
        except FileNotFoundError:
            pass
        raise


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", type=Path)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    root = args.root.resolve()
    transforms = {
        "payload/conversation_segments.py": transform_segments,
        "payload/server.py": transform_server,
    }
    rendered: dict[Path, bytes] = {}
    for rel, expected in EXPECTED.items():
        path = root / rel
        raw = path.read_bytes()
        actual = git_blob_sha(raw)
        if actual != expected:
            raise RuntimeError(f"{rel}: preimage blob mismatch {actual} != {expected}")
        text = raw.decode("utf-8")
        out = transforms[rel](text).encode("utf-8")
        compile(out.decode("utf-8"), rel, "exec")
        rendered[path] = out
    if not args.apply:
        print("V30_STAGE_A_EXACT_PREIMAGE_CHECK_PASS")
        return 0
    for path, out in rendered.items():
        atomic_write(path, out)
    print("V30_STAGE_A_EXACT_PREIMAGE_APPLY_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
