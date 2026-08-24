#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import run_notion_agent_exact_matrix as base


SCHEMA = "notion_agent_exact_matrix_execution_v3"
AGENT_HEAD = "12e3c4fe5ccec421281ad856547143f654897cd5"

# These tests intentionally validate the frozen source/materializer boundary itself.
# They must run on a clean exact PR#8 checkout before pair materialization. Running
# them after materialization creates false REDs because several assert the frozen
# source blob and then apply the transform exactly once.
PRECOMPOSE_MODULES = (
    "tests.test_materialize_agent_wiring",
    "tests.test_materialize_agent_wiring_crash_recovery",
    "tests.test_materialize_agent_wiring_with_tombstones",
    "tests.test_materialize_agent_wiring_derived_journal_creation",
    "tests.test_materialize_agent_wiring_target_path_safety",
    "tests.test_materialize_agent_wiring_late_alias_substitution",
    "tests.test_account_pool_dynamic_reservation_materializer",
    "tests.test_startup_status_cleanup",
    "tests.test_startup_cleanup_failure_boundary_candidate",
    "tests.test_startup_status_repeated_cancellation",
    "tests.test_server_subagent_wiring_materializer",
    "tests.test_materialize_agent_wiring_backup_snapshot",
    "tests.test_materialize_agent_wiring_durability_order",
    "tests.test_materialize_agent_wiring_entry_recovery",
    "tests.test_materialize_agent_wiring_finalize_guard",
    "tests.test_materialize_agent_wiring_hardlink",
    "tests.test_materialize_agent_wiring_journal_exclusive",
    "tests.test_materialize_agent_wiring_journal_path_safety",
    "tests.test_materialize_agent_wiring_late_recovery_guard",
    "tests.test_materialize_agent_wiring_safe",
)

COMPOSED_MODULES = tuple(
    module for module in base.AGENT_MODULES if module not in set(PRECOMPOSE_MODULES)
)


def _verify_runner_contract() -> None:
    if base.AGENT_HEAD != AGENT_HEAD:
        raise RuntimeError(
            f"BASE_RUNNER_HEAD_MISMATCH expected={AGENT_HEAD} actual={base.AGENT_HEAD}"
        )
    missing = sorted(set(PRECOMPOSE_MODULES) - set(base.AGENT_MODULES))
    if missing:
        raise RuntimeError(f"PRECOMPOSE_MODULE_NOT_IN_CANONICAL_MATRIX:{missing}")
    overlap = sorted(set(PRECOMPOSE_MODULES) & set(COMPOSED_MODULES))
    if overlap:
        raise RuntimeError(f"MATRIX_PHASE_OVERLAP:{overlap}")
    combined = PRECOMPOSE_MODULES + COMPOSED_MODULES
    if len(combined) != len(base.AGENT_MODULES) or set(combined) != set(base.AGENT_MODULES):
        raise RuntimeError("MATRIX_PHASE_PARTITION_MISMATCH")


def _verify_test_blobs(repo: Path, modules: tuple[str, ...]) -> dict[str, str]:
    test_blobs: dict[str, str] = {}
    for module in modules:
        rel = base.module_path(module).as_posix()
        path = repo / rel
        if path.is_symlink() or not path.is_file():
            raise RuntimeError(f"TEST_FILE_MISSING_OR_UNSAFE:{rel}")
        expected = base.run_git(repo, "rev-parse", f"{AGENT_HEAD}:{rel}")
        actual = base.git_blob_file(path)
        if actual != expected:
            raise RuntimeError(
                f"TEST_FILE_DRIFT:{rel}:expected={expected}:actual={actual}"
            )
        test_blobs[module] = actual
    return test_blobs


def _verify_precompose(repo: Path) -> dict[str, str]:
    actual_head = base.run_git(repo, "rev-parse", "HEAD")
    if actual_head != AGENT_HEAD:
        raise RuntimeError(
            f"AGENT_HEAD_MISMATCH expected={AGENT_HEAD} actual={actual_head}"
        )
    base.verify_worktree_shape(repo, set())
    return _verify_test_blobs(repo, PRECOMPOSE_MODULES)


def _verify_composed(repo: Path) -> dict[str, str]:
    return base.verify_composition(
        repo,
        AGENT_HEAD,
        base.EXACT_PAYLOAD_BLOBS,
        COMPOSED_MODULES,
    )


def _postcheck(repo: Path, phase: str) -> None:
    if phase == "precompose":
        base.verify_worktree_shape(repo, set())
        return
    base.verify_worktree_shape(repo, set(base.EXACT_PAYLOAD_BLOBS))
    for rel, expected in base.EXACT_PAYLOAD_BLOBS.items():
        actual = base.git_blob_file(repo / rel)
        if actual != expected:
            raise RuntimeError(
                f"POST_MATRIX_COMPOSED_BLOB_DRIFT:{rel}:"
                f"expected={expected}:actual={actual}"
            )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Execute one phase of the exact NOTION_AGENT matrix. "
            "Acceptance requires PASS manifests for both precompose and composed phases."
        )
    )
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--phase", choices=("precompose", "composed"), required=True)
    parser.add_argument("--timeout-per-module", type=float, default=180.0)
    args = parser.parse_args()

    repo = args.repo.resolve()
    started_epoch = int(time.time())
    modules = PRECOMPOSE_MODULES if args.phase == "precompose" else COMPOSED_MODULES

    try:
        _verify_runner_contract()
        if args.phase == "precompose":
            test_blobs = _verify_precompose(repo)
        else:
            test_blobs = _verify_composed(repo)
        records = base.run_matrix(repo, modules, args.timeout_per_module)
        _postcheck(repo, args.phase)
        verdict = "PASS" if all(record["status"] == "PASS" for record in records) else "FAIL"
        error = None
    except Exception as exc:
        test_blobs = {}
        records = []
        verdict = "ERROR"
        error = f"{type(exc).__name__}:{exc}"

    manifest = {
        "schema": SCHEMA,
        "verdict": verdict,
        "phase": args.phase,
        "agent_head": AGENT_HEAD,
        "candidate_blobs": (
            {} if args.phase == "precompose" else base.EXACT_PAYLOAD_BLOBS
        ),
        "test_file_blobs": test_blobs,
        "modules_required": list(modules),
        "modules_executed": records,
        "started_epoch": started_epoch,
        "finished_epoch": int(time.time()),
        "python": sys.version,
        "error": error,
        "acceptance_requires_phases": ["precompose", "composed"],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "verdict": verdict,
                "phase": args.phase,
                "modules": len(modules),
                "passed": sum(record.get("status") == "PASS" for record in records),
                "output": str(args.output),
            },
            ensure_ascii=False,
        )
    )
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
