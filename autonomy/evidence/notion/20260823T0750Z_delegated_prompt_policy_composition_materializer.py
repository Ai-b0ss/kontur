from __future__ import annotations

import argparse
import hashlib
import os
import tempfile
from pathlib import Path

SOURCE_BLOBS = {
    Path("payload/delegation_policy.py"): "cc50fc7373578262e6051e76716563a98f8f4935",
    Path("payload/delegation_dispatcher.py"): "e888c87262d4307a0c5a7de9e315e01601f20a33",
    Path("payload/notion_delegated_model_step.py"): "7d38b09be4c80d6ae531cd2282385e36dd5a57df",
}

CANDIDATE_ROOT = Path(
    "autonomy/evidence/notion/20260823T0740Z_delegated_prompt_candidate"
)
CANDIDATE_BLOBS = {
    Path("payload/delegation_policy.py"): "fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e",
    Path("payload/delegation_dispatcher.py"): "a9d15b79b421cd29b094b549be06d2b0319e26d9",
    Path("payload/notion_delegated_model_step.py"): "f36e9c91355dec667173b6265dd550554fb0f05d",
}


def git_blob_sha(raw: bytes) -> str:
    return hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()


def require_blob(path: Path, expected: str, label: str) -> bytes:
    raw = path.read_bytes()
    actual = git_blob_sha(raw)
    if actual != expected:
        raise RuntimeError(f"{label}_BLOB_MISMATCH:{actual}")
    return raw


def _candidate_path(control_root: Path, product_rel: Path) -> Path:
    return control_root / CANDIDATE_ROOT / product_rel.name


def _atomic_replace(path: Path, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".tmp-", dir=str(path.parent))
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("product_root", type=Path)
    parser.add_argument("--control-root", type=Path, default=Path("."))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    product_root = args.product_root.resolve()
    control_root = args.control_root.resolve()

    candidate_bytes: dict[Path, bytes] = {}
    for rel, expected_source in SOURCE_BLOBS.items():
        require_blob(
            product_root / rel,
            expected_source,
            "DELEGATED_PROMPT_SOURCE_" + rel.name.upper().replace(".", "_"),
        )
        candidate = require_blob(
            _candidate_path(control_root, rel),
            CANDIDATE_BLOBS[rel],
            "DELEGATED_PROMPT_CANDIDATE_" + rel.name.upper().replace(".", "_"),
        )
        compile(candidate.decode("utf-8"), rel.as_posix(), "exec")
        candidate_bytes[rel] = candidate

    if not args.apply:
        print("DELEGATED_PROMPT_POLICY_COMPOSITION_CHECK_PASS")
        return 0

    # Disposable composition only: all source/candidate bytes are verified before
    # the first replacement. Product refs are moved only by a separate owner gate.
    for rel in SOURCE_BLOBS:
        _atomic_replace(product_root / rel, candidate_bytes[rel])

    for rel, expected in CANDIDATE_BLOBS.items():
        require_blob(
            product_root / rel,
            expected,
            "DELEGATED_PROMPT_READBACK_" + rel.name.upper().replace(".", "_"),
        )

    print("DELEGATED_PROMPT_POLICY_COMPOSITION_APPLY_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
