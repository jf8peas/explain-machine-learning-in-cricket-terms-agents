"""The agent's loop end to end against a scripted fake model: order, proposals, evaluations and stopping rules."""
import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import LinearRegression

from linreg.llm_fake import FakeLlm, reply
from linreg import setup_settings as cfg
from linreg.fitting import Fitter
from linreg.season_split import rolling_checks
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
    assert names[14:-2] == ["grid_search"]                                   # the rival: one visit
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


def rolling_of(path):
    return rolling_checks(pd.read_csv(path, parse_dates=["match_date"]))


def test_the_numbers_come_from_code_and_match_an_independent_fit(run_graph, path):
    events, _ = run(run_graph, path, *GOOD)
    rolling = rolling_of(path)
    attempt = [a for n, u in events if n == "evaluate" for a in u["attempts"]][1]
    cols = attempt["features"]
    errors = []
    for spec in rolling.checks:
        train = rolling.training_rows(spec, attempt["window"], attempt["training_innings"])
        model = LinearRegression().fit(train[cols], train["final_total"])
        check = rolling.check_rows(spec)
        errors.append(float(np.mean(np.abs(check["final_total"] - model.predict(check[cols])))))
    assert [c["year"] for c in attempt["checks"]] == [spec.year for spec in rolling.checks]
    assert [c["mae"] for c in attempt["checks"]] == pytest.approx(errors, abs=0.006)
    assert attempt["validation_mae"] == pytest.approx(np.mean(errors), abs=0.006)
    last = rolling.checks[-1]
    train = rolling.training_rows(last, "all", "population")
    model = LinearRegression().fit(train[cols], train["final_total"])
    fitted = [u for n, u in events if n == "fit_model"][1]
    assert fitted["intercept"] == pytest.approx(model.intercept_, abs=0.002)
    for c, v in zip(cols, model.coef_):
        assert fitted["coefficients"][c] == pytest.approx(v, abs=0.002)


def test_explore_and_baseline_use_the_years_before_the_test_year_and_the_three_checks(run_graph, path):
    events, _ = run(run_graph, path, *GOOD)
    state = merged_state(events)
    df = pd.read_csv(path, parse_dates=["match_date"])
    rolling = rolling_checks(df)
    split = state["split"]
    assert split["test_year"] == rolling.test_year and split["test_n"] == rolling.n_test
    assert [(c["year"], c["n"]) for c in split["checks"]] == [(c.year, rolling.n_check[c.year]) for c in rolling.checks]
    assert all(c["earlier_years"][1] == c["year"] - 1 for c in split["checks"])
    before = df[(df["match_date"].dt.year < rolling.test_year) & (df["in_test_population"] == 1)]
    assert state["explore"]["train_n"] == len(before)
    assert state["explore"]["corr_with_total"]["runs_at_10"] == pytest.approx(
        before["runs_at_10"].corr(before["final_total"]), abs=0.001)
    assert set(state["explore"]["mean_total_by_year"]) == {int(y) for y in before["match_date"].dt.year.unique()}
    assert rolling.test_year not in state["explore"]["mean_total_by_year"]
    per_check = [(rolling.check_rows(c)["runs_at_10"] / 10 * 20 - rolling.check_rows(c)["final_total"]).abs().mean()
                 for c in rolling.checks]
    assert state["baseline_validation_mae"] == pytest.approx(np.mean(per_check), abs=0.006)
    by_check = state["reference_validation"]["by_check"]
    assert [c["year"] for c in by_check] == [c.year for c in rolling.checks]
    assert set(state["reference_validation"]) == {"know_nothing", "broadcaster", "by_check"}


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


# --- the full setup (feature 008) ---------------------------------------------------------------------------------

def test_a_full_setup_is_carried_through_the_rounds_attempts_and_the_best_so_far(run_graph, path):
    events, _ = run(run_graph, path,
                    reply(["runs_at_10"], "Start.", window="last_5", weighting="gentle", training_innings="all"),
                    reply(["runs_at_10", "wickets_in_hand"], "More.", window="last_3", weighting="strong"),
                    reply(["runs_at_10"], "Enough.", finished=True))
    state = merged_state(events)
    assert [(r["window"], r["weighting"], r["training_innings"]) for r in state["rounds"][:2]] == [
        ("last_5", "gentle", "all"), ("last_3", "strong", "population")]
    attempts = [a for n, u in events if n == "evaluate" for a in u["attempts"]]
    assert [(a["window"], a["weighting"], a["training_innings"]) for a in attempts] == [
        ("last_5", "gentle", "all"), ("last_3", "strong", "population")]
    assert all(len(a["checks"]) == 3 for a in attempts)
    best = state["llm_best"]
    assert (best["window"], best["weighting"], best["training_innings"]) in {("last_5", "gentle", "all"), ("last_3", "strong", "population")}


def test_the_setup_chosen_is_the_one_that_is_fitted_and_judged(run_graph, path):
    default, _ = run(run_graph, path, reply(["runs_at_10"], "x", window="all", weighting="none"), reply(["runs_at_10"], "x", True))
    changed, _ = run(run_graph, path, reply(["runs_at_10"], "x", window="last_3", weighting="strong", training_innings="all"),
                     reply(["runs_at_10"], "x", True))
    first = lambda ev: [a for n, u in ev if n == "evaluate" for a in u["attempts"]][0]            # noqa: E731
    assert first(default)["validation_mae"] != first(changed)["validation_mae"]
    rolling = rolling_of(path)
    expected = Fitter(rolling).evaluate("last_3", "strong", "all", ["runs_at_10"])
    assert first(changed)["validation_mae"] == pytest.approx(expected["mae"], abs=0.006)
    coefficient = [u for n, u in changed if n == "fit_model"][0]["coefficients"]["runs_at_10"]
    spec = rolling.checks[-1]
    rows = rolling.training_rows(spec, "last_3", "all")
    weights = np.array([cfg.weight_for_age(spec.year - y, "strong") for y in rows["match_date"].dt.year])
    import linreg.regression as regression
    assert coefficient == pytest.approx(regression.fit(rows, ["runs_at_10"], weights=weights)["coefficients"]["runs_at_10"], abs=0.002)


def test_a_repeat_across_all_four_parts_is_rejected_but_a_different_window_is_a_new_setup(run_graph, path):
    events, _ = run(run_graph, path,
                    reply(["runs_at_10"], "a", window="last_5", weighting="gentle", training_innings="all"),
                    reply(["runs_at_10"], "same again", window="last_5", weighting="gentle", training_innings="all"),
                    reply(["runs_at_10"], "other window", window="last_3", weighting="gentle", training_innings="all"),
                    reply(["runs_at_10"], "done", True))
    state = merged_state(events)
    assert [r["outcome"] for r in state["rounds"]] == ["fit", "rejected", "fit", "finished"]
    assert [r["code"] for r in state["rejections"]] == ["already_tried"]
    assert state["rejections"][0]["window"] == "last_5"


def test_every_way_of_being_rejected_is_reached_through_the_agent_and_nothing_is_fitted(run_graph, path):
    from linreg.llm_fake import BAD_REPLIES
    replies = [BAD_REPLIES[k] for k in ("missing_part", "unknown_window", "unknown_weighting", "unknown_training_innings",
                                        "unknown_feature", "empty")]
    events, _ = run(run_graph, path, *replies)
    state = merged_state(events)
    assert [r["code"] for r in state["rejections"]] == ["missing_part", "unknown_window", "unknown_weighting",
                                                         "unknown_training_innings", "unknown_feature", "empty"]
    assert "fit_model" not in nodes_of(events) and [a for a in state["attempts"] if a["proposer"] == "llm"] == []
    reasons = [r["message"] for r in state["rounds"]]
    assert "weighting" in reasons[0] and "last_7" in reasons[1] and "extreme" in reasons[2] and "leagues" in reasons[3]


def test_the_too_many_and_redundant_replies_are_rejected_too(run_graph, path):
    from linreg.llm_fake import BAD_REPLIES
    events, _ = run(run_graph, path, BAD_REPLIES["too_many"], BAD_REPLIES["redundant"], reply(["runs_at_10"], "x", True))
    assert [r["code"] for r in merged_state(events)["rejections"]] == ["too_many", "redundant"]


def test_the_next_prompt_shows_the_setup_and_the_three_check_errors_of_the_earlier_attempt(run_graph, path):
    events, llm = run(run_graph, path, reply(["runs_at_10"], "a", window="last_5", weighting="gentle", training_innings="all"),
                      reply(["runs_at_10", "wickets_in_hand"], "b", True))
    second = llm.requests[1].user
    attempt = [a for n, u in events if n == "evaluate" for a in u["attempts"]][0]
    assert "window last_5 | weighting gentle | training_innings all" in second
    for check in attempt["checks"]:
        assert f"{check['year']}: {check['mae']}" in second
    assert "Average final total by year" in second and "Innings by year and competition" in second
