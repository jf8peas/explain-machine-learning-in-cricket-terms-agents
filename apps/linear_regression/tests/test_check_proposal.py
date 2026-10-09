"""Every rule the code applies to the language model's proposal, in order, and the stopping rules (features 004 and 008).

A proposal is a full setup: features, training window, recency weighting and training innings. Code rejects a missing part,
an off-menu value, an unknown feature and the rest before anything is fitted."""
import pytest

from linreg import features
from linreg import setup_settings as cfg
from linreg.data_loading import load_innings
from linreg.fitting import Fitter
from linreg.season_split import rolling_checks
from linreg.selection import Check, check_proposal, stop_reason
from linreg.state import NO_IMPROVE_STOP, ROUND_CAP, SET_LIMIT


@pytest.fixture(scope="module")
def fitter():
    return Fitter(rolling_checks(load_innings()))


def setup(feats, window="all", weighting="none", training_innings="population"):
    return {"features": feats, "window": window, "weighting": weighting, "training_innings": training_innings}


def attempt(feats, **parts):
    return setup(feats, **parts)


def check(fitter, feats, tried=(), **parts):
    return check_proposal(setup(feats, **parts), list(tried), fitter)


def rejected(c: Check, reason: str):
    assert (c.outcome, c.reason) == ("rejected", reason), c.message


# --- the old rules, now with a full setup ---------------------------------------------------------------------------

def test_a_good_proposal_is_fitted(fitter):
    c = check(fitter, ["runs_at_10", "wickets_in_hand"])
    assert c.outcome == "fit" and c.reason is None and c.features == ["runs_at_10", "wickets_in_hand"]


def test_an_unknown_name_is_rejected_and_named(fitter):
    c = check(fitter, ["runs_at_10", "net_run_rate"])
    rejected(c, "unknown_feature")
    assert c.features == ["net_run_rate"] and "net_run_rate" in c.message and "catalogue" in c.message


@pytest.mark.parametrize("wrong", ["Runs_At_10", "RUNS_AT_10", "runs at 10", " runs_at_10", "runs_at_10 "])
def test_wrong_capitalisation_or_spacing_is_an_unknown_name(fitter, wrong):
    rejected(check(fitter, [wrong]), "unknown_feature")


def test_an_empty_proposal_is_rejected(fitter):
    c = check(fitter, [])
    rejected(c, "empty")
    assert "no features" in c.message


def test_more_than_the_limit_is_rejected_with_the_limit_stated(fitter):
    nine = [i for i in features.IDS if i not in ("is_ipl", "is_bbl")][:SET_LIMIT + 1]
    c = check(fitter, nine)
    rejected(c, "too_many")
    assert str(SET_LIMIT) in c.message and "9" in c.message


def test_exactly_the_limit_is_allowed_if_independent(fitter):
    eight = ["runs_at_10", "wickets_at_10", "fours_at_10", "sixes_at_10", "dot_balls_at_10", "extras_at_10",
             "partnership_runs", "balls_since_last_wicket"]
    assert check(fitter, eight).outcome == "fit"


def test_a_redundant_set_is_rejected_and_the_repeating_features_are_named(fitter):
    c = check(fitter, ["wickets_at_10", "wickets_in_hand", "fours_at_10"])
    rejected(c, "redundant")
    assert c.features == ["wickets_at_10", "wickets_in_hand"]


def test_a_feature_named_twice_is_rejected_as_redundant(fitter):
    c = check(fitter, ["runs_at_10", "runs_at_10"])
    rejected(c, "redundant")
    assert "more than once" in c.message


def test_both_teams_full_members_repeats_the_two_league_columns_inside_the_population(fitter):
    c = check(fitter, ["both_full_members", "is_ipl", "is_bbl"])
    rejected(c, "redundant")
    assert "both_full_members" not in c.message or "repeat" in c.message
    assert set(c.features) == {"both_full_members", "is_ipl", "is_bbl"}
    # on all innings the associate nations break the tie, so the same set is allowed there
    assert check(fitter, ["both_full_members", "is_ipl", "is_bbl"], training_innings="all").outcome == "fit"


# --- the new rules ---------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("missing", ["features", "window", "weighting", "training_innings"])
def test_a_missing_part_is_rejected_and_named(fitter, missing):
    parts = setup(["runs_at_10"])
    parts[missing] = None
    c = check_proposal(parts, [], fitter)
    rejected(c, "missing_part")
    assert missing in c.message and "all four" in c.message


def test_several_missing_parts_are_all_named(fitter):
    c = check_proposal({"features": ["runs_at_10"], "window": None, "weighting": None, "training_innings": "all"}, [], fitter)
    rejected(c, "missing_part")
    assert "window" in c.message and "weighting" in c.message


def test_a_proposal_with_no_keys_at_all_is_rejected_as_missing_parts(fitter):
    rejected(check_proposal({}, [], fitter), "missing_part")


@pytest.mark.parametrize("part,reason,value", [("window", "unknown_window", "last_7"),
                                               ("weighting", "unknown_weighting", "extreme"),
                                               ("training_innings", "unknown_training_innings", "leagues")])
def test_an_off_menu_value_is_rejected_with_its_own_reason_and_the_menu(fitter, part, reason, value):
    c = check(fitter, ["runs_at_10"], **{part: value})
    rejected(c, reason)
    assert value in c.message
    menu = {"window": cfg.WINDOW_IDS, "weighting": cfg.WEIGHTING_IDS, "training_innings": cfg.TRAINING_INNINGS_IDS}[part]
    assert all(i in c.message for i in menu)                                  # the allowed ids are listed


@pytest.mark.parametrize("wrong", ["Last_5", "LAST_5", " last_5", "last 5", "5", 5, ["last_5"]])
def test_menu_ids_must_match_exactly(fitter, wrong):
    rejected(check(fitter, ["runs_at_10"], window=wrong), "unknown_window")


def test_every_menu_combination_is_accepted_when_it_leaves_enough_innings(fitter):
    for window in cfg.WINDOW_IDS:
        for weighting in cfg.WEIGHTING_IDS:
            for innings in cfg.TRAINING_INNINGS_IDS:
                c = check(fitter, ["runs_at_10"], window=window, weighting=weighting, training_innings=innings)
                assert c.outcome == "fit", (window, weighting, innings, c.message)


def test_a_repeat_compares_all_four_parts_with_the_features_as_a_set(fitter):
    tried = [attempt(["runs_at_10", "wickets_at_10"], window="last_5", weighting="gentle", training_innings="all")]
    c = check(fitter, ["wickets_at_10", "runs_at_10"], tried, window="last_5", weighting="gentle", training_innings="all")
    rejected(c, "already_tried")
    assert "already" in c.message


@pytest.mark.parametrize("part,other", [("window", "last_3"), ("weighting", "strong"), ("training_innings", "population")])
def test_changing_any_one_part_makes_it_a_new_setup(fitter, part, other):
    base = dict(window="last_5", weighting="gentle", training_innings="all")
    tried = [attempt(["runs_at_10"], **base)]
    assert check(fitter, ["runs_at_10"], tried, **{**base, part: other}).outcome == "fit"


def test_two_setups_that_differ_only_in_an_option_with_no_effect_are_both_allowed(fitter):
    # on a three-year window the age spread is small, so gentle and strong weights are close; both are still different setups
    first = check(fitter, ["runs_at_10"], window="last_3", weighting="strong")
    second = check(fitter, ["runs_at_10"], [attempt(["runs_at_10"], window="last_3", weighting="strong")],
                   window="last_3", weighting="gentle")
    assert first.outcome == "fit" and second.outcome == "fit"


def test_too_few_training_innings_in_a_check_is_rejected_with_the_reason(fitter, monkeypatch):
    monkeypatch.setattr(cfg, "MIN_TRAIN_INNINGS", 10_000)
    c = check(fitter, ["runs_at_10"], window="last_3")
    rejected(c, "too_few_innings")
    assert "2023" in c.message and "10000" in c.message.replace(",", "") and "innings" in c.message


def test_too_few_when_a_short_window_reaches_only_thin_years():
    import pandas as pd
    from tests.conftest import make_table
    df = make_table(years=tuple(range(2018, 2026)), per_year=220)                 # test year 2025, checks 2022 to 2024
    df["match_date"] = pd.to_datetime(df["match_date"])
    year = df["match_date"].dt.year
    thin_years = year.between(2019, 2021)
    df["in_test_population"] = (~thin_years | (df.index % 11 == 0)).astype(int)    # about 20 population innings in each of 2019-21
    fitter = Fitter(rolling_checks(df))
    c = check_proposal(setup(["runs_at_10"], window="last_3", training_innings="population"), [], fitter)
    rejected(c, "too_few_innings")
    assert "2022" in c.message and "innings" in c.message                         # 2019 to 2021 are the 3 years before 2022
    # all available years, or all innings, keep enough to learn from
    assert check_proposal(setup(["runs_at_10"], window="all", training_innings="population"), [], fitter).outcome == "fit"
    assert check_proposal(setup(["runs_at_10"], window="last_3", training_innings="all"), [], fitter).outcome == "fit"


def test_the_rules_apply_in_order_the_first_failure_decides(fitter):
    both = ["net_run_rate", "net_run_rate2"]
    assert check(fitter, both, window="nope").reason == "unknown_window"                     # menus before features
    assert check_proposal({"features": both, "window": None, "weighting": "none", "training_innings": "all"}, [], fitter).reason == "missing_part"
    assert check(fitter, both).reason == "unknown_feature"
    tried = [attempt(["wickets_at_10", "wickets_in_hand"])]
    assert check(fitter, ["wickets_at_10", "wickets_in_hand"], tried).reason == "already_tried"      # repeat before redundant


def test_the_redundant_message_names_the_repeating_features_and_only_those(fitter):
    c = check(fitter, ["wickets_at_10", "wickets_in_hand", "fours_at_10"])
    assert features.label("wickets_in_hand") in c.message and features.label("wickets_at_10") in c.message
    assert features.label("fours_at_10") not in c.message


def test_too_many_beats_a_repeat_and_a_tried_set_beats_redundancy(fitter):
    ten = [i for i in features.IDS if i not in ("is_ipl", "is_bbl")][:SET_LIMIT + 1]
    assert check(fitter, ten, [attempt(ten)]).reason == "too_many"
    redundant = ["wickets_at_10", "wickets_in_hand"]
    assert check(fitter, redundant, [attempt(redundant)]).reason == "already_tried"


def test_the_proposal_is_never_changed_or_guessed(fitter):
    parts = setup(["runs_at_10"], window="all")
    before = {k: (list(v) if isinstance(v, list) else v) for k, v in parts.items()}
    check_proposal(parts, [], fitter)
    assert parts == before


# --- stopping rules (unchanged) ----------------------------------------------------------------------------------

def test_finished_ends_the_loop():
    assert stop_reason(finished=True, rounds_used=1, rounds_without_improvement=0) == "finished"


def test_two_rounds_without_improvement_end_the_loop():
    assert stop_reason(finished=False, rounds_used=3, rounds_without_improvement=NO_IMPROVE_STOP) == "no_improvement"
    assert stop_reason(finished=False, rounds_used=3, rounds_without_improvement=NO_IMPROVE_STOP - 1) is None


def test_finished_wins_over_the_other_reasons():
    assert stop_reason(finished=True, rounds_used=6, rounds_without_improvement=2) == "finished"


def test_the_round_cap_ends_the_loop():
    assert stop_reason(finished=False, rounds_used=ROUND_CAP, rounds_without_improvement=0) == "round_cap"
    assert stop_reason(finished=False, rounds_used=ROUND_CAP - 1, rounds_without_improvement=0) is None
