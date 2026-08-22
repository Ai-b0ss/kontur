from __future__ import annotations

import argparse
import hashlib
import importlib.util
import sys
from pathlib import Path

V46_REL = Path("autonomy/evidence/notion/20260822T1605Z_v46_agent_core_composition_materializer.py")
TOMBSTONE_MARKER = '"subagent-uncertain-tasks.json"'

EXPECTED_AGENT_TOOL_BLOBS = {
    Path("tools/materialize_agent_wiring_with_tombstones.py"): "859039a5e408bc84e7046372cdb509131eb37a97",
    Path("tools/materialize_agent_wiring.py"): "30fb89286eb4457b25b2145918279fec2d735042",
    Path("tools/apply_account_pool_dynamic_reservation.py"): "80aeb1872c1cab7f51c33039584b5786e441f9f0",
    Path("tools/apply_startup_status_cleanup.py"): "2ed85ece7d3323b1619ec0963d3021c1623d0e0a",
    Path("tools/apply_subagent_tombstone_wiring.py"): "40ab3a448e33fb8a8c3ce045ef31a815d0554823",
}


def git_blob_sha_bytes(raw: bytes) -> str:
    return hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()


def _load_v46(control_root: Path):
    path = control_root / V46_REL
    spec = importlib.util.spec_from_file_location("notion_core_v46", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("V48_V46_IMPORT_SPEC_FAILED")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _verify_agent_toolchain(product_root: Path) -> None:
    for rel, expected_blob in EXPECTED_AGENT_TOOL_BLOBS.items():
        path = product_root / rel
        raw = path.read_bytes()
        actual_blob = git_blob_sha_bytes(raw)
        if actual_blob != expected_blob:
            raise RuntimeError(
                f"V48_AGENT_TOOL_BLOB_MISMATCH:{rel.as_posix()}:{actual_blob}"
            )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("product_root", type=Path)
    parser.add_argument("--control-root", type=Path, default=Path("."))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    product_root = args.product_root.resolve()
    control_root = args.control_root.resolve()
    v46 = _load_v46(control_root)

    # V47 verified only product preimages while importing the Agent materializer
    # dynamically. That made the exact composition proof depend on whichever
    # helper bytes happened to be present in the checkout. Freeze the full
    # transformation toolchain before importing it.
    _verify_agent_toolchain(product_root)

    account_path = product_root / "payload/account_pool.py"
    server_path = product_root / "payload/server.py"
    wrapper_path = product_root / "payload/reservation_aware_lease.py"

    base_account = account_path.read_text(encoding="utf-8")
    base_server = server_path.read_text(encoding="utf-8")
    base_wrapper = wrapper_path.read_text(encoding="utf-8")

    expected = {
        account_path: v46.BASE_ACCOUNT_POOL_BLOB,
        server_path: v46.BASE_SERVER_BLOB,
        wrapper_path: v46.BASE_RESERVATION_LEASE_BLOB,
    }
    for path, text in (
        (account_path, base_account),
        (server_path, base_server),
        (wrapper_path, base_wrapper),
    ):
        actual = v46.git_blob_sha(text)
        if actual != expected[path]:
            raise RuntimeError(f"{path.name}_SOURCE_BLOB_MISMATCH:{actual}")

    sys.path.insert(0, str(product_root))
    from tools import materialize_agent_wiring_with_tombstones as agent_pair

    account_after_agent, server_after_agent = agent_pair.materialize(
        base_account,
        base_server,
    )
    if server_after_agent.count(TOMBSTONE_MARKER) != 1:
        raise RuntimeError("V48_AGENT_TOMBSTONE_CONTRACT_MISSING")

    account_composed = v46.apply_v41_after_agent(account_after_agent)
    wrapper_composed = v46.apply_v45_wrapper(base_wrapper)
    compile(account_composed, "payload/account_pool.py", "exec")
    compile(server_after_agent, "payload/server.py", "exec")
    compile(wrapper_composed, "payload/reservation_aware_lease.py", "exec")

    print("V48_COMPOSED_ACCOUNT_BLOB=" + v46.git_blob_sha(account_composed))
    print("V48_COMPOSED_SERVER_BLOB=" + v46.git_blob_sha(server_after_agent))
    print("V48_COMPOSED_WRAPPER_BLOB=" + v46.git_blob_sha(wrapper_composed))
    print("V48_TOMBSTONE_MARKER_COUNT=" + str(server_after_agent.count(TOMBSTONE_MARKER)))
    print("V48_AGENT_TOOLCHAIN_FROZEN=1")

    if not args.apply:
        print("V48_FROZEN_AGENT_CORE_COMPOSITION_PREIMAGE_CHECK_PASS")
        return 0

    # --apply remains disposable-checkout only. Publication to product branches is
    # a separate guarded operation after the composed local regression matrix.
    account_path.write_text(account_composed, encoding="utf-8")
    server_path.write_text(server_after_agent, encoding="utf-8")
    wrapper_path.write_text(wrapper_composed, encoding="utf-8")
    print("V48_FROZEN_AGENT_CORE_COMPOSITION_APPLY_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
