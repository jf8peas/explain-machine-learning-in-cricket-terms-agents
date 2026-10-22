"""No sentence the backend words uses a banned name (feature 021, FR-013): checked on the pieces of a finished run and on the fixed
copy. "forward selection" may appear only as the bracketed technical term. The agent's own reasoning is never looked at."""
import json
import re
from pathlib import Path

import pytest

from linreg import cricket_blocks, headlines, methods, setup_settings, wording
from linreg.hero_text import goal_card
from linreg.methods import BANNED
from tests.test_explanation_numbers import blocks_for, facts_for, state_for

FIXTURES = Path(__file__).resolve().parent.parent / "web" / "tests" / "fixtures"


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
    # the ids ("tv", "broadcaster") are identifiers and keep their names: only the words are checked
    words = [{k: v for k, v in t.items() if k != "id"} for t in [*methods.terms_payload(), *methods.method_defs()]]
    for text in strings([words, methods.definitions()]):
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


@pytest.mark.parametrize("path", [FIXTURES / "fake-run.json"], ids=["fake run fixture"])
def test_a_fake_run_uses_no_banned_name_outside_the_agents_reasoning(path):
    recording = json.loads(path.read_text(encoding="utf-8"))
    for event in recording["events"]:
        for text in strings([event["summary"], without_reasoning(event["changes"])]):
            assert banned_hits(text, allow_forward_in_brackets=True) == [], (event["node"], text[:90])


def test_the_doing_lines_the_goal_card_and_the_result_strip_use_no_banned_name():
    assert [h for text in strings(wording.doing_lines(2026)) for h in banned_hits(text)] == []
    assert [h for text in strings(goal_card(3, 22.5, {"first_year": 2005, "last_year": 2022}, {"year": 2026, "innings": 171})) for h in banned_hits(text)] == []
    for case in json.loads((FIXTURES / "headline_cases.json").read_text(encoding="utf-8")):
        assert banned_hits(" ".join(strings(headlines.build(**case["inputs"])["result_strip"]))) == []


# ---- feature 023: the yardstick is the broadcaster's projection, never "TV" -------------------------------------------------

@pytest.mark.parametrize("text", ["The TV missed by 22 runs.", "Beat the TV.", "the tv said 164", "TV projection", "A tv, a TV's line",
                                  "The TV-style projection"])
def test_a_planted_tv_in_visible_text_is_caught(text):
    assert banned_hits(text), text


@pytest.mark.parametrize("text", ["A television audience.", "Two tvs in the pub.", "The broadcaster's projection misses by 22 runs.",
                                  "tv_gap and tv_test_miss are fact ids"])
def test_words_that_only_contain_the_letters_are_not_caught(text):
    assert banned_hits(text) == [], text


def test_the_server_sends_the_new_patterns_with_no_allowed_region():
    sent = {b["pattern"]: b["allowed_in"] for b in methods.banned_payload()}
    for pattern in (r"\bTV projection\b", r"\bthe TV\b", r"\bTV\b"):
        assert sent[pattern] == []
    assert methods.has_banned("The TV guesses too low.") and not methods.has_banned("The broadcaster guesses too low.")
