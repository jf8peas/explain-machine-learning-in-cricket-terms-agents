from linreg import nodes
from linreg.graph import route_after_evaluate, route_after_load
from linreg.state import FEATURE_ORDER, MARGIN_RUNS
from tests.conftest import make_table


def evaluated(write_csv, mode, features):
    path = write_csv(make_table(mode=mode))
    state = {"data_path": path}
    state.update(nodes.baseline(state))
    state["features"] = features
    state.update(nodes.fit_model(state))
    state.update(nodes.evaluate(state))
    return state


def test_margin_is_one_named_constant():
    assert MARGIN_RUNS == 3


def test_beats_the_margin_goes_to_explain(write_csv):
    s = evaluated(write_csv, "offset", ["runs_at_10"])  # perfect model, poor projection
    assert s["baseline_mae"] - s["model_mae"] >= MARGIN_RUNS
    assert route_after_evaluate(s) == "explain"
    assert "clears" in s["decision"]["reason"]


def test_misses_the_margin_with_features_left_goes_to_tune(write_csv):
    s = evaluated(write_csv, "exact_double", ["runs_at_10"])  # projection perfect
    assert s["baseline_mae"] - s["model_mae"] < MARGIN_RUNS
    assert route_after_evaluate(s) == "tune"
    assert "more features" in s["decision"]["reason"]


def test_misses_the_margin_with_no_features_left_goes_to_explain(write_csv):
    s = evaluated(write_csv, "exact_double", list(FEATURE_ORDER))
    assert route_after_evaluate(s) == "explain"
    assert "no more features" in s["decision"]["reason"]


def test_route_after_load():
    assert route_after_load({"data_error": "bad"}) == "stop"
    assert route_after_load({"data_error": None}) == "ok"
