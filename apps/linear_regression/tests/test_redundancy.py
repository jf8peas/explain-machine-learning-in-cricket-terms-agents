"""A feature set is redundant when its columns plus the intercept are not linearly independent on the training data."""
import pandas as pd
import pytest

from linreg.data_loading import load_innings
from linreg.redundancy import is_redundant, repeating_features
from linreg.season_split import split_three_ways


@pytest.fixture(scope="module")
def train():
    return split_three_ways(load_innings()).train


def test_an_independent_set_is_not_redundant(train):
    assert repeating_features(train, ["runs_at_10", "wickets_at_10", "fours_at_10"]) == []
    assert not is_redundant(train, ["runs_at_10", "wickets_at_10", "fours_at_10"])


def test_wickets_in_hand_repeats_wickets_lost_and_both_are_reported(train):
    assert repeating_features(train, ["wickets_in_hand", "wickets_at_10"]) == ["wickets_in_hand", "wickets_at_10"]
    assert is_redundant(train, ["wickets_at_10", "wickets_in_hand"])


def test_runs_at_10_is_the_sum_of_its_two_parts(train):
    got = repeating_features(train, ["runs_at_10", "powerplay_runs", "runs_overs_7_10"])
    assert got == ["runs_at_10", "powerplay_runs", "runs_overs_7_10"]


def test_unrelated_features_are_not_blamed(train):
    got = repeating_features(train, ["runs_at_10", "fours_at_10", "powerplay_runs", "runs_overs_7_10"])
    assert got == ["runs_at_10", "powerplay_runs", "runs_overs_7_10"]  # not fours


def test_wickets_split_the_same_way(train):
    got = repeating_features(train, ["wickets_at_10", "powerplay_wickets", "wickets_overs_7_10"])
    assert set(got) == {"wickets_at_10", "powerplay_wickets", "wickets_overs_7_10"}


def test_any_two_of_the_three_run_measures_are_fine_together(train):
    assert repeating_features(train, ["powerplay_runs", "runs_overs_7_10"]) == []
    assert repeating_features(train, ["runs_at_10", "powerplay_runs"]) == []


def test_the_two_competition_dummies_are_independent(train):
    assert repeating_features(train, ["is_ipl", "is_bbl"]) == []


def test_a_product_with_its_parts_is_not_an_exact_repeat(train):
    # runs x wickets in hand is a different shape from either part, so a straight line cannot reproduce it
    assert repeating_features(train, ["runs_at_10", "wickets_in_hand", "runs_x_wickets_in_hand"]) == []


def test_a_constant_column_repeats_the_intercept():
    df = pd.DataFrame({"a": [1, 2, 3, 4, 5], "const": [7, 7, 7, 7, 7], "b": [5, 1, 4, 2, 8]})
    assert repeating_features(df, ["a", "const", "b"]) == ["const"]
    assert repeating_features(df, ["const"]) == ["const"]


def test_columns_on_very_different_scales_do_not_fool_the_check():
    df = pd.DataFrame({"big": [1000.0 * i for i in range(1, 9)], "small": [0, 1, 0, 1, 1, 0, 0, 1],
                       "mid": [3, 1, 4, 1, 5, 9, 2, 6]})
    assert repeating_features(df, ["big", "small", "mid"]) == []
    df["copy"] = df["big"] / 1000.0
    assert repeating_features(df, ["big", "copy", "small"]) == ["big", "copy"]


def test_a_single_independent_feature_and_the_empty_set_are_fine(train):
    assert repeating_features(train, ["runs_at_10"]) == []
    assert repeating_features(train, []) == []
