"""FR-031: shared-library candidates must not depend on app-specific modules."""
import ast
import re
import shutil
import subprocess
from pathlib import Path

import pytest

APP = Path(__file__).resolve().parent.parent
PKG = APP / "backend" / "linreg"
SHARED = ["data_loading", "season_split", "evaluation", "cricket_explanation", "graph_api", "data_api", "stages"]
APP_SPECIFIC = {"nodes", "graph", "features", "state", "regression", "competition_dummies", "data_notes", "data_table",
                # feature 004: the language-model step, its rules, its limits and its fake
                "selection", "redundancy", "recipes", "llm_client", "llm_reply", "llm_fake", "prompts", "model_options",
                "run_gate", "limit_store", "run_budget", "catalogue_api",
                # feature 005: this app's notes and done-beforehand item for the stage legend
                "stage_info"}


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


@pytest.mark.parametrize("folder", ["graph-replay", "tab-set", "data-grid"])
def test_reusable_web_module_does_not_import_page_code_or_know_the_app(folder):
    files = list((APP / "web" / "src" / folder).glob("*.ts"))
    assert files
    for ts in files:
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


def _string_constants(path: Path) -> set[str]:
    return {n.value for n in ast.walk(ast.parse(path.read_text(encoding="utf-8")))
            if isinstance(n, ast.Constant) and isinstance(n.value, str)}


def test_the_dummy_mapping_is_defined_in_exactly_one_place():
    """is_ipl / is_bbl are spelled out only in competition_dummies.py; the script, loader, nodes and Data tab import them."""
    files = list(PKG.glob("*.py")) + [APP / "scripts" / "prepare_data.py", APP / "api" / "index.py"]
    owners = sorted(f.name for f in files if {"is_ipl", "is_bbl"} & _string_constants(f))
    assert owners == ["competition_dummies.py"]


def test_the_script_uses_the_shared_definition():
    assert "competition_dummies" in imported_modules(APP / "scripts" / "prepare_data.py")
    for module in ("nodes", "data_table", "data_notes"):
        assert "competition_dummies" in imported_modules(PKG / f"{module}.py")


def test_model_code_does_not_know_the_dummies():
    for module in ("regression", "evaluation", "cricket_explanation", "state"):
        assert "competition_dummies" not in imported_modules(PKG / f"{module}.py")
        assert not {"is_ipl", "is_bbl"} & _string_constants(PKG / f"{module}.py")


def test_the_reusable_web_modules_know_nothing_about_a_model_provider_or_a_key():
    for folder in ("graph-replay", "tab-set", "data-grid"):
        for ts in (APP / "web" / "src" / folder).glob("*.ts"):
            code = re.sub(r"//.*|/\*.*?\*/", "", ts.read_text(encoding="utf-8"), flags=re.S).lower()
            for word in ("openrouter", "api_key", "apikey", "bearer"):
                assert word not in code, f"{ts.name} mentions {word!r}"


def test_the_shared_graph_api_has_no_model_or_limit_knowledge():
    code = (PKG / "graph_api.py").read_text(encoding="utf-8").lower()
    for word in ("openrouter", "api_key", "upstash", "model_options", "x-forwarded-for"):
        assert word not in code, f"graph_api.py mentions {word!r}"


def test_the_key_is_read_in_exactly_one_place():
    """OPENROUTER_API_KEY appears in code only in llm_client.py (and in the scripts and docs that mention it)."""
    def code_lines(f):
        return "\n".join(l for l in f.read_text(encoding="utf-8").splitlines() if not l.lstrip().startswith("#"))

    owners = sorted(f.name for f in PKG.glob("*.py") if "OPENROUTER_API_KEY" in code_lines(f))
    assert owners == ["llm_client.py"]


def test_the_visualiser_holds_no_stage_text():
    """Stage names and questions come from the structure response; no .ts file of the visualiser may contain them."""
    from linreg.stages import STAGES
    phrases = [t for s in STAGES for t in (s.name, s.question)]
    for ts in (APP / "web" / "src" / "graph-replay").glob("*.ts"):
        text = ts.read_text(encoding="utf-8").lower()  # comments included on purpose
        for phrase in phrases:
            assert phrase.lower() not in text, f"{ts.name} contains stage text {phrase!r}"


def test_the_stage_module_is_generic():
    code = (PKG / "stages.py").read_text(encoding="utf-8").lower()
    for word in ("cricket", "innings", "regression", "wicket", "openrouter"):
        assert word not in code, f"stages.py mentions {word!r}"
