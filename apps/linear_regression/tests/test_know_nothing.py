"""The know-nothing guess: every innings is predicted to end on the training years' average final total (feature 006)."""
import numpy as np
import pandas as pd

from linreg.data_loading import load_innings
from linreg.evaluation import know_nothing_guess
from linreg.season_split import split_three_ways


def test_it_returns_the_mean_of_the_training_totals_once_for_each_innings_to_predict():
    guess = know_nothing_guess([100, 150, 200], 4)
    assert list(guess) == [150.0, 150.0, 150.0, 150.0]


def test_it_works_on_a_pandas_series_and_gives_floats():
    guess = know_nothing_guess(pd.Series([120, 180]), 2)
    assert guess.dtype == float and list(guess) == [150.0, 150.0]


def test_it_depends_only_on_the_training_totals_it_is_given():
    train = pd.Series([140, 160, 180])
    assert list(know_nothing_guess(train, 3)) == [160.0] * 3
    # nothing else can change it: there is nothing else for it to read
    assert list(know_nothing_guess(train.copy(), 3)) == list(know_nothing_guess(train, 3))


def test_it_has_no_randomness():
    first = know_nothing_guess([101, 199, 175, 133], 5)
    assert all(np.array_equal(first, know_nothing_guess([101, 199, 175, 133], 5)) for _ in range(3))


def test_on_the_real_data_it_is_the_mean_final_total_of_the_training_slice():
    slices = split_three_ways(load_innings())
    guess = know_nothing_guess(slices.train["final_total"], len(slices.test))
    assert len(guess) == len(slices.test)
    assert np.allclose(guess, slices.train["final_total"].mean())
    # and the validation and test years play no part in it
    assert not np.isclose(slices.test["final_total"].mean(), 0)


def test_asking_for_no_predictions_gives_an_empty_result():
    assert len(know_nothing_guess([100, 200], 0)) == 0
