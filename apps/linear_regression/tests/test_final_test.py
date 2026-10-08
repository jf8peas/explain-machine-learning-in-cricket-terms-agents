"""The final test: the test year is read once, only here, and each contender is scored once."""
import sys

import pandas as pd
import pytest

from linreg import nodes, selection
from linreg.llm_fake import FakeLlm, reply
from linreg.season_split import split_three_ways
from linreg.state import MARGIN_RUNS
from tests.conftest import make_table, merged_state

SCRIPT = [reply(["runs_at_10"]), reply(["runs_at_10", "wickets_in_hand"]), reply(["runs_at_10"], "enough", True)]


class SpySlices:
    """Wraps the slices and records which function reads the test frame."""

    def __init__(self, inner, log):
        self._inner, self._log = inner, log

    def __getattr__(self, name):
        if name == "test":
            self._log.append(sys._getframe(1).f_code.co_name)
        return getattr(self._inner, name)


@pytest.fixture
def path(write_csv):
    return write_csv(make_table())


def test_the_test_slice_is_read_exactly_once_and_only_inside_final_test(run_graph, path, monkeypatch):
    log: list[str] = []
    real = nodes.split_three_ways
    monkeypatch.setattr(nodes, "split_three_ways", lambda df: SpySlices(real(df), log))
    run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)}))
    assert log == ["final_test"]


def test_each_contender_is_scored_on_the_test_year_once(run_graph, path, monkeypatch):
    seen: list[tuple[int, ...]] = []
    real = selection.fit_and_score

    def spy(train, scored, feats):
        seen.append(tuple(sorted(scored["match_date"].dt.year.unique())) + (tuple(feats),))
        return real(train, scored, feats)

    monkeypatch.setattr(selection, "fit_and_score", spy)
    state = merged_state(run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)})))
    test_year = state["split"]["test_year"]
    on_test = [s for s in seen if s[0] == test_year]
    assert len(on_test) == 2                                                  # the language model's set and forward selection's
    assert {s[1] for s in on_test} == {tuple(state["final"]["sets"]["llm"]), tuple(state["final"]["sets"]["forward"])}
    assert all(s[0] != test_year for s in seen if s not in on_test)           # nothing else touches the test year


def test_the_final_numbers_equal_an_independent_calculation(run_graph, path):
    state = merged_state(run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)})))
    df = pd.read_csv(path, parse_dates=["match_date"])
    s = split_three_ways(df)
    f = state["final"]
    for key in ("llm", "forward"):
        _, error, _ = selection.fit_and_score(s.train, s.test, f["sets"][key])
        assert f["test_mae"][key] == pytest.approx(error, abs=0.006)
    tv = (s.test["runs_at_10"] / 10 * 20 - s.test["final_total"]).abs().mean()
    assert f["test_mae"]["tv"] == pytest.approx(tv, abs=0.006)


def test_the_winner_is_the_lower_test_error_and_the_margin_is_the_gap(run_graph, path):
    f = merged_state(run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)})))["final"]
    llm, fwd = f["test_mae"]["llm"], f["test_mae"]["forward"]
    assert f["winner"] == ("llm" if llm < fwd else "forward")
    assert f["margin"] == pytest.approx(abs(llm - fwd), abs=0.011)
    assert f["winner_mae"] == min(llm, fwd) or llm == fwd


def test_a_tie_goes_to_forward_selection(run_graph, path, monkeypatch):
    real = selection.fit_and_score
    state_years = {}

    def tied(train, scored, feats):
        fitted, error, score = real(train, scored, feats)
        return fitted, (12.5 if scored["match_date"].dt.year.nunique() == 1 and
                        scored["match_date"].dt.year.iloc[0] == state_years.get("test") else error), score

    df = pd.read_csv(path, parse_dates=["match_date"])
    state_years["test"] = split_three_ways(df).test_year
    monkeypatch.setattr(selection, "fit_and_score", tied)
    f = merged_state(run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)})))["final"]
    assert f["test_mae"]["llm"] == f["test_mae"]["forward"] == 12.5
    assert f["winner"] == "forward" and f["margin"] == 0.0


def test_beating_the_tv_projection_needs_the_margin(run_graph, path):
    f = merged_state(run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)})))["final"]
    # the verdict is worked out from the displayed (one-decimal) average misses, so a reader can check it from the page
    shown = f["accuracy"]
    gain = round(shown["broadcaster"]["average_miss"] - shown[f["winner"]]["average_miss"], 1)
    assert f["beat_tv"] is (gain > 0) and f["cleared_margin"] is (gain >= MARGIN_RUNS)
    assert f["improvement"] == gain
    assert gain == pytest.approx(f["test_mae"]["tv"] - f["winner_mae"], abs=0.11)     # and close to the unrounded gap


def test_without_a_language_model_set_forward_selection_wins_by_default(run_graph, path):
    state = merged_state(run_graph({"data_path": path}, llm=FakeLlm({"fake/broken": []}), model_id="fake/broken")
                         if False else run_graph({"data_path": path}, model_id="fake/broken"))
    f = state["final"]
    assert f["winner"] == "forward" and f["llm_took_part"] is False
    assert f["test_mae"]["llm"] is None and f["margin"] is None
    assert state["features"] == f["sets"]["forward"]


def test_the_winners_model_is_fitted_on_the_training_years_for_the_form(run_graph, path):
    state = merged_state(run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)})))
    df = pd.read_csv(path, parse_dates=["match_date"])
    s = split_three_ways(df)
    fitted, _, _ = selection.fit_and_score(s.train, s.test, state["features"])
    for f, c in fitted["coefficients"].items():
        assert state["coefficients"][f] == pytest.approx(c, abs=0.002)
