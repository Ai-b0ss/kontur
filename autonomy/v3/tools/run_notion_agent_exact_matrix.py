#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

SCHEMA = 'notion_agent_exact_matrix_execution_v1'
AGENT_HEAD = '3cc0c0be34bad1b79555d842cd8fc9755dd26b64'
EXACT_PAYLOAD_BLOBS = {
    'payload/account_pool.py': 'c9ca6f3b4545e469966369a4220a6a2a60bf3697',
    'payload/server.py': '273db94a8f9b153e95c910df221755e28c0f46a7',
    'payload/delegation_policy.py': 'fd9a5d7022524d1e4c2a5c79c82fe189f7277a6e',
    'payload/delegation_dispatcher.py': 'a9d15b79b421cd29b094b549be06d2b0319e26d9',
    'payload/notion_delegated_model_step.py': 'f36e9c91355dec667173b6265dd550554fb0f05d',
    'payload/subagent_entrypoint.py': '2d57651b408ef2e6c75f29855f7cdbaeafa97c2e',
    'payload/server_subagent_lifecycle.py': 'f47838b338f2bd94163cf466110f939c065ac041',
}
# Agent-only portion of the final coverage matrix. Core Stage-B / promoted-installer
# modules are intentionally excluded and are owned by NOTION_CORE.
AGENT_MODULES = (
    'tests.test_subagent_tombstone_post_replace_sync_failure',
    'tests.test_subagent_tombstone_store',
    'tests.test_server_subagent_tombstone_restart',
    'tests.test_delegated_cancellation_lifecycle',
    'tests.test_materialize_agent_wiring',
    'tests.test_materialize_agent_wiring_crash_recovery',
    'tests.test_materialize_agent_wiring_with_tombstones',
    'tests.test_materialize_agent_wiring_target_path_safety',
    'tests.test_materialize_agent_wiring_late_alias_substitution',
    'tests.test_account_pool_dynamic_reservation_materializer',
    'tests.test_dynamic_reservation_lease_session',
    'tests.test_dynamic_reservation_inlease_reselect',
    'tests.test_real_codex_cli_probe_contract',
    'tests.test_live_two_slot_probe_contract',
    'tests.test_startup_status_cleanup',
    'tests.test_startup_cleanup_failure_boundary_candidate',
    'tests.test_startup_status_repeated_cancellation',
    'tests.test_prompt_modes',
    'tests.test_prompt_policy_identity',
    'tests.test_responses_prompt_mode_http_contract',
    'tests.test_responses_prompt_wiring_contract',
    'tests.test_delegation_policy',
    'tests.test_delegation_dispatcher',
    'tests.test_notion_delegated_model_step',
    'tests.test_subagent_entrypoint',
    'tests.test_foreground_slot_routing',
    'tests.test_server_subagent_wiring_materializer',
    'tests.test_delegated_tool_loop',
    'tests.test_delegated_tool_loop_runtime_validation',
    'tests.test_delegated_uncertain_failover_boundary',
    'tests.test_dynamic_reservation_session_entry_cleanup',
    'tests.test_notion_delegated_synthetic_call_ids',
    'tests.test_notion_delegated_thread_reentry',
    'tests.test_notion_delegation_dynamic_reservations',
    'tests.test_notion_subagent_runtime',
    'tests.test_notion_subagent_server_reservations',
    'tests.test_reservation_aware_lease',
    'tests.test_responses_cooldown_failover',
    'tests.test_subagent_lifecycle',
    'tests.test_server_subagent_durable_tool_guard_v2',
    'tests.test_server_subagent_uncertain_rebind',
    'tests.test_server_subagent_lifecycle_drain',
    'tests.test_server_subagent_tool_catalog',
    'tests.test_notion_tool_subagent_runtime',
    'tests.test_account_pool_parallelism',
    'tests.test_account_pool_reselect_release_abort_contract',
    'tests.test_account_pool_reselect_release_abort_semantics',
    'tests.test_delegated_failover_session',
    'tests.test_materialize_agent_wiring_backup_snapshot',
    'tests.test_materialize_agent_wiring_durability_order',
    'tests.test_materialize_agent_wiring_entry_recovery',
    'tests.test_materialize_agent_wiring_finalize_guard',
    'tests.test_materialize_agent_wiring_hardlink',
    'tests.test_materialize_agent_wiring_journal_exclusive',
    'tests.test_materialize_agent_wiring_journal_path_safety',
    'tests.test_materialize_agent_wiring_late_recovery_guard',
    'tests.test_materialize_agent_wiring_safe',
)

def git_blob_bytes(data: bytes) -> str:
    return hashlib.sha1(f'blob {len(data)}\0'.encode('ascii') + data).hexdigest()

def git_blob_file(path: Path) -> str:
    return git_blob_bytes(path.read_bytes())

def module_path(module: str) -> Path:
    return Path(module.replace('.', '/') + '.py')

def run_git(repo: Path, *args: str) -> str:
    cp = subprocess.run(['git', *args], cwd=repo, check=True, text=True, capture_output=True)
    return cp.stdout.strip()

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def verify_composition(repo: Path, expected_head: str, payload_blobs: dict[str, str], modules: tuple[str, ...]) -> dict[str, str]:
    actual_head = run_git(repo, 'rev-parse', 'HEAD')
    if actual_head != expected_head:
        raise RuntimeError(f'AGENT_HEAD_MISMATCH expected={expected_head} actual={actual_head}')
    for rel, expected in payload_blobs.items():
        p = repo / rel
        if p.is_symlink() or not p.is_file():
            raise RuntimeError(f'COMPOSED_FILE_MISSING_OR_UNSAFE:{rel}')
        actual = git_blob_file(p)
        if actual != expected:
            raise RuntimeError(f'COMPOSED_BLOB_MISMATCH:{rel}:expected={expected}:actual={actual}')
    test_blobs: dict[str, str] = {}
    for module in modules:
        rel = module_path(module).as_posix()
        p = repo / rel
        if p.is_symlink() or not p.is_file():
            raise RuntimeError(f'TEST_FILE_MISSING_OR_UNSAFE:{rel}')
        base_blob = run_git(repo, 'rev-parse', f'{expected_head}:{rel}')
        current_blob = git_blob_file(p)
        if current_blob != base_blob:
            raise RuntimeError(f'TEST_FILE_DRIFT:{rel}:expected={base_blob}:actual={current_blob}')
        test_blobs[module] = current_blob
    return test_blobs

def run_matrix(repo: Path, modules: tuple[str, ...], timeout: float) -> list[dict[str, object]]:
    env = os.environ.copy()
    extra = [str(repo), str(repo / 'regression' / 'test_support'), str(repo / 'regression' / 'stubs')]
    old = env.get('PYTHONPATH')
    env['PYTHONPATH'] = os.pathsep.join(extra + ([old] if old else []))
    records: list[dict[str, object]] = []
    for module in modules:
        started = time.monotonic()
        cmd = [sys.executable, '-m', 'unittest', '-v', module]
        try:
            cp = subprocess.run(cmd, cwd=repo, env=env, capture_output=True, timeout=timeout)
            rc = cp.returncode
            out = cp.stdout
            err = cp.stderr
            status = 'PASS' if rc == 0 else 'FAIL'
            timed_out = False
        except subprocess.TimeoutExpired as exc:
            rc = None
            out = exc.stdout or b''
            err = exc.stderr or b''
            status = 'TIMEOUT'
            timed_out = True
        records.append({
            'module': module,
            'status': status,
            'returncode': rc,
            'timed_out': timed_out,
            'duration_ms': int((time.monotonic() - started) * 1000),
            'stdout_sha256': sha256(out),
            'stderr_sha256': sha256(err),
            'stdout_bytes': len(out),
            'stderr_bytes': len(err),
        })
    return records

def main() -> int:
    ap = argparse.ArgumentParser(description='Execute the exact offline NOTION_AGENT safety matrix and emit machine-readable proof.')
    ap.add_argument('--repo', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True)
    ap.add_argument('--timeout-per-module', type=float, default=180.0)
    ap.add_argument('--agent-head', default=AGENT_HEAD)
    args = ap.parse_args()
    repo = args.repo.resolve()
    started_epoch = int(time.time())
    try:
        test_blobs = verify_composition(repo, args.agent_head, EXACT_PAYLOAD_BLOBS, AGENT_MODULES)
        records = run_matrix(repo, AGENT_MODULES, args.timeout_per_module)
        verdict = 'PASS' if all(r['status'] == 'PASS' for r in records) else 'FAIL'
        error = None
    except Exception as exc:
        test_blobs = {}
        records = []
        verdict = 'ERROR'
        error = f'{type(exc).__name__}:{exc}'
    manifest = {
        'schema': SCHEMA,
        'verdict': verdict,
        'agent_head': args.agent_head,
        'candidate_blobs': EXACT_PAYLOAD_BLOBS,
        'test_file_blobs': test_blobs,
        'modules_required': list(AGENT_MODULES),
        'modules_executed': records,
        'started_epoch': started_epoch,
        'finished_epoch': int(time.time()),
        'python': sys.version,
        'error': error,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(json.dumps({'verdict': verdict, 'modules': len(AGENT_MODULES), 'passed': sum(r.get('status') == 'PASS' for r in records), 'output': str(args.output)}, ensure_ascii=False))
    return 0 if verdict == 'PASS' else 1

if __name__ == '__main__':
    raise SystemExit(main())
