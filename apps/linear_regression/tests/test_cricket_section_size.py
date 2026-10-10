"""The section is short (feature 012): at most half the words of the old list, and the writing call has its own budget."""
import json
from pathlib import Path

import pytest

from linreg.run_budget import MIN_CALL_SECONDS, RunBudget
from tests.conftest import make_table, merged_state
from tests.test_explanation_numbers import blocks_for, facts_for, state_for

OLD = json.loads((Path(__file__).parent / "fixtures" / "old_explanation_sentences.json").read_text(encoding="utf-8"))


def words(text: str) -> int:
    return len(text.split())


def visible_words(blocks) -> int:
    """What a sighted visitor reads: titles, sentences, the badge, each bar's name and value, the large figure, and the
    year strip's labels. The visually hidden text equivalents are not counted."""
    total = 0
    for b in blocks:
        total += words(b["title"]) + sum(words(s) for s in b["sentences"])
        v = b["visual"]
        if "badge" in v:
            total += words(v["badge"])
        for row in v.get("rows", []):
            total += words(row["label"]) + 1
        if "figure" in v:
            total += 2
        for seg in v.get("segments", []):
            total += words(seg["label"]) + (3 if seg["from"] != seg["to"] else 1)
    return total


def test_the_section_is_at_most_half_the_words_of_the_old_list_for_the_same_run(run_graph, write_csv):
    from linreg.llm_fake import default_fake
    events = run_graph({}, llm=default_fake())                              # the real data, as the old list was measured on
    state = merged_state(events)
    old = sum(words(s) for s in OLD["sentences"])
    assert old > 250                                                         # the old list really was long
    new = visible_words(state["explanation"]["blocks"])
    assert new <= old / 2, f"{new} words against {old}"
    template = visible_words(__import__("linreg.cricket_blocks", fromlist=["x"]).build_blocks(
        state["explanation"]["facts"], __import__("linreg.features", fromlist=["x"]).labels(), list(state["features"])))
    assert template <= old / 2, f"template wording: {template} words against {old}"


def test_with_many_features_the_section_still_fits_the_bound():
    many = ("runs_at_10", "wickets_in_hand", "sixes_at_10", "fours_at_10", "partnership_runs", "dot_balls_at_10",
            "extras_at_10", "powerplay_runs")
    state = state_for(features_=many, coefs={f: 1.0 for f in many})
    _, blocks = blocks_for(state)
    assert visible_words(blocks) <= sum(words(s) for s in OLD["sentences"]) / 2


def test_the_writing_call_is_allowed_one_call_beyond_the_proposing_cap_and_counts():
    budget = RunBudget(deadline=float("inf") / 2, max_calls=2, call_timeout=25.0, reserve=0.0)
    assert budget.take_call() and budget.take_call() and budget.take_call() is None     # the proposing cap is unchanged
    assert budget.take_writing_call() is not None and budget.calls == 3
    assert budget.take_writing_call() is None                                           # only one extra call


def test_the_writing_call_gets_the_time_the_deadline_allows_and_none_below_the_minimum():
    now = [100.0]
    budget = RunBudget(deadline=110.0, max_calls=8, call_timeout=25.0, reserve=8.0, clock=lambda: now[0])
    assert budget.take_writing_call() == pytest.approx(9.0)                             # the time left less a one-second reserve
    now[0] = 109.5
    assert budget.take_writing_call() is None                                           # too little time to be worth a call
    assert MIN_CALL_SECONDS > 0.5


def test_proposing_retries_cannot_starve_the_writing_call():
    budget = RunBudget(deadline=float("inf") / 2, max_calls=8, call_timeout=25.0, reserve=0.0)
    while budget.take_call() is not None:
        pass
    assert budget.calls == 8 and budget.take_writing_call() is not None
