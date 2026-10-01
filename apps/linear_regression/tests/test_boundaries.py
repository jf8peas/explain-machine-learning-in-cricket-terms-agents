"""FR-031: shared-library candidates must not depend on app-specific modules."""
import ast
import re
import shutil
import subprocess
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parent.parent
PKG = APP / "backend" / "linreg"
SHARED = ["data_loading", "season_split", "evaluation", "cricket_explanation", "graph_api"]
APP_SPECIFIC = {"nodes", "graph", "features", "state", "regression"}


def imported_modules(path: Path) -> set[str]:
    found: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.ImportFrom):
            if node.level:  # relative: `from . import x` / `from .x import y`
                found.update([node.module] if node.module else [a.name for a in node.names])
            elif node.module:
                found.add(node.module.split(".")[-1] if node.module.startswith("linreg") else node.module)
        elif isinstance(node, ast.Import):
            found.update(a.name for a in node.names)
    return found


@pytest.mark.parametrize("module", SHARED)
def test_shared_python_module_has_no_app_specific_imports(module):
    bad = imported_modules(PKG / f"{module}.py") & APP_SPECIFIC
    assert not bad, f"{module}.py imports app-specific modules: {sorted(bad)}"


def test_visualiser_does_not_import_page_code_or_know_the_app():
    for ts in (APP / "web" / "src" / "graph-replay").glob("*.ts"):
        text = ts.read_text(encoding="utf-8")
        assert not re.search(r"from\s+['\"]\.\./page", text), f"{ts.name} imports page code"
        for word in ("cricket", "regression", "innings", "wicket", "powerplay"):
            code = re.sub(r"//.*|/\*.*?\*/", "", text, flags=re.S)
            assert word not in code.lower(), f"{ts.name} mentions {word!r}"


def test_requirements_txt_matches_the_lockfile():
    if not shutil.which("uv"):
        pytest.skip("uv not available")
    out = subprocess.run(
        ["uv", "export", "--frozen", "--no-dev", "--no-hashes", "--no-emit-workspace", "--no-header"],
        cwd=APP, capture_output=True, text=True, check=True).stdout
    strip = lambda t: [l for l in t.splitlines() if l and not l.startswith("#")]  # noqa: E731
    assert strip(out) == strip((APP / "requirements.txt").read_text(encoding="utf-8")), \
        "requirements.txt is out of date: run `uv export` (see quickstart)"
