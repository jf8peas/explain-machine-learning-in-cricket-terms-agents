"""The named facts behind the section (feature 012): each value is an existing figure, shown as the page shows it."""
import pytest

from linreg import cricket_facts
from tests.test_explanation_numbers import facts_for, state_for

REQUIRED = {"goal_reached", "beat_tv", "beat_tv_by", "goal_margin", "winner_name", "winner_test_miss", "tv_test_miss",
            "winner_validation_error", "share_within_10", "within_runs_threshold", "biggest_factor", "biggest_factor_effect",
            "n_features", "check_year_1", "check_year_2", "check_year_3", "test_year", "training_from", "training_to",
            "beat_know_nothing_by", "beat_know_nothing"}


def test_every_fact_has_a_value_a_unit_a_display_and_a_meaning():
    for fid, f in facts_for(state_for()).items():
        assert set(f) == {"value", "unit", "display", "meaning"}, fid
        assert isinstance(f["display"], str) and f["display"] and f["meaning"] and f["unit"], fid


def test_the_required_facts_are_there_for_an_ordinary_run():
    assert REQUIRED <= set(facts_for(state_for()))


def test_the_three_goal_cases():
    reached = facts_for(state_for(forward_mae=17.0, tv=21.0))
    assert reached["goal_reached"]["value"] is True and reached["beat_tv"]["value"] is True
    assert "short_of_goal_by" not in reached
    short = facts_for(state_for(forward_mae=17.0, tv=19.0))
    assert short["goal_reached"]["value"] is False and short["beat_tv"]["value"] is True
    assert short["short_of_goal_by"]["display"] == "1.0"
    worse = facts_for(state_for(llm_mae=20.0, forward_mae=19.0, tv=18.0))
    assert worse["beat_tv"]["value"] is False and worse["beat_tv_by"]["display"] == "1.0"
    assert "short_of_goal_by" not in worse


def test_effects_are_coefficient_times_typical_difference_and_signed():
    facts = facts_for(state_for(features_=("runs_at_10", "wickets_at_10"), coefs={"runs_at_10": 1.2, "wickets_at_10": -7.0}))
    assert facts["effect_runs_at_10"]["value"] == 24.0 and facts["effect_runs_at_10"]["display"] == "24.0"
    assert facts["effect_wickets_at_10"]["value"] == -140.0 and facts["effect_wickets_at_10"]["display"] == "140.0"
    assert facts["biggest_factor"]["value"] == "wickets_at_10" and facts["biggest_factor_effect"]["display"] == "140.0"


def test_the_wicket_facts_follow_the_model():
    cost = facts_for(state_for(features_=("runs_at_10", "wickets_at_10"), coefs={"runs_at_10": 1.2, "wickets_at_10": -7.0}))
    assert cost["wicket_cost"]["display"] == "7.0" and cost["wicket_cost_direction"]["value"] == "cost"
    gain = facts_for(state_for(features_=("runs_at_10", "wickets_at_10"), coefs={"runs_at_10": 1.2, "wickets_at_10": 3.0}))
    assert gain["wicket_cost"]["display"] == "3.0" and gain["wicket_cost_direction"]["value"] == "gain"
    hand = facts_for(state_for())
    assert hand["wicket_in_hand_value"]["display"] == "6.5" and hand["wicket_in_hand_direction"]["value"] == "worth"
    assert "wicket_cost" not in hand
    none = facts_for(state_for(features_=("runs_at_10",), coefs={"runs_at_10": 1.2}))
    assert not {"wicket_cost", "wicket_in_hand_value"} & set(none)


def test_one_feature_gives_one_effect():
    facts = facts_for(state_for(features_=("runs_at_10",), coefs={"runs_at_10": 1.2}))
    assert [k for k in facts if k.startswith("effect_")] == ["effect_runs_at_10"] and facts["n_features"]["value"] == 1


def test_the_years_come_from_the_split():
    facts = facts_for(state_for())
    assert [facts[f"check_year_{i}"]["value"] for i in (1, 2, 3)] == [2023, 2024, 2025]
    assert facts["test_year"]["value"] == 2026 and facts["training_from"]["value"] == 2005
    assert facts["training_to"]["value"] == 2022            # the year before the first check year


def test_displays_are_rounded_as_the_page_rounds():
    facts = facts_for(state_for(llm_mae=17.04, forward_mae=17.0, tv=21.0, within_10=33.04))
    assert facts["winner_validation_error"]["display"] == "17.0"          # runs to one decimal, never a bare 17
    assert facts["share_within_10"]["display"] == "33.0"
    assert facts["goal_margin"]["display"] == "3"                          # the margin is a whole number when it is whole


def test_the_threshold_is_a_fact_so_the_wording_never_needs_a_digit():
    assert facts_for(state_for())["within_runs_threshold"]["display"] == "10"


def test_closing_leads_name_facts():
    assert set(cricket_facts.CLOSING_LEADS) <= set(facts_for(state_for(features_=("runs_at_10", "wickets_at_10"),
                                                                       coefs={"runs_at_10": 1.2, "wickets_at_10": -7.0})))


def test_a_win_over_the_know_nothing_guess_is_a_fact_and_so_is_a_loss():
    assert facts_for(state_for(know_nothing=40.0))["beat_know_nothing"]["value"] is True
    assert facts_for(state_for(know_nothing=10.0))["beat_know_nothing"]["value"] is False
