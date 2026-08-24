from __future__ import annotations

import ast
import hashlib
from pathlib import Path


def _assignment_literal(module_path: Path, name: str):
    tree = ast.parse(module_path.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == name:
                    return ast.literal_eval(node.value)
    raise AssertionError(f"missing assignment: {name}")


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _local_imports(source: Path, payload_root: Path) -> set[str]:
    tree = ast.parse(source.read_text(encoding="utf-8"))
    result: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            module = node.module
            if module.startswith("payload."):
                result.add(module)
            elif "." not in module and (payload_root / f"{module}.py").is_file():
                result.add(module)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                module = alias.name
                if module.startswith("payload."):
                    result.add(module)
                elif "." not in module and (payload_root / f"{module}.py").is_file():
                    result.add(module)
    return result


def _source_for_module(module: str, payload_root: Path) -> Path | None:
    if module.startswith("payload."):
        rel = Path(*module.split(".")[1:]).with_suffix(".py")
        path = payload_root / rel
    else:
        path = payload_root / f"{module}.py"
    return path if path.is_file() else None


def _expected_installed_rel(module: str) -> Path:
    if module.startswith("payload."):
        return Path(*module.split(".")).with_suffix(".py")
    return Path(f"{module}.py")


def _collect_local_closure(entry: str, payload_root: Path) -> set[str]:
    pending = [entry]
    seen: set[str] = set()
    while pending:
        module = pending.pop()
        if module in seen:
            continue
        seen.add(module)
        source = _source_for_module(module, payload_root)
        if source is None:
            continue
        for imported in sorted(_local_imports(source, payload_root)):
            if imported not in seen:
                pending.append(imported)
    seen.discard(entry)
    return seen


def _closure_violations(integrated: Path, payload_root: Path) -> list[str]:
    payload_names = tuple(_assignment_literal(integrated, "PAYLOAD_NAMES"))
    static = dict(_assignment_literal(integrated, "R2_STATIC_DEPENDENCY_SHA256"))
    installed = {Path(name).as_posix() for name in payload_names}
    required = _collect_local_closure("server", payload_root)
    violations: list[str] = []
    for module in sorted(required):
        expected = _expected_installed_rel(module).as_posix()
        if expected in installed:
            continue
        if expected in static:
            source = _source_for_module(module, payload_root)
            if source is None:
                violations.append(f"{module}->{expected}:SOURCE_MISSING")
                continue
            source_sha = _sha256(source)
            if source_sha != static[expected]:
                violations.append(
                    f"{module}->{expected}:STATIC_SOURCE_DRIFT:{source_sha}"
                )
            continue
        violations.append(f"{module}->{expected}:NOT_DEPLOYED_OR_STATIC")
    return violations


def test_promoted_install_payload_closure() -> None:
    repo = Path(__file__).resolve().parents[1]
    payload_root = repo / "payload"
    integrated = repo / "integrated_upgrade.py"
    assert integrated.is_file() and payload_root.is_dir()
    violations = _closure_violations(integrated, payload_root)
    assert not violations, "PROMOTED_INSTALL_PAYLOAD_CLOSURE_MISSING:" + ",".join(violations)


if __name__ == "__main__":
    test_promoted_install_payload_closure()
    print("PROMOTED_INSTALL_PAYLOAD_CLOSURE_PASS")
