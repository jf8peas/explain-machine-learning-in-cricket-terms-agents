"""The named facts behind the section (feature 012): each value is an existing figure, shown as the page shows it."""
import pytest

from linreg import cricket_facts
from tests.test_explanation_numbers import facts_for, state_for

REQUIRED = {"goal_reached", "beat_tv", "beat_tv_by", "goal_margin", "tv_test_miss",
            "share_within_10", "share_within_10_words", "within_runs_threshold", "biggest_factor", "biggest_factor_effect",
            "n_features", "test_year", "test_innings", "beat_know_nothing_by", "beat_know_nothing",
            "know_nothing_rising", "know_nothing_bias_runs", "know_nothing_bias_direction",
            "know_nothing_miss", "tv_gap", "run_rate_state", "tv_bias_runs", "tv_bias_direction", "tv_bias_large", "rule_verb",
            "rule_runs", "chosen_label"}
GONE = {"winner_name", "winner_test_miss", "race_leader", "race_leader_label", "race_leader_differs", "leader_within_10",
        "leader_within_10_words", "winner_validation_error", "check_year_1", "check_year_2", "check_year_3", "training_from", "training_to"}


def test_every_fact_has_a_value_a_unit_a_display_and_a_meaning():
    for fid, f in facts_for(state_for()).items():
        assert set(f) == {"value", "unit", "display", "meaning"}, fid
        assert isinstance(f["display"], str) and f["display"] and f["meaning"] and f["unit"], fid


def test_the_required_facts_are_there_for_an_ordinary_run():
    facts = facts_for(state_for())
    assert REQUIRED <= set(facts) and not GONE & set(facts)


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


def test_the_test_year_and_innings_come_from_the_state():
    facts = facts_for(state_for())
    assert facts["test_year"]["value"] == 2026 and facts["test_innings"]["value"] == 515


def test_displays_are_rounded_as_the_page_rounds():
    facts = facts_for(state_for(llm_mae=17.04, forward_mae=17.0, tv=21.0, within_10=33.04))
    assert facts["share_within_10"]["display"] == "33.0"
    assert facts["goal_margin"]["display"] == "3"                          # the margin is a whole number when it is whole
    assert facts["tv_test_miss"]["display"] == "21.0"                      # runs to one decimal, never a bare 21


def test_the_threshold_is_a_fact_so_the_wording_never_needs_a_digit():
    assert facts_for(state_for())["within_runs_threshold"]["display"] == "10"


def test_the_closing_leads_are_gone():
    assert not hasattr(cricket_facts, "CLOSING_LEADS")


@pytest.mark.parametrize("tv, know, state_, gap", [
    (21.0, 34.0, "clearly", "13.0"), (21.0, 22.0, "barely", "1.0"), (21.0, 23.0, "barely", "2.0"),
    (21.0, 20.0, "none", "1.0"), (21.0, 21.0, "none", "0.0"), (18.0, 20.0, "barely", "2.0"), (17.9, 20.0, "clearly", "2.1"),
])
def test_the_run_rate_state_and_the_gap(tv, know, state_, gap):
    facts = facts_for(state_for(tv=tv, know_nothing=know))
    assert facts["run_rate_state"]["value"] == state_ and facts["tv_gap"]["display"] == gap
    assert facts["know_nothing_miss"]["display"] == f"{know:.1f}"


@pytest.mark.parametrize("bias, direction, display, large, verb, runs", [
    (-12.0, "low", "too low", True, "add", "12.0"), (15.0, "high", "too high", True, "take off", "15.0"),
    (-2.0, "low", "too low", False, "none", "2.0"), (2.0, "high", "too high", False, "none", "2.0"),
    (0.04, "none", "about right", False, "none", "0.0"), (-10.5, "low", "too low", True, "add", "10.5"),
    (-10.4, "low", "too low", False, "none", "10.4"),
])
def test_the_tv_bias_direction_the_large_flag_and_the_rule_of_thumb_verb(bias, direction, display, large, verb, runs):
    facts = facts_for(state_for(tv=21.0, tv_bias=bias))
    assert facts["tv_bias_direction"]["value"] == direction and facts["tv_bias_direction"]["display"] == display
    assert facts["tv_bias_large"]["value"] is large
    assert facts["rule_verb"]["value"] == verb and facts["rule_runs"]["display"] == runs


def test_the_bias_direction_follows_accuracy_texts_own_rule():
    from linreg import accuracy_text
    for bias in (-12.0, -0.04, 0.0, 0.04, 3.3, 15.0):
        shown = accuracy_text.bias_short(bias)
        expected = "none" if shown == "0.0" else ("high" if bias > 0 else "low")
        assert facts_for(state_for(tv_bias=bias))["tv_bias_direction"]["value"] == expected


@pytest.mark.parametrize("share, words", [
    (0.0, "only rarely"), (14.9, "only rarely"), (15.0, "only about a quarter of the time"),
    (27.9, "only about a quarter of the time"), (28.0, "only about a third of the time"),
    (33.3, "only about a third of the time"), (37.9, "only about a third of the time"),
    (38.0, "only a little less than half the time"), (47.9, "only a little less than half the time"),
    (48.0, "only about half the time"), (51.9, "only about half the time"), (52.0, "a little more than half the time"),
    (61.9, "a little more than half the time"), (62.0, "about two thirds of the time"), (71.9, "about two thirds of the time"),
    (72.0, "about three quarters of the time"), (84.9, "about three quarters of the time"), (85.0, "nearly always"),
    (100.0, "nearly always"),
])
def test_the_within_ten_share_in_words_has_a_fixed_table_with_inclusive_lower_bounds(share, words):
    assert cricket_facts.within_10_words(share) == words


def test_the_share_words_use_the_displayed_one_decimal_share():
    assert cricket_facts.within_10_words(27.96) == "only about a third of the time"          # displays as 28.0
    facts = facts_for(state_for(within_10=33.0, tv_within_10=60.0, forward_mae=17.0))
    assert facts["share_within_10_words"]["display"] == "only about a third of the time"


@pytest.mark.parametrize("kw, chosen", [
    (dict(forward_mae=17.0, llm_mae=18.0, tv=21.0), "rival's model"),
    (dict(winner="llm", llm_mae=18.0, forward_mae=16.0, tv=21.0), "AI agent's model"),
    (dict(llm_mae=None, forward_mae=17.0, tv=21.0, took_part=False), "rival's model"),
])
def test_the_chosen_label_follows_the_method_chosen_before_the_test(kw, chosen):
    assert facts_for(state_for(**kw))["chosen_label"]["display"] == chosen


@pytest.mark.parametrize("bias, direction, rising", [
    (-20.0, "too low", True), (-17.0, "too low", True), (-16.9, "too low", False),   # 17.0 is half of a 34.0 miss
    (20.0, "too high", False), (0.0, "about right", False), (-0.04, "about right", False),
])
def test_the_know_nothing_rising_fact_uses_the_large_bias_rule_and_too_low(bias, direction, rising):
    facts = facts_for(state_for(know_nothing=34.0, know_nothing_bias=bias))
    assert facts["know_nothing_bias_direction"]["display"] == direction and facts["know_nothing_rising"]["value"] is rising


def test_no_fact_description_says_winner():
    for fid, f in facts_for(state_for()).items():
        assert "winner" not in f["meaning"].lower(), fid


def test_every_new_fact_has_the_four_fields():
    facts = facts_for(state_for())
    for fid in REQUIRED:
        assert set(facts[fid]) == {"value", "unit", "display", "meaning"}, fid


def test_a_win_over_the_know_nothing_guess_is_a_fact_and_so_is_a_loss():
    assert facts_for(state_for(know_nothing=40.0))["beat_know_nothing"]["value"] is True
    assert facts_for(state_for(know_nothing=10.0))["beat_know_nothing"]["value"] is False
