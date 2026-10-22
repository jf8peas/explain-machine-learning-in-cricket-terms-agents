"""No sentence the backend words uses a banned name (feature 021, FR-013): checked on the pieces of a finished run and on the fixed
copy. "forward selection" may appear only as the bracketed technical term. The agent's own reasoning is never looked at."""
import json
import re
from pathlib import Path

import pytest

from linreg import cricket_blocks, headlines, methods, setup_settings
from linreg.methods import BANNED
from tests.test_explanation_numbers import blocks_for, facts_for, state_for

FIXTURES = Path(__file__).resolve().parent.parent / "web" / "tests" / "fixtures"
SHIPPED = Path(__file__).resolve().parent.parent / "web" / "public" / "recorded-run.json"


def strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from strings(v)


def banned_hits(text: str, allow_forward_in_brackets: bool = False) -> list[str]:
    hits = []
    for b in BANNED:
        for m in re.finditer(b.pattern, text, re.IGNORECASE):
            if allow_forward_in_brackets and b.allowed_in and "(" in text[:m.start()] and ")" in text[m.end():]:
                continue
            hits.append(m.group(0))
    return hits


def test_the_terms_definitions_and_method_defs_use_no_banned_name():
    for text in strings([methods.terms_payload(), methods.method_defs()]):
        assert [h for h in banned_hits(text) if h.lower() != "forward selection"] == [], text     # a technical term is what goes in brackets
    for key, text in methods.definitions().items():
        assert [h for h in banned_hits(text) if h.lower() != "forward selection"] == [], (key, text)


def test_the_headline_words_use_no_banned_name():
    for case in json.loads((FIXTURES / "headline_cases.json").read_text(encoding="utf-8")):
        assert banned_hits(" ".join(strings(headlines.build(**case["inputs"])))) == []


def test_the_explanation_blocks_and_facts_use_no_banned_name():
    state = state_for()
    facts, blocks = facts_for(state), blocks_for(state)[1]
    for text in strings([facts, blocks]):
        assert banned_hits(text) == [], text


def test_the_grid_note_names_forward_selection_only_in_brackets():
    assert banned_hits(setup_settings.HYPERPARAMETER_NOTE) == ["forward selection"]
    assert "(grid search with forward selection)" in setup_settings.HYPERPARAMETER_NOTE


def without_reasoning(changes: dict) -> dict:
    """The step's changes with the agent's own reasoning taken out (it is shown exactly as written)."""
    out = dict(changes)
    if out.get("proposal"):
        out["proposal"] = {k: v for k, v in out["proposal"].items() if k != "reason"}
    for key in ("rounds", "rejections"):
        if key in out:
            out[key] = [{k: v for k, v in r.items() if k != "reason" or key == "rejections"} for r in out[key]]
    return out


@pytest.mark.parametrize("path", [SHIPPED, FIXTURES / "recorded-run.fake.json"], ids=["shipped", "fake fixture"])
def test_the_recorded_run_uses_no_banned_name_outside_the_agents_reasoning(path):
    recording = json.loads(path.read_text(encoding="utf-8"))
    for event in recording["events"]:
        for text in strings([event["summary"], without_reasoning(event["changes"])]):
            assert banned_hits(text, allow_forward_in_brackets=True) == [], (event["node"], text[:90])
