"""Checks against the committed innings.csv and the fake model: a whole run on the real data."""
import pytest

from linreg.state import ROUND_CAP, SET_LIMIT
from tests.conftest import merged_state, nodes_of


@pytest.fixture(scope="module")
def real_run():
    from linreg.graph import build_graph
    from linreg.llm_fake import default_fake
    from tests.conftest import make_config
    from linreg.state import RECURSION_LIMIT
    events = []
    for chunk in build_graph(default_fake()).stream(
            {}, stream_mode="updates", config={"recursion_limit": RECURSION_LIMIT, "configurable": make_config()}):
        (node, update), = chunk.items()
        events.append((node, update))
    return events


def test_a_whole_run_on_the_real_data_finishes_with_three_test_errors(real_run):
    state = merged_state(real_run)
    assert nodes_of(real_run)[-2:] == ["final_test", "explain_in_cricket_terms"]
    errors = state["final"]["test_mae"]
    assert errors["llm"] > 0 and errors["forward"] > 0 and errors["tv"] > 0
    assert state["final"]["winner"] in ("llm", "forward")


def test_forward_selection_beats_the_tv_projection_on_the_test_year(real_run):
    errors = merged_state(real_run)["final"]["test_mae"]
    assert errors["forward"] < errors["tv"]


def test_the_run_shape_respects_the_caps(real_run):
    state = merged_state(real_run)
    assert 1 <= state["rounds_used"] <= ROUND_CAP
    forward = [a for a in state["attempts"] if a["proposer"] == "forward_selection"]
    assert forward == [state["forward_best"]] and 1 <= len(forward[0]["features"]) <= SET_LIMIT   # the grid's best cell
    assert len(state["grid"]["cells"]) == 24 and nodes_of(real_run).count("grid_search") == 1
    assert all(len(a["features"]) <= SET_LIMIT for a in state["attempts"])


def test_the_checks_and_the_test_year_on_the_real_data(real_run):
    split = merged_state(real_run)["split"]
    years = [c["year"] for c in split["checks"]]
    assert years == [split["test_year"] - 3, split["test_year"] - 2, split["test_year"] - 1]
    assert all(c["n"] >= 100 for c in split["checks"]) and split["test_n"] >= 100
    assert all(c["earlier_years"][1] == c["year"] - 1 for c in split["checks"])
    assert split["first_year"] == 2005
