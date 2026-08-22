from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

EXPECTED = {
    "v46": "76fc60af515cc6a9a0212ff6bcf1de957f6631c3",
    "wrapper": "859039a5e408bc84e7046372cdb509131eb37a97",
    "startup": "2ed85ece7d3323b1619ec0963d3021c1623d0e0a",
    "tombstone": "40ab3a448e33fb8a8c3ce045ef31a815d0554823",
}

MARKER = '"subagent-uncertain-tasks.json"'


def git_blob_sha(text: str) -> str:
    raw = text.encode("utf-8")
    return hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()


def read_exact(path: Path, expected: str, label: str) -> str:
    text = path.read_text(encoding="utf-8")
    actual = git_blob_sha(text)
    if actual != expected:
        raise RuntimeError(f"{label}_BLOB_MISMATCH:{actual}")
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--v46", type=Path, required=True)
    ap.add_argument("--wrapper", type=Path, required=True)
    ap.add_argument("--startup", type=Path, required=True)
    ap.add_argument("--tombstone", type=Path, required=True)
    args = ap.parse_args()

    v46 = read_exact(args.v46, EXPECTED["v46"], "V46")
    wrapper = read_exact(args.wrapper, EXPECTED["wrapper"], "WRAPPER")
    startup = read_exact(args.startup, EXPECTED["startup"], "STARTUP")
    tombstone = read_exact(args.tombstone, EXPECTED["tombstone"], "TOMBSTONE")

    assert "from tools.apply_startup_status_cleanup import apply as agent_server_apply" in v46
    assert "server_after_agent = agent_server_apply(base_server)" in v46
    assert "apply_subagent_tombstone_wiring" not in v46
    assert "apply_tombstone_wiring" not in v46

    assert "server_updated = apply_tombstone_wiring(server_updated)" in wrapper
    assert MARKER not in startup
    assert MARKER in tombstone

    # The canonical wrapper cannot simply be run after V46 either: it calls the
    # same exact-source Agent transform again, while that transform requires the
    # frozen old server blob. V46 has already transformed those bytes once.
    assert "base_wiring.materialize(" in wrapper
    assert "EXPECTED_SERVER_BLOB" in startup
    assert "STARTUP_STATUS_SOURCE_BLOB_MISMATCH" in startup

    print("NOTION_V46_TOMBSTONE_COMPOSITION_GAP_REPRODUCED")
    print("v46_uses_agent_server_transform=1")
    print("v46_applies_tombstone_transform=0")
    print("canonical_agent_wrapper_applies_tombstone_transform=1")
    print("canonical_wrapper_after_v46_exact_reapply_possible=0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
