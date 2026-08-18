#!/usr/bin/env python3
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANES = ROOT / "lanes"
ACCEPTANCE = ROOT / "acceptance"
AUTHORITY = ROOT / "authority" / "registry.json"
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


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    errors = []
    warnings = []

    try:
        registry = load_json(AUTHORITY)
        authority_refs = set((registry.get("refs") or {}).keys())
        if not authority_refs:
            errors.append("authority registry has no refs")
    except Exception as exc:
        authority_refs = set()
        errors.append(f"authority registry invalid/missing: {exc}")

    seen_provider_leases = []
    global_seen = False

    for path in sorted(LANES.glob("*.json")):
        try:
            lane = load_json(path)
        except Exception as exc:
            errors.append(f"{path.name}: invalid JSON: {exc}")
            continue

        name = lane.get("lane", path.stem.upper())
        is_global = name == "GLOBAL"
        global_seen = global_seen or is_global
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
        manifest = None
        rows_by_id = {}
        if version:
            apath = acceptance_file(version)
            if not apath.exists():
                errors.append(f"{name}: missing acceptance manifest {apath.relative_to(ROOT)}")
            else:
                try:
                    manifest = load_json(apath)
                    if manifest.get("acceptance_version") != version:
                        errors.append(f"{name}: acceptance_version mismatch in {apath.name}")
                    rows = manifest.get("rows", [])
                    row_ids = [r.get("id") for r in rows]
                    if len(row_ids) != len(set(row_ids)) or any(not x for x in row_ids):
                        errors.append(f"{name}: acceptance manifest has missing/duplicate row ids")
                    rows_by_id = {r["id"]: r for r in rows if r.get("id")}
                    declared = manifest.get("authority_refs")
                    if not isinstance(declared, list) or not declared:
                        errors.append(f"{name}: acceptance manifest must declare non-empty authority_refs")
                    else:
                        unknown = sorted(set(declared) - authority_refs)
                        if unknown:
                            errors.append(f"{name}: manifest has unknown authority refs {unknown}")
                    for row in rows:
                        refs = row.get("authority_refs")
                        if not isinstance(refs, list) or not refs:
                            errors.append(f"{name}:{row.get('id')}: row requires authority_refs")
                        else:
                            unknown = sorted(set(refs) - authority_refs)
                            if unknown:
                                errors.append(f"{name}:{row.get('id')}: unknown authority refs {unknown}")
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
                errors.append(f"{name}: invalid active_claim lease/head: {exc}")

            if version:
                row_id = claim.get("acceptance_row")
                if row_id not in rows_by_id:
                    errors.append(f"{name}: product claim must name a valid acceptance_row")
                refs = claim.get("authority_refs")
                if not isinstance(refs, list) or not refs:
                    errors.append(f"{name}: product claim requires non-empty authority_refs")
                else:
                    unknown = sorted(set(refs) - authority_refs)
                    if unknown:
                        errors.append(f"{name}: product claim has unknown authority refs {unknown}")
                    if row_id in rows_by_id and not (set(refs) & set(rows_by_id[row_id].get("authority_refs") or [])):
                        errors.append(f"{name}: product claim authority_refs do not bind acceptance row {row_id}")
                allowed = claim.get("allowed_paths")
                if not isinstance(allowed, list) or not allowed:
                    errors.append(f"{name}: product claim requires non-empty allowed_paths")
                forbidden = claim.get("forbidden_surfaces")
                if not isinstance(forbidden, list):
                    errors.append(f"{name}: product claim requires forbidden_surfaces list")
                if not str(claim.get("hypothesis") or "").strip():
                    errors.append(f"{name}: product claim requires hypothesis")
                if not str(claim.get("new_information_expected") or "").strip():
                    errors.append(f"{name}: product claim requires new_information_expected")

        lease = lane.get("provider_live_lease")
        if lease:
            seen_provider_leases.append((name, lease))
            if not is_global:
                errors.append(f"{name}: provider_live_lease is global-only; store it in lanes/global.json")

        unresolved_keys = set()
        for i, run in enumerate(lane.get("in_flight_external") or []):
            status = str(run.get("status", "")).upper()
            key = (run.get("kind") or run.get("proof_surface") or run.get("executor"), run.get("launched_for_sha"))
            if any(token in status for token in UNRESOLVED):
                if key in unresolved_keys:
                    errors.append(f"{name}: duplicate unresolved external proof {key}")
                unresolved_keys.add(key)
            launched = run.get("launched_for_sha")
            if launched is not None and not HEX40.match(str(launched)):
                errors.append(f"{name}: in_flight_external[{i}].launched_for_sha is not exact SHA")
            if version and run.get("acceptance_row") is None:
                warnings.append(f"{name}: in_flight_external[{i}] is legacy/unbound; harvest it but do not let it newly close a row without acceptance_row binding")

        if lane.get("phase") != "CORE_DONE_FROZEN" and not lane.get("first_next_action"):
            errors.append(f"{name}: missing first_next_action")
        if claim and lane.get("phase") == "WAIT_EXTERNAL":
            errors.append(f"{name}: WAIT_EXTERNAL may not retain mutable claim")
        if lane.get("core_done") and version:
            warnings.append(f"{name}: structural validator cannot prove acceptance rows; CORE_DONE still requires row-bound evidence")

    if not global_seen:
        errors.append("GLOBAL: missing lanes/global.json")
    if len(seen_provider_leases) > 1:
        errors.append("GLOBAL: more than one provider-live lease exists")

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
