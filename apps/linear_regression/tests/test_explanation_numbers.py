"""SC-001: every number in the explanation comes from the run's state (computed by code), and the winner is named."""
import re

import pytest

from linreg import cricket_explanation, features
from linreg.llm_fake import FakeLlm, reply
from linreg.state import MARGIN_RUNS
from tests.conftest import make_table, merged_state

NUM = re.compile(r"-?\d+(?:\.\d+)?")


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
    known: list[float] = []
    flatten_numbers({k: v for k, v in state.items() if k != "explanation"}, known)
    flatten_numbers(expl["figures"], known)
    for sentence in expl["sentences"]:
        for token in NUM.findall(sentence):
            # sizes are compared: a sentence says "1.1 runs too low" where the state holds -1.1
            assert any(abs(abs(float(token)) - abs(v)) < 0.051 for v in known), f"{token!r} in {sentence!r} is not in the state"


def state_for(*, llm_mae=18.0, forward_mae=17.0, tv=21.0, features_=("runs_at_10", "wickets_in_hand"),
              coefs=None, took_part=True, failure=None, model="Fast"):
    both = llm_mae is not None
    winner = "llm" if both and llm_mae < forward_mae else "forward"
    won = llm_mae if winner == "llm" else forward_mae
    coefs = coefs or {"runs_at_10": 1.2, "wickets_in_hand": 6.5}
    return {
        "model_name": model, "llm_status": "ok" if took_part else "failed", "llm_failure": failure,
        "split": {"train_n": 4036, "validation_n": 595, "test_n": 515, "validation_year": 2025, "test_year": 2026,
                  "train_years": [2005, 2024]},
        "rounds_used": 4, "attempts": [{"features": ["runs_at_10"], "proposer": "llm", "validation_mae": 19.0,
                                        "validation_r2": 0.6, "improved": True, "round": 1},
                                       {"features": ["runs_at_10"], "proposer": "forward_selection", "validation_mae": 19.0,
                                        "validation_r2": 0.6, "improved": True, "round": 1}],
        "features": list(features_), "coefficients": coefs, "feature_iqr": {f: 20.0 for f in features_},
        "final": {"test_mae": {"llm": llm_mae, "forward": forward_mae, "tv": tv}, "winner": winner,
                  "winner_name": "the language model" if winner == "llm" else "forward selection",
                  "margin": abs(llm_mae - forward_mae) if both else None, "winner_mae": won, "winner_r2": 0.7,
                  "llm_took_part": took_part},
    }


def explain(state):
    return cricket_explanation.build_explanation(state, features.labels(), MARGIN_RUNS)


def text(expl):
    return " ".join(expl["sentences"])


def test_every_number_in_a_real_run_is_in_the_state(run_graph, write_csv):
    state = merged_state(run_graph({"data_path": write_csv(make_table())}))
    check_numbers(state)


def test_every_number_in_the_scripted_cases_is_in_the_state():
    for kw in ({}, {"llm_mae": 16.0}, {"llm_mae": 17.0}, {"llm_mae": None, "took_part": False, "failure": "It broke."},
               {"tv": 17.5}, {"tv": 19.0}):
        state = state_for(**kw)
        state["explanation"] = explain(state)
        check_numbers(state)


def test_the_winner_is_named_with_both_errors_and_the_gap():
    t = text(explain(state_for(llm_mae=18.0, forward_mae=17.0)))
    assert "forward selection won" in t and "17.0" in t and "18.0" in t and "gap of 1.0 runs" in t
    t = text(explain(state_for(llm_mae=16.0, forward_mae=17.5)))
    assert "the language model's choice won" in t and "16.0" in t and "17.5" in t and "gap of 1.5" in t


def test_a_tie_goes_to_forward_selection_and_says_so():
    t = text(explain(state_for(llm_mae=17.0, forward_mae=17.0)))
    assert "tied" in t and "forward selection" in t and "simpler" in t


def test_the_explanation_says_plainly_when_the_language_model_did_not_take_part():
    expl = explain(state_for(llm_mae=None, took_part=False, failure="The language model is not configured on this server."))
    assert "did not take part" in text(expl) and "not configured" in text(expl)
    assert expl["comparison"]["llm_took_part"] is False and expl["comparison"]["winner"] == "forward"
    assert "won" not in text(expl).split("did not take part")[0]


def test_it_names_the_model_and_the_rounds_when_the_model_took_part():
    t = text(explain(state_for(model="More thorough")))
    assert "More thorough" in t and "4 rounds" in t and "forward selection" in t


def test_the_tv_verdict_is_stated_honestly():
    assert "beat the TV projection by 4.0" in text(explain(state_for(forward_mae=17.0, tv=21.0)))
    assert "clears the 3.0-run margin" in text(explain(state_for(forward_mae=17.0, tv=21.0)))
    short = text(explain(state_for(forward_mae=17.0, tv=19.0)))
    assert "beat the TV projection by 2.0" in short and "short of the 3.0-run margin" in short
    worse = text(explain(state_for(llm_mae=20.0, forward_mae=19.0, tv=18.0)))
    assert "did not beat the TV projection" in worse and "1.0 runs worse" in worse


def test_the_comparison_block_has_what_the_page_needs():
    c = explain(state_for())["comparison"]
    assert c["winner"] == "forward" and c["llm_mae"] == 18.0 and c["forward_mae"] == 17.0
    assert c["baseline_mae"] == 21.0 and c["model_mae"] == 17.0 and c["winner_margin"] == 1.0
    assert c["beat_baseline"] is True and c["cleared_margin"] is True


def test_the_most_important_feature_is_ranked_by_coefficient_times_spread():
    state = state_for(coefs={"runs_at_10": 0.5, "wickets_in_hand": 6.0})
    expl = explain(state)
    assert expl["most_important"] == "wickets_in_hand"
    assert expl["importance"] == {"runs_at_10": 10.0, "wickets_in_hand": 120.0}


def test_a_wicket_sentence_only_when_a_wicket_feature_is_in_the_model():
    assert "wicket in hand is worth" in text(explain(state_for()))
    lost = state_for(features_=("runs_at_10", "wickets_at_10"), coefs={"runs_at_10": 1.2, "wickets_at_10": -7.0})
    assert "costs about 7.0 runs" in text(explain(lost))
    odd = state_for(features_=("runs_at_10", "wickets_at_10"), coefs={"runs_at_10": 1.2, "wickets_at_10": 3.0})
    assert "Surprisingly" in text(explain(odd))
    none = state_for(features_=("runs_at_10", "fours_at_10"), coefs={"runs_at_10": 1.2, "fours_at_10": 0.4})
    assert "wicket" not in text(explain(none))


def test_the_winning_features_are_listed_in_cricket_words():
    t = text(explain(state_for()))
    assert features.label("runs_at_10") in t and features.label("wickets_in_hand") in t


def test_a_run_where_the_model_fails_still_explains(run_graph, write_csv):
    llm = FakeLlm({"fake/steady": [reply(["runs_at_10"], "x", finished=True)]})  # finished before any set: a failure
    state = merged_state(run_graph({"data_path": write_csv(make_table())}, llm=llm))
    assert state["llm_status"] == "failed" and "did not take part" in text(state["explanation"])
    check_numbers(state)
