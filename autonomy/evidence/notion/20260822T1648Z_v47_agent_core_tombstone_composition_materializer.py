from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

V46_REL = Path("autonomy/evidence/notion/20260822T1605Z_v46_agent_core_composition_materializer.py")
TOMBSTONE_MARKER = '"subagent-uncertain-tasks.json"'


def _load_v46(control_root: Path):
    path = control_root / V46_REL
    spec = importlib.util.spec_from_file_location("notion_core_v46", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("V47_V46_IMPORT_SPEC_FAILED")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("product_root", type=Path)
    parser.add_argument("--control-root", type=Path, default=Path("."))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    product_root = args.product_root.resolve()
    control_root = args.control_root.resolve()
    v46 = _load_v46(control_root)

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
        raise RuntimeError("V47_AGENT_TOMBSTONE_CONTRACT_MISSING")

    account_composed = v46.apply_v41_after_agent(account_after_agent)
    wrapper_composed = v46.apply_v45_wrapper(base_wrapper)
    compile(account_composed, "payload/account_pool.py", "exec")
    compile(server_after_agent, "payload/server.py", "exec")
    compile(wrapper_composed, "payload/reservation_aware_lease.py", "exec")

    print("V47_COMPOSED_ACCOUNT_BLOB=" + v46.git_blob_sha(account_composed))
    print("V47_COMPOSED_SERVER_BLOB=" + v46.git_blob_sha(server_after_agent))
    print("V47_COMPOSED_WRAPPER_BLOB=" + v46.git_blob_sha(wrapper_composed))
    print("V47_TOMBSTONE_MARKER_COUNT=" + str(server_after_agent.count(TOMBSTONE_MARKER)))

    if not args.apply:
        print("V47_AGENT_CORE_TOMBSTONE_COMPOSITION_PREIMAGE_CHECK_PASS")
        return 0

    # --apply is intended only for an isolated disposable checkout. Product branch
    # publication remains a separate guarded operation after the local matrix.
    account_path.write_text(account_composed, encoding="utf-8")
    server_path.write_text(server_after_agent, encoding="utf-8")
    wrapper_path.write_text(wrapper_composed, encoding="utf-8")
    print("V47_AGENT_CORE_TOMBSTONE_COMPOSITION_APPLY_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
