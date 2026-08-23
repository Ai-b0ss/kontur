from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import tempfile
from pathlib import Path

AGENT_HEAD = "ee0ae241b3ef19da7d3a69ddeecf6bb5476f91a9"
EXPECTED = {
    Path("payload/account_pool.py"): "c9ca6f3b4545e469966369a4220a6a2a60bf3697",
    Path("payload/server.py"): "ba52edc7a8528d58acd2c5bef2b86c3ca84ca298",
}
MATERIALIZER = Path("tools/materialize_agent_wiring_with_tombstones.py")


def git_blob_sha(raw: bytes) -> str:
    return hashlib.sha1(f"blob {len(raw)}\0".encode("ascii") + raw).hexdigest()


def _run(repo: Path, *args: str, input_bytes: bytes | None = None) -> bytes:
    proc = subprocess.run(
        list(args),
        cwd=repo,
        input=input_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0:
        stderr = proc.stderr.decode("utf-8", "replace").strip()
        raise RuntimeError(f"COMMAND_FAILED:{args[0]}:{proc.returncode}:{stderr[-400:]}")
    return proc.stdout


def _refs(repo: Path) -> bytes:
    return _run(repo, "git", "show-ref", "--head")


def persist_pair(repo: Path, expected: dict[Path, str]) -> dict[str, str]:
    refs_before = _refs(repo)
    out: dict[str, str] = {}
    for rel, wanted in expected.items():
        path = repo / rel
        raw = path.read_bytes()
        actual = git_blob_sha(raw)
        if actual != wanted:
            raise RuntimeError(f"PAIR_BLOB_MISMATCH:{rel.as_posix()}:{actual}")
        stored = _run(repo, "git", "hash-object", "-w", "--", rel.as_posix()).decode("ascii").strip()
        if stored != wanted:
            raise RuntimeError(f"HASH_OBJECT_MISMATCH:{rel.as_posix()}:{stored}")
        roundtrip = _run(repo, "git", "cat-file", "blob", stored)
        if roundtrip != raw:
            raise RuntimeError(f"CAT_FILE_BYTE_MISMATCH:{rel.as_posix()}")
        out[rel.as_posix()] = stored
    refs_after = _refs(repo)
    if refs_after != refs_before:
        raise RuntimeError("REF_MOVEMENT_DETECTED")
    return out


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="notion-pair-exporter-") as td:
        repo = Path(td)
        _run(repo, "git", "init", "-q")
        _run(repo, "git", "config", "user.email", "self-test@example.invalid")
        _run(repo, "git", "config", "user.name", "self-test")
        (repo / "payload").mkdir()
        files = {
            Path("payload/account_pool.py"): b"print('account')\n",
            Path("payload/server.py"): b"print('server')\n",
        }
        expected: dict[Path, str] = {}
        for rel, raw in files.items():
            (repo / rel).write_bytes(raw)
            expected[rel] = git_blob_sha(raw)
        _run(repo, "git", "add", ".")
        _run(repo, "git", "commit", "-qm", "base")
        before = _refs(repo)
        result = persist_pair(repo, expected)
        after = _refs(repo)
        assert before == after
        assert result == {rel.as_posix(): expected[rel] for rel in expected}
        (repo / "payload/server.py").write_bytes(b"changed\n")
        try:
            persist_pair(repo, expected)
        except RuntimeError as exc:
            assert str(exc).startswith("PAIR_BLOB_MISMATCH:payload/server.py:")
        else:
            raise AssertionError("negative mismatch was not rejected")
    print("EXACT_AGENT_PAIR_BLOB_EXPORTER_SELF_TEST_PASS")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("repo", nargs="?", type=Path, default=Path("."))
    parser.add_argument("--materialize", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0

    repo = args.repo.resolve()
    head = _run(repo, "git", "rev-parse", "HEAD").decode("ascii").strip()
    if head != AGENT_HEAD:
        raise RuntimeError(f"AGENT_HEAD_MISMATCH:{head}")

    if args.materialize:
        materializer = repo / MATERIALIZER
        if not materializer.is_file():
            raise RuntimeError("MATERIALIZER_MISSING")
        _run(repo, sys.executable, str(materializer), "--check")
        _run(repo, sys.executable, str(materializer))

    result = persist_pair(repo, EXPECTED)
    print("AGENT_PAIR_ACCOUNT_BLOB=" + result["payload/account_pool.py"])
    print("AGENT_PAIR_SERVER_BLOB=" + result["payload/server.py"])
    print("AGENT_PAIR_REF_MOVEMENT=0")
    print("AGENT_PAIR_BLOB_HANDOFF_PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
