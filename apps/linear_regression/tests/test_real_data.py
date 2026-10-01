"""Checks against the committed innings.csv (SC-001)."""
from linreg.state import FEATURE_ORDER
from tests.test_explanation_numbers import final_state


def test_final_model_beats_the_tv_projection_on_the_test_year(run_graph):
    state = final_state(run_graph, {})
    assert state["model_mae"] < state["baseline_mae"]
    assert state["explanation"]["comparison"]["beat_baseline"] is True


def test_real_run_shape(run_graph):
    events = run_graph({})
    fits = [n for n, _ in events].count("fit_model")
    assert 1 <= fits <= len(FEATURE_ORDER)
    # Recorded for the owner (quickstart step 4): how many fits, and each attempt's error.
    attempts = events[-1][1]["explanation"]
    assert attempts["comparison"]["beat_baseline"]
