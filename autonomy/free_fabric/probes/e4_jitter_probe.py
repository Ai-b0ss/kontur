from datetime import datetime
import json


def build_observation(*, nominal_local: str, observed_local: str, run_id: str, task_id: str, generation: int) -> dict:
    nominal = datetime.fromisoformat(nominal_local)
    observed = datetime.fromisoformat(observed_local)
    return {
        "kind": "FREE_FABRIC_JITTER_OBSERVATION",
        "run_id": run_id,
        "task_id": task_id,
        "manifest_generation": generation,
        "nominal_schedule_local": nominal.isoformat(),
        "observed_runtime_context_local": observed.isoformat(),
        "signed_jitter_seconds": (observed - nominal).total_seconds(),
        "correctness_use": False,
        "interpretation": "telemetry_only",
    }


def selftest() -> dict:
    out = build_observation(
        nominal_local="2026-08-20T13:48:00+03:00",
        observed_local="2026-08-20T13:45:15+03:00",
        run_id="PLATFORM-MEASUREMENTS-20260820",
        task_id="E4-JITTER",
        generation=1,
    )
    assert out["signed_jitter_seconds"] == -165.0
    assert out["correctness_use"] is False
    return out


if __name__ == "__main__":
    print(json.dumps(selftest(), ensure_ascii=False, sort_keys=True))
