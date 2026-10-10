"""SC-001 (feature 012): every number in the "In cricket terms" section is a fact computed by code, in both stories."""
import re

import pytest

from linreg import cricket_blocks, cricket_facts, features
from linreg.llm_fake import FakeLlm, reply
from linreg.state import MARGIN_RUNS
from tests.conftest import make_table, merged_state

NUM = re.compile(r"\d+(?:\.\d+)?")


def state_for(*, llm_mae=18.0, forward_mae=17.0, tv=21.0, features_=("runs_at_10", "wickets_in_hand"), coefs=None,
              took_part=True, failure=None, model="Fast", know_nothing=34.0, within_10=33.0, iqr=20.0):
    """A run state with just what the facts read, for scripted cases."""
    both = llm_mae is not None
    winner = "forward" if (not both or forward_mae < llm_mae) else "llm"          # a tie goes to the language model
    won = llm_mae if winner == "llm" else forward_mae
    coefs = coefs or {"runs_at_10": 1.2, "wickets_in_hand": 6.5}
    improvement = round(tv - won, 1)
    return {
        "model_name": model, "llm_status": "ok" if took_part else "failed", "llm_failure": failure,
        "split": {"test_year": 2026, "test_n": 515, "first_year": 2005,
                  "checks": [{"year": 2023, "n": 176, "earlier_years": [2005, 2022]},
                             {"year": 2024, "n": 196, "earlier_years": [2005, 2023]},
                             {"year": 2025, "n": 196, "earlier_years": [2005, 2024]}]},
        "rounds_used": 4, "attempts": [],
        "features": list(features_), "coefficients": coefs, "feature_iqr": {f: iqr for f in features_},
        "final": {"test_mae": {"llm": llm_mae, "forward": forward_mae, "tv": tv}, "winner": winner,
                  "winner_name": "the language model" if winner == "llm" else "forward selection",
                  "validation_mae": {"llm": llm_mae, "forward": forward_mae}, "winner_chosen_on": "validation",
                  "margin": abs(llm_mae - forward_mae) if both else None, "winner_mae": won, "winner_r2": 0.7,
                  "llm_took_part": took_part, "tolerances": [10, 20],
                  "accuracy": {winner: {"n": 515, "average_miss": won, "within_10": within_10, "within_20": 60.0,
                                        "miss_percent": 11.0, "bias": -1.0}},
                  "versus_know_nothing": {"reference_miss": know_nothing, "winner_miss": won,
                                          "improvement_runs": round(know_nothing - won, 1),
                                          "improvement_percent": 40.0, "beat": know_nothing > won},
                  "beat_tv": improvement > 0, "cleared_margin": improvement >= MARGIN_RUNS, "improvement": improvement},
    }


def facts_for(state):
    return cricket_facts.build_facts(state, features.labels(), MARGIN_RUNS)


def blocks_for(state):
    facts = facts_for(state)
    return facts, cricket_blocks.build_blocks(facts, features.labels(), list(state["features"]))


def section_text(blocks) -> str:
    return " ".join([*(b["title"] for b in blocks), *(s for b in blocks for s in b["sentences"])])


def fact_numbers(facts) -> list[float]:
    out = []
    for f in facts.values():
        out += [float(t) for t in NUM.findall(str(f["display"]))]
    return out


def check_section_numbers(explanation) -> None:
    """Every number written in the section's text equals the display of some fact."""
    known = fact_numbers(explanation["facts"])
    text = section_text(explanation["blocks"])
    for token in NUM.findall(text):
        assert any(abs(float(token) - v) < 1e-9 for v in known), f"{token!r} in {text!r} is not a fact"


def test_every_number_in_a_real_run_is_a_fact(run_graph, write_csv):
    state = merged_state(run_graph({"data_path": write_csv(make_table())}))
    check_section_numbers(state["explanation"])


def test_every_number_in_the_scripted_cases_is_a_fact():
    for kw in ({}, {"llm_mae": 16.0}, {"llm_mae": 17.0}, {"llm_mae": None, "took_part": False, "failure": "It broke."},
               {"tv": 17.5}, {"tv": 19.0}, {"tv": 17.0},
               {"features_": ("runs_at_10",), "coefs": {"runs_at_10": 1.2}},
               {"features_": ("runs_at_10", "wickets_at_10"), "coefs": {"runs_at_10": 1.2, "wickets_at_10": -7.0}},
               {"features_": ("runs_at_10", "wickets_at_10"), "coefs": {"runs_at_10": 1.2, "wickets_at_10": 3.0}}):
        state = state_for(**kw)
        facts, blocks = blocks_for(state)
        check_section_numbers({"facts": facts, "blocks": blocks})


def test_a_run_where_the_model_fails_still_explains(run_graph, write_csv):
    llm = FakeLlm({"fake/steady": [reply(["runs_at_10"], "x", finished=True)]})  # finished before any set: a failure
    state = merged_state(run_graph({"data_path": write_csv(make_table())}, llm=llm))
    expl = state["explanation"]
    assert state["llm_status"] == "failed" and expl["source"] == "template" and expl["fallback_reason"]
    assert [b["id"] for b in expl["blocks"]][0] == "verdict" and expl["blocks"][-1]["id"] == "closing"
    check_section_numbers(expl)


def test_the_winner_is_named_in_the_how_chosen_block():
    _, blocks = blocks_for(state_for(llm_mae=18.0, forward_mae=17.0))
    chosen = next(b for b in blocks if b["id"] == "how_chosen")
    assert "forward selection" in " ".join(chosen["sentences"])
    _, blocks = blocks_for(state_for(llm_mae=16.0, forward_mae=17.5))
    assert "the language model" in " ".join(next(b for b in blocks if b["id"] == "how_chosen")["sentences"])


def test_the_most_important_feature_is_ranked_by_coefficient_times_spread():
    facts = facts_for(state_for(coefs={"runs_at_10": 0.5, "wickets_in_hand": 6.0}))
    assert facts["biggest_factor"]["value"] == "wickets_in_hand"
    assert facts["effect_runs_at_10"]["value"] == 10.0 and facts["effect_wickets_in_hand"]["value"] == 120.0
    assert facts["biggest_factor_effect"]["display"] == "120.0"


def test_the_winning_features_are_in_the_chart_with_their_plain_names():
    _, blocks = blocks_for(state_for())
    rows = next(b for b in blocks if b["id"] == "drivers")["visual"]["rows"]
    assert [r["feature"] for r in rows] == ["wickets_in_hand", "runs_at_10"]           # 6.5 x 20 beats 1.2 x 20
    assert rows[0]["label"] == features.label("wickets_in_hand")


def test_the_stage_sentences_in_the_real_run_name_the_check_years_in_facts(run_graph, write_csv):
    state = merged_state(run_graph({"data_path": write_csv(make_table())}))
    facts = state["explanation"]["facts"]
    years = [c["year"] for c in state["split"]["checks"]]
    assert [facts[f"check_year_{i}"]["value"] for i in (1, 2, 3)] == years
    assert facts["test_year"]["value"] == state["split"]["test_year"]
