#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import re
import subprocess
import sys
from pathlib import Path

EXPECTED_BEFORE = {
    "apps/miniapp/src/screens/LocalKontur.tsx": "19d7d31db51e0536c5cf0da12cfb2bd0588b0da9",
    "apps/miniapp/test/local-kontur.test.ts": "4af01479da6a23bd0e8d9aef15dd458817676101",
    "apps/miniapp/test/hatch-reveal-persistence.test.ts": "a4f0d1942a631cff329798fcf4ba30109abc9937",
    "apps/miniapp/src/api.ts": "725f9235fc33bad6ce8627ac450c659e60bca183",
}

EXPECTED_AFTER = {
    "apps/miniapp/src/screens/LocalKontur.tsx": "15677499334ef43bfef94380e557461aab9e40eb",
    "apps/miniapp/test/local-kontur.test.ts": "b4719b4ae96b8290435aaa8c9c9e329d4116185c",
    "apps/miniapp/test/hatch-reveal-persistence.test.ts": "86aad3c96a892836eb8a3c87fb98fdd5e5380708",
    "apps/miniapp/src/api.ts": "725f9235fc33bad6ce8627ac450c659e60bca183",
}

EXPECTED_PATCH_SHA256 = "dcc0e3a60a8b91a90f30c2ee35bdb86861238394695f6068a8988f834e4cf56c"


def git_blob(path: str) -> str:
    return subprocess.check_output(["git", "hash-object", path], text=True).strip()


def verify(mapping: dict[str, str], label: str) -> None:
    for path, expected in mapping.items():
        actual = git_blob(path)
        if actual != expected:
            raise SystemExit(f"{label}: {path}: expected {expected}, got {actual}")
        print(f"{label}: {path}: {actual}")


def parse_patch(text: str):
    files = []
    current = None
    hunk = None
    for line in text.splitlines(True):
        if line.startswith("diff --git "):
            match = re.match(r"diff --git a/(.+?) b/(.+?)\n?$", line)
            if not match:
                raise SystemExit(f"invalid diff header: {line!r}")
            current = {"path": match.group(2), "hunks": []}
            files.append(current)
            hunk = None
        elif current is not None and line.startswith("@@"):
            hunk = []
            current["hunks"].append(hunk)
        elif hunk is not None and line[:1] in (" ", "+", "-"):
            if line.startswith("--- ") or line.startswith("+++ "):
                continue
            hunk.append(line)
    return files


def apply_exact(text: str) -> None:
    for file_spec in parse_patch(text):
        path = Path(file_spec["path"])
        data = path.read_text(encoding="utf-8")
        for index, hunk in enumerate(file_spec["hunks"], start=1):
            old = "".join(line[1:] for line in hunk if not line.startswith("+"))
            new = "".join(line[1:] for line in hunk if not line.startswith("-"))
            matches = data.count(old)
            if matches != 1:
                raise SystemExit(
                    f"patch fail-closed: {path} hunk {index}: expected exactly one match, got {matches}"
                )
            data = data.replace(old, new, 1)
        path.write_text(data, encoding="utf-8")


def main() -> None:
    patch_path = Path(sys.argv[1] if len(sys.argv) > 1 else ".circleci/kontur-candidate.patch")
    raw = patch_path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    if sha != EXPECTED_PATCH_SHA256:
        raise SystemExit(f"patch SHA-256 mismatch: expected {EXPECTED_PATCH_SHA256}, got {sha}")
    print(f"PATCH_SHA256_PASS {sha}")
    verify(EXPECTED_BEFORE, "PRE")
    apply_exact(raw.decode("utf-8"))
    verify(EXPECTED_AFTER, "POST")
    print("KONTUR_BOUNDED_CANDIDATE_APPLY_PASS")


if __name__ == "__main__":
    main()
