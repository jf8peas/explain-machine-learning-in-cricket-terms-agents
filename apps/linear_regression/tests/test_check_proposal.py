"""Every rule the code applies to the language model's proposal, in order, and the stopping rules."""
import pytest

from linreg import features
from linreg.data_loading import load_innings
from linreg.season_split import split_three_ways
from linreg.selection import check_proposal, stop_reason
from linreg.state import NO_IMPROVE_STOP, ROUND_CAP, SET_LIMIT


@pytest.fixture(scope="module")
def train():
    return split_three_ways(load_innings()).train


def test_a_good_proposal_is_fitted(train):
    c = check_proposal(["runs_at_10", "wickets_in_hand"], tried=[], train=train)
    assert c.outcome == "fit" and c.reason is None and c.features == ["runs_at_10", "wickets_in_hand"]


def test_an_unknown_name_is_rejected_and_named(train):
    c = check_proposal(["runs_at_10", "net_run_rate"], tried=[], train=train)
    assert (c.outcome, c.reason) == ("rejected", "unknown_feature")
    assert c.features == ["net_run_rate"] and "net_run_rate" in c.message and "catalogue" in c.message


@pytest.mark.parametrize("wrong", ["Runs_At_10", "RUNS_AT_10", "runs at 10", " runs_at_10", "runs_at_10 "])
def test_wrong_capitalisation_or_spacing_is_an_unknown_name(train, wrong):
    c = check_proposal([wrong], tried=[], train=train)
    assert (c.outcome, c.reason) == ("rejected", "unknown_feature")


def test_an_empty_proposal_is_rejected(train):
    c = check_proposal([], tried=[], train=train)
    assert (c.outcome, c.reason) == ("rejected", "empty") and "no features" in c.message


def test_more_than_the_limit_is_rejected_with_the_limit_stated(train):
    nine = [i for i in features.IDS if i not in ("is_ipl", "is_bbl")][:SET_LIMIT + 1]
    assert len(nine) == 9
    c = check_proposal(nine, tried=[], train=train)
    assert (c.outcome, c.reason) == ("rejected", "too_many") and str(SET_LIMIT) in c.message and "9" in c.message


def test_exactly_the_limit_is_allowed_if_independent(train):
    eight = ["runs_at_10", "wickets_at_10", "fours_at_10", "sixes_at_10", "dot_balls_at_10", "extras_at_10",
             "partnership_runs", "balls_since_last_wicket"]
    assert check_proposal(eight, tried=[], train=train).outcome == "fit"


def test_a_repeat_of_a_tried_set_in_a_different_order_is_rejected(train):
    tried = [["runs_at_10", "wickets_at_10"]]
    c = check_proposal(["wickets_at_10", "runs_at_10"], tried=tried, train=train)
    assert (c.outcome, c.reason) == ("rejected", "already_tried") and "already" in c.message


def test_a_redundant_set_is_rejected_and_the_repeating_features_are_named(train):
    c = check_proposal(["wickets_at_10", "wickets_in_hand", "fours_at_10"], tried=[], train=train)
    assert (c.outcome, c.reason) == ("rejected", "redundant")
    assert c.features == ["wickets_at_10", "wickets_in_hand"]
    assert features.label("wickets_in_hand") in c.message and features.label("wickets_at_10") in c.message
    assert features.label("fours_at_10") not in c.message


def test_naming_a_feature_twice_is_a_repeat(train):
    c = check_proposal(["runs_at_10", "runs_at_10"], tried=[], train=train)
    assert (c.outcome, c.reason) == ("rejected", "redundant") and c.features == ["runs_at_10"]


def test_the_first_failing_rule_decides(train):
    # unknown beats everything
    assert check_proposal(["nope"] * 10, tried=[], train=train).reason == "unknown_feature"
    # too many beats a repeat or a redundancy
    ten = [i for i in features.IDS if i not in ("is_ipl", "is_bbl")][:SET_LIMIT + 1]
    assert check_proposal(ten, tried=[ten], train=train).reason == "too_many"
    # a tried set beats redundancy
    redundant = ["wickets_at_10", "wickets_in_hand"]
    assert check_proposal(redundant, tried=[redundant], train=train).reason == "already_tried"


def test_the_proposal_is_never_changed_by_the_check(train):
    proposal = ["wickets_in_hand", "runs_at_10"]
    check_proposal(proposal, tried=[], train=train)
    assert proposal == ["wickets_in_hand", "runs_at_10"]


# --- the stopping rules ---

def test_stop_when_the_model_says_finished():
    assert stop_reason(finished=True, rounds_used=2, rounds_without_improvement=0) == "finished"


def test_stop_after_two_rounds_in_a_row_without_improvement():
    assert NO_IMPROVE_STOP == 2
    assert stop_reason(finished=False, rounds_used=3, rounds_without_improvement=1) is None
    assert stop_reason(finished=False, rounds_used=3, rounds_without_improvement=2) == "no_improvement"


def test_stop_at_the_round_cap_rejections_included():
    assert ROUND_CAP == 6
    assert stop_reason(finished=False, rounds_used=5, rounds_without_improvement=0) is None
    assert stop_reason(finished=False, rounds_used=6, rounds_without_improvement=0) == "round_cap"


def test_finished_wins_over_the_other_reasons():
    assert stop_reason(finished=True, rounds_used=6, rounds_without_improvement=2) == "finished"
