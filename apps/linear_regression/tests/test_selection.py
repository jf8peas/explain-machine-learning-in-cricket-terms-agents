"""Forward selection inside one setup: the mechanical rival's building block. Pure code, judged on the rolling checks."""
import numpy as np
import pytest

from linreg import features, selection
from linreg.data_loading import load_innings
from linreg.fitting import Fitter
from linreg.state import SET_LIMIT
from linreg.season_split import rolling_checks
from tests.conftest import make_table

WINDOW, WEIGHTING, INNINGS = "all", "none", "population"


@pytest.fixture(scope="module")
def rolling():
    return rolling_checks(load_innings())


@pytest.fixture(scope="module")
def fitter(rolling):
    return Fitter(rolling)


def brute_force_best_single(rolling, fitter, current):
    """The best single addition, found with numpy directly on each check's rows (no Fitter), first of any tie."""
    best = None
    for f in features.IDS:
        if f in current or fitter.redundant(WINDOW, INNINGS, current + [f]):
            continue
        cols = current + [f]
        errors = []
        for spec in rolling.checks:
            train = rolling.training_rows(spec, WINDOW, INNINGS)
            check = rolling.check_rows(spec)
            design = np.column_stack([np.ones(len(train)), train[cols].to_numpy(float)])
            beta, *_ = np.linalg.lstsq(design, train["final_total"].to_numpy(float), rcond=None)
            pred = np.column_stack([np.ones(len(check)), check[cols].to_numpy(float)]) @ beta
            errors.append(float(np.mean(np.abs(check["final_total"].to_numpy(float) - pred))))
        error = float(np.mean(errors))
        if best is None or error < best[1]:
            best = (f, error)
    return best


def step_of(fitter, current, candidates=None):
    return selection.forward_step_rolling(fitter, WINDOW, WEIGHTING, INNINGS, current, candidates)


def test_the_first_step_adds_the_single_feature_with_the_lowest_average_check_error(rolling, fitter):
    step = step_of(fitter, [])
    feature, error = brute_force_best_single(rolling, fitter, [])
    assert step["feature"] == feature and step["features"] == [feature]
    assert step["mae"] == pytest.approx(error, rel=1e-6)
    assert len(step["checks"]) == 3


def test_each_step_adds_exactly_one_feature_and_matches_a_brute_force_search(rolling, fitter):
    current: list[str] = []
    for _ in range(4):
        step = step_of(fitter, current)
        feature, error = brute_force_best_single(rolling, fitter, current)
        assert step["feature"] == feature and step["mae"] == pytest.approx(error, rel=1e-6)
        assert step["features"] == current + [feature]
        current = step["features"]


def test_it_never_adds_a_feature_that_would_make_the_set_redundant_in_any_check(fitter):
    current: list[str] = []
    while True:
        step = step_of(fitter, current)
        if step is None:
            break
        current = step["features"]
        assert fitter.repeating(WINDOW, INNINGS, current) == []
    assert len(current) <= SET_LIMIT


def test_a_redundant_candidate_is_skipped_even_if_it_would_score_best(fitter):
    step = step_of(fitter, ["wickets_at_10"], candidates=["wickets_in_hand", "fours_at_10"])
    assert step["feature"] == "fours_at_10"
    assert step_of(fitter, ["wickets_at_10"], candidates=["wickets_in_hand"]) is None


def test_the_set_limit_stops_it(fitter):
    full = ["runs_at_10", "wickets_at_10", "fours_at_10", "sixes_at_10", "dot_balls_at_10", "extras_at_10",
            "partnership_runs", "balls_since_last_wicket"]
    assert step_of(fitter, full) is None


def test_ties_go_to_the_first_candidate_offered(fitter, monkeypatch):
    monkeypatch.setattr(fitter, "evaluate", lambda *a: {"mae": 10.0, "r2": 0.5, "checks": []})
    step = step_of(fitter, [], candidates=["sixes_at_10", "fours_at_10", "runs_at_10"])
    assert step["feature"] == "sixes_at_10"          # the first one offered wins a tie


def test_a_different_setup_gives_a_different_answer(fitter):
    a = selection.forward_step_rolling(fitter, "all", "none", "population", [])
    b = selection.forward_step_rolling(fitter, "last_3", "strong", "all", [])
    assert a["mae"] != b["mae"]


def test_it_reads_nothing_from_the_test_year(rolling, monkeypatch):
    from linreg.season_split import Rolling
    monkeypatch.setattr(Rolling, "test_rows", lambda self: pytest.fail("the test year was read"))
    step_of(Fitter(rolling), [])


# --- the node: one visit that leaves one attempt and the build-up ---

@pytest.fixture
def run(run_graph, write_csv):
    from linreg.llm_fake import FakeLlm, reply
    llm = FakeLlm({"fake/steady": [reply(["runs_at_10"], "ok", finished=False), reply(["runs_at_10"], "done", True)]})
    return run_graph({"data_path": write_csv(make_table())}, llm=llm)


def test_the_rival_is_one_visit_that_leaves_one_attempt_and_the_build_up_in_the_grid(run):
    visits = [u for n, u in run if n == "grid_search"]
    assert len(visits) == 1
    update = visits[0]
    assert [a["proposer"] for a in update["attempts"]] == ["forward_selection"]
    assert update["decision"]["branch"] == "done" and "every combination" in update["decision"]["reason"].lower()
    build = update["grid"]["build_up"]
    assert [b["feature"] for b in build] == update["forward_best"]["features"]
    errors = [b["validation_mae"] for b in build]
    assert errors == sorted(errors, reverse=True) and len(set(errors)) == len(errors)     # each step lowered the error
