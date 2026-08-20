import argparse
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile

GENERATION = 1
RUN_ID = "PLATFORM-MEASUREMENTS-20260820"
TASK_ID = "E5-SCHEDULED-RECOVERY"


def canonical_bytes(obj: object) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()


def state_sha256(obj: object) -> str:
    return hashlib.sha256(canonical_bytes(obj)).hexdigest()


def atomic_write(path: str, obj: dict) -> None:
    target = pathlib.Path(path)
    temp = target.with_suffix(".tmp")
    with open(temp, "wb") as handle:
        handle.write(canonical_bytes(obj))
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, target)
    parent_fd = os.open(target.parent, os.O_RDONLY)
    try:
        os.fsync(parent_fd)
    finally:
        os.close(parent_fd)


def recover(path: str, *, expected_generation: int = GENERATION) -> dict:
    envelope = json.loads(pathlib.Path(path).read_text())
    if envelope.get("generation") != expected_generation:
        raise RuntimeError("STALE_GENERATION")
    if envelope.get("run_id") != RUN_ID or envelope.get("task_id") != TASK_ID:
        raise RuntimeError("WRONG_FENCE")
    state = envelope.get("state")
    if envelope.get("state_sha256") != state_sha256(state):
        raise RuntimeError("CORRUPT_STATE")
    return state


def write_checkpoint(path: str) -> None:
    state = {"phase": "prepared", "sequence": 17, "effect_committed": False}
    atomic_write(
        path,
        {
            "kind": "FREE_FABRIC_CHECKPOINT",
            "generation": GENERATION,
            "run_id": RUN_ID,
            "task_id": TASK_ID,
            "state": state,
            "state_sha256": state_sha256(state),
        },
    )


def selftest() -> dict:
    with tempfile.TemporaryDirectory() as directory:
        checkpoint = str(pathlib.Path(directory) / "checkpoint.json")
        subprocess.run([sys.executable, __file__, "write", checkpoint], check=True, capture_output=True, text=True)
        recovered = subprocess.run(
            [sys.executable, __file__, "read", checkpoint], check=True, capture_output=True, text=True
        )
        assert json.loads(recovered.stdout)["sequence"] == 17

        stale_rejected = False
        try:
            recover(checkpoint, expected_generation=GENERATION + 1)
        except RuntimeError as exc:
            stale_rejected = str(exc) == "STALE_GENERATION"
        assert stale_rejected

        corrupted = json.loads(pathlib.Path(checkpoint).read_text())
        corrupted["state"]["sequence"] = 18
        pathlib.Path(checkpoint).write_text(json.dumps(corrupted))
        corruption_rejected = False
        try:
            recover(checkpoint)
        except RuntimeError as exc:
            corruption_rejected = str(exc) == "CORRUPT_STATE"
        assert corruption_rejected

        return {
            "result": "PASS",
            "fresh_process_recovery": True,
            "stale_generation_rejected": True,
            "corruption_rejected": True,
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", nargs="?", default="selftest")
    parser.add_argument("path", nargs="?")
    args = parser.parse_args()

    if args.mode == "write":
        write_checkpoint(args.path)
    elif args.mode == "read":
        print(json.dumps(recover(args.path), sort_keys=True))
    else:
        print(json.dumps(selftest(), sort_keys=True))
