"""SC-003: every number in the explanation comes from the run's state."""
import re

import pytest

from linreg import cricket_explanation, features
from linreg.state import MARGIN_RUNS
from tests.conftest import make_table

NUM = re.compile(r"-?\d+(?:\.\d+)?")


def final_state(run_graph, initial):
    state: dict = {"attempts": []}
    for _, update in run_graph(initial):
        for k, v in update.items():
            state[k] = state["attempts"] + v if k == "attempts" else v
    return state


def flatten_numbers(obj, out):
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        out.append(float(obj))
    elif isinstance(obj, dict):
        for v in obj.values():
            flatten_numbers(v, out)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            flatten_numbers(v, out)


def check_numbers(state):
    expl = state["explanation"]
    state_numbers: list[float] = []
    flatten_numbers({k: v for k, v in state.items() if k != "explanation"}, state_numbers)
    flatten_numbers(expl["figures"], state_numbers)
    for sentence in expl["sentences"]:
        for token in NUM.findall(sentence):
            decimals = len(token.split(".")[1]) if "." in token else 0
            value = float(token)
            assert any(round(abs(n), decimals) == abs(value) for n in state_numbers), \
                f"{token!r} in {sentence!r} is not in the run state"
    return expl


@pytest.mark.parametrize("mode", ["noisy", "exact_double", "offset"])
def test_every_number_is_in_state(run_graph, write_csv, mode):
    state = final_state(run_graph, {"data_path": write_csv(make_table(mode=mode))})
    check_numbers(state)


def test_every_number_is_in_state_on_real_data(run_graph):
    check_numbers(final_state(run_graph, {}))


def test_figures_match_state_values(run_graph, write_csv):
    state = final_state(run_graph, {"data_path": write_csv(make_table())})
    f = state["explanation"]["figures"]
    assert f["model_mae"] == round(state["model_mae"], 1)
    assert f["baseline_mae"] == round(state["baseline_mae"], 1)
    assert f["test_n"] == state["split"]["test_n"]


def test_most_important_feature_is_ranked_by_coefficient_times_iqr(run_graph, write_csv):
    state = final_state(run_graph, {"data_path": write_csv(make_table())})
    expl = state["explanation"]
    scores = {f: abs(state["coefficients"][f] * state["feature_iqr"][f]) for f in state["features"]}
    assert expl["most_important"] == max(scores, key=scores.get)
    assert features.label(expl["most_important"]) in expl["sentences"][1]


BASE = {
    "features": ["runs_at_10", "wickets_at_10"],
    "coefficients": {"runs_at_10": 1.5, "wickets_at_10": -6.0},
    "feature_iqr": {"runs_at_10": 20.0, "wickets_at_10": 2.0},
    "attempts": [{"features": ["runs_at_10"], "mae": 19.7, "r2": 0.4},
                 {"features": ["runs_at_10", "wickets_at_10"], "mae": 19.2, "r2": 0.42}],
    "split": {"train_n": 400, "test_n": 120, "test_year": 2025, "train_years": [2020, 2024]},
    "baseline_mae": 20.9, "model_mae": 19.2, "r2": 0.42,
}


def build(**over):
    return cricket_explanation.build_explanation({**BASE, **over}, features.labels(), MARGIN_RUNS)


def test_wicket_cost_sentence_when_coefficient_negative():
    e = build()
    assert any("costs about 6.0 runs" in s for s in e["sentences"])


def test_honest_wording_when_wicket_coefficient_not_negative():
    e = build(coefficients={"runs_at_10": 1.5, "wickets_at_10": 2.0})
    s = next(s for s in e["sentences"] if "Surprisingly" in s)
    assert "2.0 runs" in s and "costs about" not in s


def test_no_wicket_sentence_claim_when_wickets_not_in_model():
    e = build(features=["runs_at_10"], coefficients={"runs_at_10": 1.5},
              feature_iqr={"runs_at_10": 20.0}, attempts=BASE["attempts"][:1])
    assert any("did not use wickets" in s for s in e["sentences"])


def test_margin_not_cleared_is_stated_honestly():
    e = build()  # improvement 1.7 < 3
    assert e["comparison"]["beat_baseline"] is True and e["comparison"]["cleared_margin"] is False
    assert any("short of" in s for s in e["sentences"])


def test_model_not_beating_baseline_is_stated_honestly():
    e = build(model_mae=22.0, baseline_mae=20.9)
    assert e["comparison"]["beat_baseline"] is False
    assert any("did not beat the TV projection" in s for s in e["sentences"])


def test_margin_cleared_is_stated():
    e = build(model_mae=15.0, baseline_mae=20.9)
    assert e["comparison"]["cleared_margin"] is True
    assert any("clears" in s for s in e["sentences"])
