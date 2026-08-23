#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

REQUIRED_EXACT_MODULES = (
    "tests.test_subagent_tombstone_post_replace_sync_failure",
    "tests.test_subagent_tombstone_store",
    "tests.test_server_subagent_tombstone_restart",
    "tests.test_delegated_cancellation_lifecycle",
    "tests.test_materialize_agent_wiring",
    "tests.test_materialize_agent_wiring_crash_recovery",
    "tests.test_materialize_agent_wiring_with_tombstones",
    "tests.test_account_pool_dynamic_reservation_materializer",
    "tests.test_dynamic_reservation_lease_session",
    "tests.test_dynamic_reservation_inlease_reselect",
    "tests.test_real_codex_cli_probe_contract",
    # Startup cleanup is a load-bearing Agent/Core composition boundary. Both
    # the direct failure chain and repeated-cancellation/shield semantics must
    # be executed by the final same-byte suite.
    "tests.test_startup_status_cleanup",
    "tests.test_startup_cleanup_failure_boundary_candidate",
    "tests.test_startup_status_repeated_cancellation",
    "tests.test_prompt_modes",
    "tests.test_prompt_policy_identity",
    "tests.test_responses_prompt_mode_http_contract",
    "tests.test_responses_prompt_wiring_contract",
    "tests.test_delegation_policy",
    "tests.test_delegation_dispatcher",
    "tests.test_notion_delegated_model_step",
    "tests.test_subagent_entrypoint",
    "tests.test_foreground_slot_routing",
    "tests.test_server_subagent_wiring_materializer",
    "tests.test_delegated_tool_loop_runtime_validation",
    "tests.test_delegated_uncertain_failover_boundary",
    "tests.test_notion_delegated_synthetic_call_ids",
    "tests.test_notion_delegated_thread_reentry",
    "tests.test_notion_delegation_dynamic_reservations",
    "tests.test_notion_subagent_runtime",
    "tests.test_notion_subagent_server_reservations",
    "tests.test_reservation_aware_lease",
    "tests.test_responses_cooldown_failover",
    "tests.test_subagent_lifecycle",
)

REQUIRED_STAGE_B_TOKENS = (
    "durable_replay",
    "provider_intent",
)


def _module_token(module: str) -> str:
    return module.replace(".", "/") + ".py"


def _suite_mentions(text: str, module: str) -> bool:
    dotted = module
    slash = _module_token(module)
    basename = module.rsplit(".", 1)[-1]
    return (
        dotted in text
        or slash in text
        or re.search(
            rf"(?<![A-Za-z0-9_]){re.escape(basename)}(?![A-Za-z0-9_])",
            text,
        )
        is not None
    )


def check(repo: Path, suite_files: list[Path]) -> dict[str, object]:
    suite_text = "\n".join(path.read_text(encoding="utf-8") for path in suite_files)
    missing_files: list[str] = []
    missing_suite: list[str] = []
    for module in REQUIRED_EXACT_MODULES:
        rel = Path(_module_token(module))
        if not (repo / rel).is_file():
            missing_files.append(rel.as_posix())
        if not _suite_mentions(suite_text, module):
            missing_suite.append(module)

    stage_b_files = (
        sorted(
            p.relative_to(repo).as_posix()
            for p in (repo / "tests").glob("test_*.py")
            if any(token in p.name for token in REQUIRED_STAGE_B_TOKENS)
        )
        if (repo / "tests").is_dir()
        else []
    )
    stage_b_suite_hits = [
        rel
        for rel in stage_b_files
        if Path(rel).stem in suite_text or rel in suite_text
    ]
    missing_stage_b_suite = sorted(set(stage_b_files) - set(stage_b_suite_hits))
    stage_b_ready = bool(stage_b_files) and not missing_stage_b_suite

    verdict = (
        "PASS"
        if not missing_files and not missing_suite and stage_b_ready
        else "NOT_READY"
    )
    return {
        "verdict": verdict,
        "missing_test_files": missing_files,
        "missing_from_suite": missing_suite,
        "stage_b_test_files": stage_b_files,
        "stage_b_missing_from_suite": missing_stage_b_suite,
        "stage_b_ready": stage_b_ready,
    }


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Fail-closed coverage check for the final NOTION composed/Windows gate"
    )
    ap.add_argument("--repo", type=Path, required=True)
    ap.add_argument("--suite-file", type=Path, action="append", required=True)
    args = ap.parse_args()
    repo = args.repo.resolve()
    suite_files = [p.resolve() for p in args.suite_file]
    missing_input = [str(p) for p in suite_files if not p.is_file()]
    if missing_input:
        print(
            json.dumps(
                {"verdict": "ERROR", "missing_suite_files": missing_input},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 2
    result = check(repo, suite_files)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
