from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
from pathlib import Path

AGENT_HEAD = "ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9"
V48_REL = Path("autonomy/evidence/notion/20260822T1840Z_v48_frozen_agent_toolchain_composition_materializer.py")
SHELL_PATCH_REL = Path("autonomy/evidence/notion/20260821T1510Z_codex_shell_env_exact_candidate.patch")

EXPECTED_BLOBS = {
    Path("payload/server.py"): "f02cef6a0ffc202c75fbe71c520c72ac19ff876d",
    Path("payload/account_pool.py"): "11cea792a2f5aaa40ee1515faddfd44e76cbb23f",
    Path("payload/reservation_aware_lease.py"): "c77b4d5214911def1729243516aec73e43f8d425",
    Path("payload/conversation_segments.py"): "553bd3496c21a7949c3a5dfa03f33b9e09293213",
    Path("payload/subagent_tombstone_store.py"): "c2a3f8e74a94b15325423bfdb8f3437141233996",
    Path("tests/test_subagent_tombstone_post_replace_sync_failure.py"): "0dc3e95cb987da326b63712c981138e8f1c976e1",
    Path("tests/test_delegated_cancellation_lifecycle.py"): "142ec6c64366c195aca8c8d8d615bd17062a6592",
    Path("tests/test_subagent_tombstone_store.py"): "7c383e234cfa8828db753caa89145f11546d0d2f",
    Path("tests/test_server_subagent_tombstone_restart.py"): "aba8b3dd4dc181d1f78cb6fdfd3b85fc7ce1c7ee",
    Path("tools/run_real_codex_cli_project_probe.py"): "2f6d5873606975771b5ab418d5f9d45cd602304c",
    Path("tests/test_real_codex_cli_probe_contract.py"): "2958fac16ecf6ded815c6dfc12aa1060319a62e8",
}
EXPECTED_SHELL_PATCH_BLOB = "5ae2079725886a180e130cfbb729365be56d8b59"


def git_blob_sha(raw: bytes) -> str:
    return hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()


def require_blob(path: Path, expected: str, label: str) -> None:
    raw = path.read_bytes()
    actual = git_blob_sha(raw)
    if actual != expected:
        raise RuntimeError(f"{label}_BLOB_MISMATCH:{actual}")


def run_checked(argv: list[str], *, cwd: Path) -> None:
    proc = subprocess.run(argv, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if proc.stdout:
        print(proc.stdout, end="")
    if proc.returncode != 0:
        raise RuntimeError(f"COMMAND_FAILED:{proc.returncode}:{argv[0]}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("product_root", type=Path)
    parser.add_argument("--control-root", type=Path, default=Path("."))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    product_root = args.product_root.resolve()
    control_root = args.control_root.resolve()
    v48 = (control_root / V48_REL).resolve()
    shell_patch = (control_root / SHELL_PATCH_REL).resolve()

    head = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=product_root, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    if head.returncode != 0:
        raise RuntimeError("V50_EXACT_CHECKOUT_REQUIRED")
    actual_head = head.stdout.strip()
    if actual_head != AGENT_HEAD:
        raise RuntimeError(f"V50_AGENT_HEAD_MISMATCH:{actual_head}")

    for rel, expected in EXPECTED_BLOBS.items():
        require_blob(product_root / rel, expected, "V50_" + rel.as_posix().replace("/", "_").upper())
    require_blob(shell_patch, EXPECTED_SHELL_PATCH_BLOB, "V50_SHELL_PATCH")

    # V48 independently freezes the current five Agent transformation helpers and
    # the server/account/reservation preimages, then composes Agent wiring + V41/V45.
    v48_cmd = [sys.executable, str(v48), str(product_root), "--control-root", str(control_root)]
    if args.apply:
        v48_cmd.append("--apply")
    run_checked(v48_cmd, cwd=control_root)

    # The live Codex probe must not expose bridge/runtime secrets to agent shell tools.
    run_checked(["git", "apply", "--check", str(shell_patch)], cwd=product_root)
    if args.apply:
        run_checked(["git", "apply", str(shell_patch)], cwd=product_root)
        for rel in (
            Path("payload/server.py"),
            Path("payload/account_pool.py"),
            Path("payload/reservation_aware_lease.py"),
            Path("tools/run_real_codex_cli_project_probe.py"),
            Path("tests/test_real_codex_cli_probe_contract.py"),
        ):
            compile((product_root / rel).read_text(encoding="utf-8"), rel.as_posix(), "exec")

        for rel in (
            Path("payload/server.py"),
            Path("payload/account_pool.py"),
            Path("payload/reservation_aware_lease.py"),
            Path("tools/run_real_codex_cli_project_probe.py"),
            Path("tests/test_real_codex_cli_probe_contract.py"),
        ):
            print(f"V50_READBACK_{rel.name.upper().replace('.', '_')}_BLOB=" + git_blob_sha((product_root / rel).read_bytes()))
        print("V50_FIXED_AGENT_CORE_COMPOSITION_APPLY_PASS")
    else:
        print("V50_FIXED_AGENT_CORE_COMPOSITION_CHECK_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
