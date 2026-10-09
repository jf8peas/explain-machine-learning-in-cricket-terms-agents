"""The run's two new jobs: baseline scores the know-nothing guess on the three check years, and final_test scores all four
methods once on the test year and reports how good each is (feature 006)."""
import numpy as np
import pandas as pd
import pytest

from linreg import nodes, regression, scoring
from linreg import accuracy_text
from linreg.goal import reference_finding, verdict, verdict_sentence
from linreg.llm_fake import FakeLlm, reply
from linreg.methods import method_defs
from linreg import setup_settings as cfg
from linreg.season_split import Rolling, rolling_checks
from tests.conftest import make_table, merged_state
from tests.test_final_test import SCRIPT

IDS = ["know_nothing", "broadcaster", "llm", "forward"]


@pytest.fixture
def path(write_csv):
    return write_csv(make_table())


def run(run_graph, path, **config):
    return merged_state(run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)}), **config))


def rolling_of(path):
    return rolling_checks(pd.read_csv(path, parse_dates=["match_date"]))


def fit_of(rolling, best):
    """The reference fit of a best setup on every year before the test year (weights from its recency weighting)."""
    rows = rolling.training_rows(rolling.final, best["window"], best["training_innings"])
    weights = np.array([cfg.weight_for_age(rolling.final.year - y, best["weighting"]) for y in rows["match_date"].dt.year])
    return regression.fit(rows, best["features"], weights=weights)


def by_numpy(actual, predicted):
    """An independent calculation of the displayed figures."""
    a, p = np.asarray(actual, float), np.asarray(predicted, float)
    e = p - a
    return {"n": len(a), "average_miss": round(float(np.abs(e).mean()), 1),
            "within_10": round(float((np.abs(e) <= 10 + 1e-9).mean() * 100), 1),
            "within_20": round(float((np.abs(e) <= 20 + 1e-9).mean() * 100), 1),
            "miss_percent": round(float(np.abs(e).mean() / a.mean() * 100), 1), "bias": round(float(e.mean()), 1)}


# ---- baseline ----

def test_baseline_scores_the_two_references_on_each_check_year_and_averages_them(run_graph, path):
    state = run(run_graph, path)
    rolling = rolling_of(path)
    per_check = []
    for spec in rolling.checks:
        v = rolling.check_rows(spec)
        earlier = rolling.training_rows(spec, "all", "population")["final_total"].mean()      # the mean of earlier innings
        per_check.append({"year": spec.year,
                          "know_nothing": by_numpy(v["final_total"], np.full(len(v), earlier)),
                          "broadcaster": by_numpy(v["final_total"], v["runs_at_10"] / 10 * 20)})
    assert state["reference_validation"]["by_check"] == per_check
    for method in ("know_nothing", "broadcaster"):
        figures = [c[method] for c in per_check]
        expected = {k: (sum(f[k] for f in figures) if k == "n" else round(sum(f[k] for f in figures) / 3, 1))
                    for k in figures[0]}
        assert state["reference_validation"][method] == expected


def test_baseline_mentions_the_know_nothing_guess_and_keeps_its_old_sentence(run_graph, path):
    events = run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)}))
    summary = next(u for n, u in events if n == "baseline")["summary"]
    assert "know-nothing" in summary and "That is the score to beat" in summary


def test_the_test_slice_is_still_read_only_in_final_test(run_graph, path, monkeypatch):
    import sys
    log: list[str] = []
    real = Rolling.test_rows
    monkeypatch.setattr(Rolling, "test_rows", lambda self: (log.append(sys._getframe(1).f_code.co_name), real(self))[1])
    run(run_graph, path)
    assert log == ["final_test"]


# ---- final_test ----

def test_the_accuracy_of_every_method_equals_an_independent_calculation_on_the_test_year(run_graph, path):
    state = run(run_graph, path)
    rolling = rolling_of(path)
    t = rolling.test_rows()
    earlier = rolling.training_rows(rolling.final, "all", "population")["final_total"].mean()
    acc = state["final"]["accuracy"]
    assert acc["know_nothing"] == by_numpy(t["final_total"], np.full(len(t), earlier))
    assert acc["broadcaster"] == by_numpy(t["final_total"], t["runs_at_10"] / 10 * 20)
    for key, best in (("llm", state["llm_best"]), ("forward", state["forward_best"])):
        fitted = fit_of(rolling, best)
        assert acc[key] == by_numpy(t["final_total"], regression.predict(t, fitted["coefficients"], fitted["intercept"]))


def test_the_methods_are_listed_in_display_order_with_their_definitions(run_graph, path):
    f = run(run_graph, path)["final"]
    assert f["methods"] == IDS and list(f["accuracy"]) == IDS
    assert f["method_defs"] == method_defs(IDS)


def test_each_method_is_scored_exactly_once_on_the_test_year(run_graph, path, monkeypatch):
    calls = []
    real = scoring.accuracy
    monkeypatch.setattr(scoring, "accuracy", lambda actual, predicted: (calls.append(len(actual)), real(actual, predicted))[1])
    run(run_graph, path)
    assert calls == [len(rolling_of(path).test_rows())] * 4


def test_the_verdict_comes_from_the_displayed_figures_and_the_old_keys_agree_with_it(run_graph, path):
    f = run(run_graph, path)["final"]
    expected = verdict(f["accuracy"]["broadcaster"]["average_miss"], f["accuracy"][f["winner"]]["average_miss"], f["winner"])
    assert f["verdict"] == expected
    assert (f["beat_tv"], f["cleared_margin"], f["improvement"]) == (expected["beat"], expected["reached"], expected["improvement_runs"])


def test_the_reference_finding_uses_the_test_year_figures_and_has_a_sentence(run_graph, path):
    f = run(run_graph, path)["final"]
    kn, tv = f["accuracy"]["know_nothing"]["average_miss"], f["accuracy"]["broadcaster"]["average_miss"]
    rf = f["reference_finding"]
    assert {k: rf[k] for k in ("finding", "gap_runs", "gap_percent")} == reference_finding(kn, tv)
    assert rf["sentence"].strip() and "TV projection" in rf["sentence"]


def test_the_chart_points_hold_every_test_innings_once_per_method_rounded_to_one_decimal(run_graph, path):
    state = run(run_graph, path)
    t = rolling_of(path).test_rows()
    pts = state["chart_points"]
    assert pts["actual"] == [round(float(x), 1) for x in t["final_total"]]
    assert list(pts["predicted"]) == IDS
    for values in pts["predicted"].values():
        assert len(values) == len(t) and all(round(v, 1) == v for v in values)
    assert set(pts) == {"actual", "predicted"}


def test_the_figures_use_unrounded_predictions_not_the_rounded_chart_points(run_graph, path):
    state = run(run_graph, path)
    pts = state["chart_points"]
    from_points = by_numpy(pts["actual"], pts["predicted"]["forward"])
    stored = state["final"]["accuracy"]["forward"]
    rolling = rolling_of(path)
    test = rolling.test_rows()
    fitted = fit_of(rolling, state["forward_best"])
    exact = by_numpy(test["final_total"], regression.predict(test, fitted["coefficients"], fitted["intercept"]))
    assert stored == exact                        # the stored figures are the exact ones
    assert abs(from_points["average_miss"] - exact["average_miss"]) <= 0.1


def test_without_the_language_model_there_are_three_methods_and_it_is_absent_everywhere(run_graph, path):
    state = merged_state(run_graph({"data_path": path}, model_id="fake/broken"))
    f = state["final"]
    assert f["llm_took_part"] is False
    assert f["methods"] == ["know_nothing", "broadcaster", "forward"]
    assert "llm" not in f["accuracy"] and "llm" not in state["chart_points"]["predicted"]
    assert [d["id"] for d in f["method_defs"]] == f["methods"]


def test_an_ordinary_run_has_no_identical_pair_and_the_finding_is_a_plain_yes_or_no(run_graph, path):
    f = run(run_graph, path)["final"]
    assert isinstance(f["identical"], list)
    assert set(f["bias_finding"]) == {"same_direction_large", "direction"}
    assert isinstance(f["bias_finding"]["same_direction_large"], bool)


# ---- the helpers, on made-up numbers ----

def test_methods_with_identical_predictions_are_both_kept_and_listed_as_a_pair():
    preds = {"know_nothing": np.array([1.0, 1.0]), "broadcaster": np.array([1.0, 2.0]),
             "llm": np.array([5.0, 6.0]), "forward": np.array([5.0, 6.0 + 1e-12])}
    assert scoring.identical_pairs(preds) == [["llm", "forward"]]
    assert scoring.identical_pairs({"llm": np.array([1.0]), "forward": np.array([1.001])}) == []


def big(bias):
    return {"average_miss": 10.0, "bias": bias}


def test_the_same_direction_large_bias_finding_ignores_the_know_nothing_guess():
    acc = {"know_nothing": big(0.2), "broadcaster": big(-8.0), "llm": big(-6.0), "forward": big(-7.0)}
    assert scoring.bias_finding(acc) == {"same_direction_large": True, "direction": "low"}


def test_mixed_directions_or_a_small_bias_among_the_methods_that_use_the_score_report_no_finding():
    assert scoring.bias_finding({"know_nothing": big(0.0), "broadcaster": big(-8.0), "forward": big(8.0)}) == \
        {"same_direction_large": False, "direction": None}
    assert scoring.bias_finding({"broadcaster": big(-8.0), "forward": big(-1.0)}) == \
        {"same_direction_large": False, "direction": None}


def test_the_finding_works_with_the_projection_and_one_model_when_the_language_model_is_absent():
    assert scoring.bias_finding({"know_nothing": big(0.0), "broadcaster": big(6.0), "forward": big(7.0)}) == \
        {"same_direction_large": True, "direction": "high"}


def test_the_final_state_carries_the_words_the_page_shows(run_graph, path):
    f = run(run_graph, path)["final"]
    assert f["verdict_sentence"] == verdict_sentence(f["verdict"])
    assert f["bias_words"] == {m: accuracy_text.bias_words(f["accuracy"][m]["bias"]) for m in f["methods"]}
    if f["bias_finding"]["same_direction_large"]:
        assert f["bias_sentence"] == accuracy_text.large_bias_sentence(f["bias_finding"]["direction"])
    else:
        assert f["bias_sentence"] is None


def test_the_bias_sentence_appears_exactly_when_the_finding_fires():
    acc = {"broadcaster": big(-8.0), "forward": big(-7.0), "know_nothing": big(0.0)}
    assert scoring.bias_finding(acc)["same_direction_large"] is True
    assert scoring.bias_sentence(scoring.bias_finding(acc)) == accuracy_text.large_bias_sentence("low")
    assert scoring.bias_sentence({"same_direction_large": False, "direction": None}) is None
