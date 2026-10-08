"""The generic accuracy function: how far predictions are from actual values, in the four ways the page shows (feature 006)."""
import numpy as np
import pytest

from linreg.accuracy import (LARGE_BIAS_SHARE, TOLERANCES, accuracy, display, is_large_bias,
                             same_direction_large_bias)

# actual 100, 150, 200 and predicted 110, 140, 230 are off by +10, -10, +30
ACTUAL = [100, 150, 200]
PREDICTED = [110, 140, 230]


def test_the_tolerances_are_ten_and_twenty_runs():
    assert TOLERANCES == (10, 20)
    assert LARGE_BIAS_SHARE == 0.5


def test_the_figures_for_a_small_set_worked_out_by_hand():
    f = accuracy(ACTUAL, PREDICTED)
    assert f["n"] == 3
    assert f["average_miss"] == pytest.approx((10 + 10 + 30) / 3)
    assert f["within_10"] == pytest.approx(2 / 3 * 100)        # +10 and -10 are within 10; +30 is not
    assert f["within_20"] == pytest.approx(2 / 3 * 100)
    assert f["miss_percent"] == pytest.approx(((10 + 10 + 30) / 3) / 150 * 100)
    assert f["bias"] == pytest.approx((10 - 10 + 30) / 3)      # positive: too high on average


def test_a_miss_of_exactly_ten_counts_as_within_ten_and_exactly_twenty_as_within_twenty():
    f = accuracy([100, 100, 100], [110, 90, 120])              # +10, -10, +20
    assert f["within_10"] == pytest.approx(2 / 3 * 100)
    assert f["within_20"] == pytest.approx(100.0)


def test_predictions_are_not_rounded_before_they_are_scored():
    inside = accuracy([100], [109.96])
    outside = accuracy([100], [110.04])
    assert inside["within_10"] == 100.0 and outside["within_10"] == 0.0


def test_errors_that_cancel_give_zero_bias_but_not_zero_miss():
    f = accuracy([100, 150], [110, 140])
    assert f["bias"] == pytest.approx(0.0)
    assert f["average_miss"] == pytest.approx(10.0)


def test_a_method_that_guesses_too_low_has_a_negative_bias():
    assert accuracy([100, 200], [90, 180])["bias"] == pytest.approx(-15.0)


def test_numpy_arrays_and_pandas_style_inputs_work():
    f = accuracy(np.array([100.0, 200.0]), np.array([100.0, 200.0]))
    assert f["average_miss"] == 0.0 and f["within_10"] == 100.0 and f["bias"] == 0.0


def test_a_single_innings_works():
    f = accuracy([150], [130])
    assert f["n"] == 1 and f["average_miss"] == 20.0 and f["within_20"] == 100.0 and f["within_10"] == 0.0


def test_no_innings_gives_a_count_of_zero_and_no_figures_instead_of_an_error():
    f = accuracy([], [])
    assert f["n"] == 0
    assert all(f[k] is None for k in ("average_miss", "within_10", "within_20", "miss_percent", "bias"))
    assert display(f)["n"] == 0
    assert is_large_bias(f) is False


def test_a_mean_actual_of_zero_gives_no_percentage_but_the_rest_still_work():
    f = accuracy([0, 0], [1, 3])
    assert f["miss_percent"] is None and f["average_miss"] == 2.0


def test_mismatched_lengths_are_an_error():
    with pytest.raises(ValueError):
        accuracy([1, 2, 3], [1, 2])


def test_display_rounds_runs_and_percentages_to_one_decimal_and_keeps_the_count_whole():
    shown = display(accuracy(ACTUAL, PREDICTED))
    assert shown == {"n": 3, "average_miss": 16.7, "within_10": 66.7, "within_20": 66.7, "miss_percent": 11.1, "bias": 10.0}
    assert isinstance(shown["n"], int)


def test_display_does_not_change_its_input():
    raw = accuracy(ACTUAL, PREDICTED)
    before = dict(raw)
    display(raw)
    assert raw == before


# --- the "large bias" rule ---

def test_a_bias_at_half_the_average_miss_is_large_and_just_below_is_not():
    assert is_large_bias({"average_miss": 10.0, "bias": 5.0}) is True            # exactly half: large
    assert is_large_bias({"average_miss": 10.0, "bias": 4.99}) is False
    assert is_large_bias({"average_miss": 10.0, "bias": 5.01}) is True


def test_the_size_of_a_bias_counts_whichever_way_it_leans():
    assert is_large_bias({"average_miss": 10.0, "bias": -5.0}) is True
    assert is_large_bias({"average_miss": 10.0, "bias": -4.0}) is False


def test_with_no_miss_at_all_there_is_no_large_bias():
    assert is_large_bias({"average_miss": 0.0, "bias": 0.0}) is False


def big(bias):
    return {"average_miss": 10.0, "bias": bias}


def test_the_same_large_bias_direction_across_methods_is_reported_as_that_direction():
    assert same_direction_large_bias([big(-8.0), big(-6.0), big(-12.0)]) == "low"
    assert same_direction_large_bias([big(8.0), big(6.0)]) == "high"


def test_mixed_directions_or_any_small_bias_or_fewer_than_two_methods_report_nothing():
    assert same_direction_large_bias([big(-8.0), big(8.0)]) is None
    assert same_direction_large_bias([big(-8.0), big(-1.0)]) is None
    assert same_direction_large_bias([big(-8.0)]) is None
    assert same_direction_large_bias([]) is None
