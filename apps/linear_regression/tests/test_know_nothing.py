"""The know-nothing guess: every innings is predicted to end on the training years' average final total (feature 006)."""
import numpy as np
import pandas as pd

from linreg.data_loading import load_innings
from linreg.evaluation import know_nothing_guess
from linreg.season_split import rolling_checks


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


def test_on_the_real_data_it_is_the_mean_of_the_test_population_innings_before_the_year_scored():
    rolling = rolling_checks(load_innings())
    for spec in (*rolling.checks, rolling.final):
        before = rolling.training_rows(spec, "all", "population")
        assert before["in_test_population"].eq(1).all() and (before["match_date"].dt.year < spec.year).all()
        guess = know_nothing_guess(before["final_total"], 5)
        assert np.allclose(guess, before["final_total"].mean())


def test_associate_innings_and_later_years_play_no_part_in_the_guess():
    rolling = rolling_checks(load_innings())
    spec = rolling.checks[1]
    everything = rolling.training_rows(spec, "all", "all")["final_total"].mean()
    population = know_nothing_guess(rolling.training_rows(spec, "all", "population")["final_total"], 1)[0]
    assert population != everything                          # the associate innings would have moved it
    assert not np.isclose(population, rolling.check_rows(spec)["final_total"].mean())


def test_asking_for_no_predictions_gives_an_empty_result():
    assert len(know_nothing_guess([100, 200], 0)) == 0
