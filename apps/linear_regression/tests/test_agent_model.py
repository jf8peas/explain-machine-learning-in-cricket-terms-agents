"""The agent's own final model (feature 020): the final test also emits the agent's refitted model for the page's "Your turn",
adds headlines and the agent's verdict, and changes no score and no top-level winner field."""
import numpy as np
import pandas as pd
import pytest

from linreg import headlines, regression
from linreg import setup_settings as cfg
from linreg.llm_fake import FakeLlm, reply
from linreg.season_split import rolling_checks
from linreg.state import MARGIN_RUNS
from tests.conftest import make_table, merged_state

SCRIPT = [reply(["runs_at_10"]), reply(["runs_at_10", "wickets_in_hand"]), reply(["runs_at_10"], "enough", True)]


@pytest.fixture
def path(write_csv):
    return write_csv(make_table())


def run(run_graph, path, **kw):
    return merged_state(run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)}), **kw))


def test_the_agent_model_is_the_language_models_refit(run_graph, path):
    state = run(run_graph, path)
    final, best = state["final"], state["llm_best"]
    model = final["agent_model"]
    assert model["source"] == "agent" and model["features"] == final["sets"]["llm"] == list(best["features"])
    rolling = rolling_checks(pd.read_csv(path, parse_dates=["match_date"]))
    rows = rolling.training_rows(rolling.final, best["window"], best["training_innings"])
    weights = np.array([cfg.weight_for_age(rolling.final.year - y, best["weighting"]) for y in rows["match_date"].dt.year])
    fit = regression.fit(rows, model["features"], weights=weights)
    assert model["intercept"] == pytest.approx(fit["intercept"], abs=0.001)
    for feature, value in model["coefficients"].items():
        assert value == pytest.approx(fit["coefficients"][feature], abs=0.001)


def test_the_agent_model_predicts_with_the_scored_fit(run_graph, path):
    """The model on the page reproduces the agent's displayed test miss to within rounding of its coefficients."""
    state = run(run_graph, path)
    final, model = state["final"], state["final"]["agent_model"]
    test = rolling_checks(pd.read_csv(path, parse_dates=["match_date"])).test_rows()
    predicted = regression.predict(test, model["coefficients"], model["intercept"])
    assert float(np.mean(np.abs(test["final_total"] - predicted))) == pytest.approx(final["accuracy"]["llm"]["average_miss"], abs=0.1)


def test_the_top_level_fields_stay_the_picks(run_graph, path):
    state = run(run_graph, path)
    final = state["final"]
    assert state["features"] == final["sets"][final["winner"]]
    assert set(state["coefficients"]) == set(final["sets"][final["winner"]])


def test_the_search_stands_in_when_no_language_model_took_part(run_graph, path):
    state = merged_state(run_graph({"data_path": path}, llm_allowed=False))
    final = state["final"]
    assert not final["llm_took_part"]
    model = final["agent_model"]
    assert model["source"] == "search" and model["features"] == final["sets"]["forward"]
    assert final["agent_verdict"] is None and final["headlines"]["case"] == "no_llm"


def test_the_agent_verdict_and_headlines_are_worked_out_from_the_displayed_figures(run_graph, path):
    final = run(run_graph, path)["final"]
    shown = final["accuracy"]
    tv, agent = shown["broadcaster"]["average_miss"], shown["llm"]["average_miss"]
    v = final["agent_verdict"]
    assert v["winner"] == "llm" and v["improvement_runs"] == round(tv - agent, 1)
    assert v["reached"] is (round(tv - agent, 1) >= MARGIN_RUNS) and v["beat"] is (round(tv - agent, 1) > 0)
    assert final["headlines"]["case"] == headlines.case_for(agent, tv)
    assert final["headlines"]["hero_h1"] == headlines.HERO_H1[final["headlines"]["case"]]


def test_the_pick_s_verdict_is_kept_beside_the_agent_s(run_graph, path):
    final = run(run_graph, path)["final"]
    assert final["verdict"]["winner"] == final["winner"] and "verdict_sentence" in final
    assert final["agent_verdict"]["winner"] == "llm"


def test_tries_count_every_proposal_rejected_ones_included(run_graph, path):
    state = run(run_graph, path)
    tries = state["rounds_used"]
    assert tries >= len(state["attempts"]) - 1                    # fitted rounds plus any rejected ones
    expected = "1 try" if tries == 1 else f"{tries} tries"
    assert state["final"]["headlines"]["scoreboard"]["facts"][0]["text"] == expected
