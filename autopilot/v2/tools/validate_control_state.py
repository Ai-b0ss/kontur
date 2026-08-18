#!/usr/bin/env python3
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANES = ROOT / "lanes"
ACCEPTANCE = ROOT / "acceptance"
HEX40 = re.compile(r"^[0-9a-f]{40}$")
UNRESOLVED = {"PENDING", "QUEUED", "RUNNING", "TRIGGERED", "TRIGGERED_AWAIT_CALLBACK", "PENDING_LAST_HANDOFF", "WAIT_EXTERNAL"}


def parse_utc(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError("timestamp must be string")
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        raise ValueError("timestamp must be timezone-aware")
    return dt.astimezone(timezone.utc)


def acceptance_file(version: str) -> Path:
    return ACCEPTANCE / f"{version}.json"


def main() -> int:
    errors = []
    warnings = []
    seen_provider_leases = []

    for path in sorted(LANES.glob("*.json")):
        try:
            lane = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"{path.name}: invalid JSON: {exc}")
            continue

        name = lane.get("lane", path.stem.upper())
        rev = lane.get("state_revision")
        if not isinstance(rev, int) or rev < 1:
            errors.append(f"{name}: state_revision must be positive integer")

        try:
            parse_utc(lane.get("updated_at_utc"))
        except Exception as exc:
            errors.append(f"{name}: invalid updated_at_utc: {exc}")

        head = lane.get("current_head")
        if head is not None and not HEX40.match(str(head)):
            errors.append(f"{name}: current_head must be exact lowercase 40-hex SHA")

        authority = lane.get("authority") or {}
        version = authority.get("acceptance_version")
        if version:
            apath = acceptance_file(version)
            if not apath.exists():
                errors.append(f"{name}: missing acceptance manifest {apath.relative_to(ROOT)}")
            else:
                try:
                    manifest = json.loads(apath.read_text(encoding="utf-8"))
                    if manifest.get("acceptance_version") != version:
                        errors.append(f"{name}: acceptance_version mismatch in {apath.name}")
                    row_ids = [r.get("id") for r in manifest.get("rows", [])]
                    if len(row_ids) != len(set(row_ids)) or any(not x for x in row_ids):
                        errors.append(f"{name}: acceptance manifest has missing/duplicate row ids")
                except Exception as exc:
                    errors.append(f"{name}: invalid acceptance manifest: {exc}")

        claim = lane.get("active_claim")
        if claim:
            try:
                started = parse_utc(claim["started_at_utc"])
                expires = parse_utc(claim["expires_at_utc"])
                duration = (expires - started).total_seconds()
                if duration <= 0 or duration > 15 * 60:
                    errors.append(f"{name}: claim lease must be >0 and <=15m, got {duration:.0f}s")
                expected = claim.get("expected_head")
                if head and expected != head:
                    errors.append(f"{name}: active claim expected_head != current_head")
            except Exception as exc:
                errors.append(f"{name}: invalid active_claim: {exc}")

        lease = lane.get("provider_live_lease")
        if lease:
            seen_provider_leases.append((name, lease))

        unresolved_keys = set()
        for i, run in enumerate(lane.get("in_flight_external") or []):
            status = str(run.get("status", "")).upper()
            key = (
                run.get("kind") or run.get("proof_surface") or run.get("executor"),
                run.get("launched_for_sha"),
            )
            if any(token in status for token in UNRESOLVED):
                if key in unresolved_keys:
                    errors.append(f"{name}: duplicate unresolved external proof {key}")
                unresolved_keys.add(key)
            launched = run.get("launched_for_sha")
            if launched is not None and not HEX40.match(str(launched)):
                errors.append(f"{name}: in_flight_external[{i}].launched_for_sha is not exact SHA")

        if lane.get("phase") != "CORE_DONE_FROZEN" and not lane.get("first_next_action"):
            errors.append(f"{name}: missing first_next_action")

        if claim and lane.get("phase") == "WAIT_EXTERNAL":
            errors.append(f"{name}: WAIT_EXTERNAL may not retain mutable claim")

        if lane.get("core_done") and version:
            warnings.append(f"{name}: structural validator cannot prove acceptance rows; CORE_DONE still requires row-bound evidence")

    if len(seen_provider_leases) > 2:
        warnings.append("More than two provider live leases exist; verify they are for distinct providers and not fan-out")

    if errors:
        print("CONTROL_STATE_INVALID")
        for item in errors:
            print(f"ERROR: {item}")
        for item in warnings:
            print(f"WARN: {item}")
        return 1

    print("CONTROL_STATE_VALID")
    for item in warnings:
        print(f"WARN: {item}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
