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
    assert 1 <= len(forward) <= SET_LIMIT
    assert [len(a["features"]) for a in forward] == list(range(1, len(forward) + 1))   # one feature added a step
    assert all(len(a["features"]) <= SET_LIMIT for a in state["attempts"])


def test_the_slices_on_the_real_data(real_run):
    split = merged_state(real_run)["split"]
    assert split["train_n"] + split["validation_n"] + split["test_n"] == 5146
    assert split["validation_year"] + 1 == split["test_year"]
    assert split["train_years"][1] < split["validation_year"]
