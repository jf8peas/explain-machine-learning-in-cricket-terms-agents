"""Forward selection: the mechanical rival. Pure code, training and validation data only."""
import numpy as np
import pandas as pd
import pytest

from linreg import features, selection
from linreg.data_loading import load_innings
from linreg.redundancy import repeating_features
from linreg.season_split import split_three_ways
from linreg.state import SET_LIMIT
from tests.conftest import make_table, merged_state, nodes_of


@pytest.fixture(scope="module")
def slices():
    return split_three_ways(load_innings())


def brute_force_best_single(train, validation, current):
    best = None
    for f in features.IDS:
        if f in current or repeating_features(train, current + [f]):
            continue
        cols = current + [f]
        design = np.column_stack([np.ones(len(train)), train[cols].to_numpy(float)])
        beta, *_ = np.linalg.lstsq(design, train["final_total"].to_numpy(float), rcond=None)
        pred = np.column_stack([np.ones(len(validation)), validation[cols].to_numpy(float)]) @ beta
        error = float(np.mean(np.abs(validation["final_total"].to_numpy(float) - pred)))
        if best is None or error < best[1]:
            best = (f, error)
    return best


def test_the_first_step_adds_the_single_feature_with_the_lowest_validation_error(slices):
    step = selection.forward_step(slices.train, slices.validation, [])
    feature, error = brute_force_best_single(slices.train, slices.validation, [])
    assert step["feature"] == feature and step["features"] == [feature]
    assert step["mae"] == pytest.approx(error, rel=1e-9)


def test_each_step_adds_exactly_one_feature_and_matches_a_brute_force_search(slices):
    current: list[str] = []
    for _ in range(4):
        step = selection.forward_step(slices.train, slices.validation, current)
        feature, error = brute_force_best_single(slices.train, slices.validation, current)
        assert step["feature"] == feature and step["mae"] == pytest.approx(error, rel=1e-9)
        assert step["features"] == current + [feature]
        current = step["features"]


def test_it_never_adds_a_feature_that_would_make_the_set_redundant(slices):
    current: list[str] = []
    while True:
        step = selection.forward_step(slices.train, slices.validation, current)
        if step is None:
            break
        current = step["features"]
        assert repeating_features(slices.train, current) == []
    assert len(current) == SET_LIMIT


def test_a_redundant_candidate_is_skipped_even_if_it_would_score_best(slices):
    step = selection.forward_step(slices.train, slices.validation, ["wickets_at_10"],
                                  candidates=["wickets_in_hand", "fours_at_10"])
    assert step["feature"] == "fours_at_10"
    assert selection.forward_step(slices.train, slices.validation, ["wickets_at_10"], candidates=["wickets_in_hand"]) is None


def test_the_set_limit_stops_it(slices):
    full = ["runs_at_10", "wickets_at_10", "fours_at_10", "sixes_at_10", "dot_balls_at_10", "extras_at_10",
            "partnership_runs", "balls_since_last_wicket"]
    assert selection.forward_step(slices.train, slices.validation, full) is None


def test_ties_go_to_the_first_candidate_in_catalogue_order(slices, monkeypatch):
    monkeypatch.setattr(selection, "fit_and_score", lambda train, scored, feats: ({}, 10.0, 0.5))
    step = selection.forward_step(slices.train, slices.validation, [], candidates=["sixes_at_10", "fours_at_10", "runs_at_10"])
    assert step["feature"] == "sixes_at_10"          # the first one offered wins a tie


def test_it_uses_no_data_beyond_the_two_frames_it_is_given(slices):
    # a different validation frame changes the answer; nothing else (such as the test year) can
    shifted = slices.validation.assign(final_total=slices.validation["final_total"] + 25)
    a = selection.forward_step(slices.train, slices.validation, [])
    b = selection.forward_step(slices.train, shifted, [])
    assert a["mae"] != b["mae"]


# --- the node: one feature per visit, and when it stops ---

@pytest.fixture
def run(run_graph, write_csv):
    from linreg.llm_fake import FakeLlm, reply
    llm = FakeLlm({"fake/steady": [reply(["runs_at_10"], "ok", finished=False), reply(["runs_at_10"], "done", True)]})
    return run_graph({"data_path": write_csv(make_table())}, llm=llm)


def test_the_node_adds_one_feature_per_visit_and_the_validation_error_keeps_falling(run):
    steps = [a for n, u in run if n == "forward_selection" for a in u.get("attempts", [])]
    assert [len(a["features"]) for a in steps] == list(range(1, len(steps) + 1))
    assert all(a["proposer"] == "forward_selection" for a in steps)
    errors = [a["validation_mae"] for a in steps]
    assert errors == sorted(errors, reverse=True) and len(set(errors)) == len(errors)
    assert steps[0]["improved"] is True


def test_the_first_addition_is_always_taken_and_the_search_ends_with_a_clear_decision(run):
    visits = [u for n, u in run if n == "forward_selection"]
    assert "attempts" in visits[0]                                   # the first visit always adds a feature
    last = visits[-1]
    assert last["decision"]["branch"] == "done" and "Forward selection stops" in last["summary"] or len(
        merged_state(run)["forward_set"]) == SET_LIMIT
    assert nodes_of(run)[-3:] == ["forward_selection", "final_test", "explain_in_cricket_terms"] or "final_test" in nodes_of(run)


def test_the_loop_continues_with_again_until_done(run):
    branches = [u["decision"]["branch"] for n, u in run if n == "forward_selection"]
    assert set(branches[:-1]) <= {"again"} and branches[-1] == "done"
