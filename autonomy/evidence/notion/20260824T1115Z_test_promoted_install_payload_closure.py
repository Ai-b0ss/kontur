from __future__ import annotations

import ast
from pathlib import Path


def _assignment_literal(module_path: Path, name: str):
    tree = ast.parse(module_path.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == name:
                    return ast.literal_eval(node.value)
    raise AssertionError(f"missing assignment: {name}")


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


def test_promoted_install_payload_closure() -> None:
    repo = Path(__file__).resolve().parents[1]
    payload_root = repo / "payload"
    integrated = repo / "integrated_upgrade.py"
    assert integrated.is_file() and payload_root.is_dir()

    payload_names = tuple(_assignment_literal(integrated, "PAYLOAD_NAMES"))
    static = dict(_assignment_literal(integrated, "R2_STATIC_DEPENDENCY_SHA256"))

    # integrated_upgrade maps every PAYLOAD_NAMES member to bridge/<name>.
    # A safe future fix may add nested managed names; this regression accepts them.
    installed = {Path(name).as_posix() for name in payload_names}
    installed.update(Path(name).as_posix() for name in static)

    required = _collect_local_closure("server", payload_root)
    missing: list[str] = []
    for module in sorted(required):
        expected = _expected_installed_rel(module).as_posix()
        if expected not in installed:
            missing.append(f"{module}->{expected}")

    assert not missing, "PROMOTED_INSTALL_PAYLOAD_CLOSURE_MISSING:" + ",".join(missing)


if __name__ == "__main__":
    test_promoted_install_payload_closure()
    print("PROMOTED_INSTALL_PAYLOAD_CLOSURE_PASS")
