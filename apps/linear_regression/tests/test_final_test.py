"""The final test: the test year is read once, only here; the winner was already chosen on validation error; each contender
is refitted on every year before the test year and scored once on the test-population innings of the test year."""
import sys

import numpy as np
import pandas as pd
import pytest

from linreg import nodes, regression, selection
from linreg import setup_settings as cfg
from linreg.evaluation import know_nothing_guess, mae
from linreg.llm_fake import FakeLlm, reply
from linreg.season_split import Rolling, rolling_checks
from linreg.state import MARGIN_RUNS
from tests.conftest import make_table, merged_state

SCRIPT = [reply(["runs_at_10"]), reply(["runs_at_10", "wickets_in_hand"]), reply(["runs_at_10"], "enough", True)]


@pytest.fixture
def path(write_csv):
    return write_csv(make_table())


def run(run_graph, path, **kw):
    return merged_state(run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)}), **kw))


def rolling_of(path):
    df = pd.read_csv(path, parse_dates=["match_date"])
    return rolling_checks(df)


def test_the_test_slice_is_read_exactly_once_and_only_inside_final_test(run_graph, path, monkeypatch):
    log: list[str] = []
    real = Rolling.test_rows

    def spy(self):
        log.append(sys._getframe(1).f_code.co_name)
        return real(self)

    monkeypatch.setattr(Rolling, "test_rows", spy)
    run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)}))
    assert log == ["final_test"]


def test_the_winner_is_decided_before_the_test_slice_is_read(run_graph, path, monkeypatch):
    order: list[str] = []
    real_winner, real_rows = selection.validation_winner, Rolling.test_rows
    monkeypatch.setattr(selection, "validation_winner", lambda *a: (order.append("winner"), real_winner(*a))[1])
    monkeypatch.setattr(Rolling, "test_rows", lambda self: (order.append("test_rows"), real_rows(self))[1])
    run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)}))
    assert order == ["winner", "test_rows"]


def test_each_contender_is_scored_on_the_test_years_population_innings_once(run_graph, path, monkeypatch):
    seen: list[tuple[int, int]] = []
    real = regression.predict

    def spy(df, coefficients, intercept):
        years = tuple(sorted(df["match_date"].dt.year.unique()))
        seen.append((years, len(df)))
        return real(df, coefficients, intercept)

    monkeypatch.setattr(regression, "predict", spy)
    state = run(run_graph, path)
    test_year, n = state["split"]["test_year"], state["split"]["test_n"]
    on_test = [s for s in seen if s[0] == (test_year,)]
    assert len(on_test) >= 2                                              # the language model's setup and forward selection's
    assert all(count == n for _, count in on_test)                        # all of the test-population innings, nothing else


def test_the_final_numbers_equal_an_independent_calculation(run_graph, path):
    state = run(run_graph, path)
    rolling = rolling_of(path)
    f = state["final"]
    test = rolling.test_rows()
    for key in ("llm", "forward"):
        best = state["llm_best"] if key == "llm" else state["forward_best"]
        rows = rolling.training_rows(rolling.final, best["window"], best["training_innings"])
        assert set(rows["match_date"].dt.year) <= set(rolling.final.earlier_years)       # only years before the test year
        weights = np.array([cfg.weight_for_age(rolling.final.year - y, best["weighting"]) for y in rows["match_date"].dt.year])
        fit = regression.fit(rows, f["sets"][key], weights=weights)
        predicted = regression.predict(test, fit["coefficients"], fit["intercept"])
        assert f["test_mae"][key] == pytest.approx(mae(test["final_total"], predicted), abs=0.006)
    assert f["test_mae"]["tv"] == pytest.approx((test["runs_at_10"] / 10 * 20 - test["final_total"]).abs().mean(), abs=0.006)


def test_the_know_nothing_guess_is_the_mean_of_test_population_innings_before_the_test_year(run_graph, path):
    state = run(run_graph, path)
    rolling = rolling_of(path)
    earlier = rolling.training_rows(rolling.final, "all", "population")["final_total"]
    test = rolling.test_rows()
    shown = state["final"]["accuracy"]["know_nothing"]
    expected = float(np.mean(np.abs(test["final_total"] - know_nothing_guess(earlier, len(test)))))
    assert shown["average_miss"] == pytest.approx(expected, abs=0.06) and shown["n"] == len(test)


def test_the_winner_is_the_lower_average_validation_error_and_is_chosen_before_the_test(run_graph, path):
    state = run(run_graph, path)
    f = state["final"]
    llm_error, forward_error = state["llm_best"]["validation_mae"], state["forward_best"]["validation_mae"]
    assert f["winner"] == ("forward" if forward_error < llm_error else "llm")
    assert f["winner_chosen_on"] == "validation" and f["validation_mae"] == {"llm": llm_error, "forward": forward_error}
    assert state["validation_winner"]["winner"] == f["winner"]
    # both models stay in the results, with the test error of each; the margin is the gap on the test year
    assert f["test_mae"]["llm"] is not None and f["test_mae"]["forward"] is not None
    assert f["margin"] == pytest.approx(abs(f["test_mae"]["llm"] - f["test_mae"]["forward"]), abs=0.011)
    assert f["winner_mae"] == f["test_mae"][f["winner"]]


def test_the_test_error_plays_no_part_in_choosing_the_winner(run_graph, path, monkeypatch):
    """Whichever model the checks prefer wins even when the other would do better on the test year."""
    real = nodes.regression.predict

    def fake_decision(llm_best, forward_best):
        return {"winner": "forward", "reason": "forced for the test", "chosen_on": "validation"}

    monkeypatch.setattr(selection, "validation_winner", fake_decision)
    f = run(run_graph, path)["final"]
    assert f["winner"] == "forward" and f["winner_mae"] == f["test_mae"]["forward"]
    assert real is nodes.regression.predict


def test_a_tie_on_validation_goes_to_the_language_model():
    best = {"validation_mae": 17.25}
    assert selection.validation_winner(dict(best), dict(best))["winner"] == "llm"
    assert selection.validation_winner({"validation_mae": 17.30}, {"validation_mae": 17.25})["winner"] == "forward"
    assert selection.validation_winner({"validation_mae": 17.20}, {"validation_mae": 17.25})["winner"] == "llm"
    assert selection.validation_winner(None, best)["winner"] == "forward"
    assert selection.validation_winner(best, None)["winner"] == "llm"


def test_beating_the_tv_projection_needs_the_margin(run_graph, path):
    f = run(run_graph, path)["final"]
    # the verdict is worked out from the displayed (one-decimal) average misses, so a reader can check it from the page
    shown = f["accuracy"]
    gain = round(shown["broadcaster"]["average_miss"] - shown[f["winner"]]["average_miss"], 1)
    assert f["beat_tv"] is (gain > 0) and f["cleared_margin"] is (gain >= MARGIN_RUNS)
    assert f["improvement"] == gain
    assert gain == pytest.approx(f["test_mae"]["tv"] - f["winner_mae"], abs=0.11)     # and close to the unrounded gap


def test_without_a_language_model_forward_selection_wins_by_default(run_graph, path):
    state = merged_state(run_graph({"data_path": path}, model_id="fake/broken"))
    f = state["final"]
    assert f["winner"] == "forward" and f["llm_took_part"] is False
    assert f["test_mae"]["llm"] is None and f["margin"] is None
    assert state["features"] == f["sets"]["forward"]


def test_the_winners_model_is_refitted_on_every_year_before_the_test_year_for_the_form(run_graph, path):
    state = run(run_graph, path)
    rolling = rolling_of(path)
    best = state["llm_best"] if state["final"]["winner"] == "llm" else state["forward_best"]
    rows = rolling.training_rows(rolling.final, best["window"], best["training_innings"])
    weights = np.array([cfg.weight_for_age(rolling.final.year - y, best["weighting"]) for y in rows["match_date"].dt.year])
    fit = regression.fit(rows, state["features"], weights=weights)
    for name, value in fit["coefficients"].items():
        assert state["coefficients"][name] == pytest.approx(value, abs=0.002)
