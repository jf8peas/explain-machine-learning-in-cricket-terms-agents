"""The agent's loop end to end against a scripted fake model: order, proposals, evaluations and stopping rules."""
import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import LinearRegression

from linreg.llm_fake import FakeLlm, reply
from linreg.season_split import split_three_ways
from linreg.state import ROUND_CAP
from tests.conftest import make_table, merged_state, nodes_of

MODEL = "fake/steady"


@pytest.fixture
def path(write_csv):
    return write_csv(make_table())


def run(run_graph, path, *replies, **config):
    llm = FakeLlm({MODEL: list(replies)})
    events = run_graph({"data_path": path}, llm=llm, **config)
    return events, llm


GOOD = [reply(["runs_at_10"], "Start with the runs on the board."),
        reply(["runs_at_10", "wickets_in_hand"], 'Wickets in hand matter, "especially" <i>late</i>.'),
        reply(["runs_at_10", "wickets_in_hand"], "That is enough.", finished=True)]


def test_the_nodes_run_in_the_expected_order(run_graph, path):
    events, _ = run(run_graph, path, *GOOD)
    names = nodes_of(events)
    assert names[:12] == ["load_data", "split", "explore", "baseline", "propose_features", "check_proposal", "fit_model",
                          "evaluate", "propose_features", "check_proposal", "fit_model", "evaluate"]
    assert names[12:14] == ["propose_features", "check_proposal"]           # the model says it is finished
    assert set(names[14:-2]) == {"forward_selection"} and len(names[14:-2]) >= 1
    assert names[-2:] == ["final_test", "explain_in_cricket_terms"]


def test_a_proposal_event_holds_the_features_and_the_reason_verbatim(run_graph, path):
    events, _ = run(run_graph, path, *GOOD)
    proposals = [u["proposal"] for n, u in events if n == "propose_features"]
    assert proposals[1]["features"] == ["runs_at_10", "wickets_in_hand"]
    assert proposals[1]["reason"] == 'Wickets in hand matter, "especially" <i>late</i>.'
    assert proposals[2]["finished"] is True


def test_each_evaluation_has_a_validation_error_and_an_improved_flag(run_graph, path):
    events, _ = run(run_graph, path, *GOOD)
    attempts = [a for n, u in events if n == "evaluate" for a in u["attempts"]]
    assert [a["features"] for a in attempts] == [["runs_at_10"], ["runs_at_10", "wickets_in_hand"]]
    assert all(a["proposer"] == "llm" for a in attempts)
    assert attempts[0]["improved"] is True                       # the first set is the best so far
    assert all(isinstance(a["validation_mae"], float) and a["validation_mae"] > 0 for a in attempts)


def test_the_numbers_come_from_code_and_match_an_independent_fit(run_graph, path):
    events, _ = run(run_graph, path, *GOOD)
    df = pd.read_csv(path, parse_dates=["match_date"])
    s = split_three_ways(df)
    attempt = [a for n, u in events if n == "evaluate" for a in u["attempts"]][1]
    cols = attempt["features"]
    model = LinearRegression().fit(s.train[cols], s.train["final_total"])
    pred = model.predict(s.validation[cols])
    assert attempt["validation_mae"] == pytest.approx(np.mean(np.abs(s.validation["final_total"] - pred)), abs=0.006)
    fitted = [u for n, u in events if n == "fit_model"][1]
    assert fitted["intercept"] == pytest.approx(model.intercept_, abs=0.002)
    for c, v in zip(cols, model.coef_):
        assert fitted["coefficients"][c] == pytest.approx(v, abs=0.002)


def test_explore_and_baseline_use_the_training_and_validation_years_only(run_graph, path):
    events, _ = run(run_graph, path, *GOOD)
    state = merged_state(events)
    df = pd.read_csv(path, parse_dates=["match_date"])
    s = split_three_ways(df)
    assert state["split"]["train_n"] == len(s.train) and state["split"]["validation_n"] == len(s.validation)
    assert state["explore"]["train_n"] == len(s.train)
    assert state["explore"]["corr_with_total"]["runs_at_10"] == pytest.approx(
        s.train["runs_at_10"].corr(s.train["final_total"]), abs=0.001)
    tv = (s.validation["runs_at_10"] / 10 * 20 - s.validation["final_total"]).abs().mean()
    assert state["baseline_validation_mae"] == pytest.approx(tv, abs=0.006)


def test_the_model_saying_finished_ends_the_loop_and_is_noted(run_graph, path):
    events, llm = run(run_graph, path, *GOOD)
    state = merged_state(events)
    assert len(llm.requests) == 3
    assert [r["outcome"] for r in state["rounds"]] == ["fit", "fit", "finished"]
    assert state["llm_status"] == "ok" and state["rounds_used"] == 3


def test_two_rounds_in_a_row_without_improvement_end_the_loop(run_graph, path):
    events, llm = run(run_graph, path,
                      reply(["runs_at_10"]), reply(["fours_at_10"]), reply(["sixes_at_10"]), reply(["extras_at_10"]))
    assert len(llm.requests) == 3                                  # the fourth is never asked for
    evaluations = [u for n, u in events if n == "evaluate"]
    assert [u["decision"]["branch"] for u in evaluations] == ["continue", "continue", "stop"]
    assert "two rounds in a row" in evaluations[-1]["summary"]
    assert [a["improved"] for u in evaluations for a in u["attempts"]] == [True, False, False]


def test_the_round_cap_counts_rejected_proposals(run_graph, path):
    events, llm = run(run_graph, path, *[reply(["no_such_feature"])] * 8)
    state = merged_state(events)
    assert len(llm.requests) == ROUND_CAP == 6
    assert "fit_model" not in nodes_of(events)
    assert len(state["rejections"]) == 6 and all(r["code"] == "unknown_feature" for r in state["rejections"])
    assert [r["outcome"] for r in state["rounds"]] == ["rejected"] * 6
    assert state["rounds_used"] == 6


def test_rejections_and_fits_share_the_round_cap(run_graph, path):
    replies = [reply(["runs_at_10"]), reply(["runs_at_10"]), reply(["wickets_at_10"]), reply([]), reply(["wickets_at_10"]),
               reply(["runs_at_10", "wickets_at_10"]), reply(["fours_at_10"])]
    events, llm = run(run_graph, path, *replies)
    assert len(llm.requests) == 6
    state = merged_state(events)
    assert [r["outcome"] for r in state["rounds"]] == ["fit", "rejected", "fit", "rejected", "rejected", "fit"]
    assert state["rounds_used"] == 6
    assert [r["code"] for r in state["rejections"]] == ["already_tried", "empty", "already_tried"]


def test_a_rejection_is_shown_to_the_model_on_the_next_round(run_graph, path):
    _, llm = run(run_graph, path, reply(["no_such_feature"]), reply(["runs_at_10"]), reply(["runs_at_10"], "ok", True))
    second = llm.requests[1].user
    assert "REJECTED PROPOSALS" in second and "no_such_feature" in second and "not in the catalogue" in second


def test_the_history_shown_to_the_model_has_validation_errors_from_code(run_graph, path):
    events, llm = run(run_graph, path, *GOOD)
    first = [a for n, u in events if n == "evaluate" for a in u["attempts"]][0]
    assert str(first["validation_mae"]) in llm.requests[1].user


def test_the_fitted_model_in_focus_is_the_winners_at_the_end(run_graph, path):
    state = merged_state(run(run_graph, path, *GOOD)[0])
    assert state["features"] == state["final"]["sets"][state["final"]["winner"]]
    assert set(state["coefficients"]) == set(state["features"])
    assert "explanation" in state and state["explanation"]["sentences"]
