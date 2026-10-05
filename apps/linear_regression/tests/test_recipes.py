"""The declarative recipes that define derived features (difference, product, indicator)."""
import pandas as pd
import pytest

from linreg.recipes import RecipeError, evaluate, inputs

DF = pd.DataFrame({"wickets_at_10": [0, 3, 9], "runs_at_10": [80, 70, 55], "wickets_in_hand": [10, 7, 1],
                   "competition": ["ipl", "bbl", "t20i"]})


def test_difference_is_a_constant_minus_a_column():
    out = evaluate({"difference": {"from": 10, "of": "wickets_at_10"}}, DF)
    assert out.tolist() == [10, 7, 1]
    assert out.dtype.kind == "i"


def test_difference_of_two_columns():
    out = evaluate({"difference": {"from": "runs_at_10", "of": "wickets_at_10"}}, DF)
    assert out.tolist() == [80, 67, 46]


def test_product_of_two_columns_including_a_derived_one():
    out = evaluate({"product": ["runs_at_10", "wickets_in_hand"]}, DF)
    assert out.tolist() == [800, 490, 55]


def test_indicator_is_one_when_equal_and_zero_otherwise():
    out = evaluate({"indicator": {"column": "competition", "equals": "ipl"}}, DF)
    assert out.tolist() == [1, 0, 0]
    assert out.dtype.kind == "i"


def test_evaluate_works_on_a_single_row_given_as_a_dict():
    row = {"wickets_at_10": 2, "runs_at_10": 60, "wickets_in_hand": 8, "competition": "bbl"}
    assert evaluate({"difference": {"from": 10, "of": "wickets_at_10"}}, row) == 8
    assert evaluate({"product": ["runs_at_10", "wickets_in_hand"]}, row) == 480
    assert evaluate({"indicator": {"column": "competition", "equals": "bbl"}}, row) == 1


def test_inputs_lists_the_columns_a_recipe_reads():
    assert inputs({"difference": {"from": 10, "of": "wickets_at_10"}}) == ["wickets_at_10"]
    assert inputs({"difference": {"from": "runs_at_10", "of": "wickets_at_10"}}) == ["runs_at_10", "wickets_at_10"]
    assert inputs({"product": ["runs_at_10", "wickets_in_hand"]}) == ["runs_at_10", "wickets_in_hand"]
    assert inputs({"indicator": {"column": "competition", "equals": "ipl"}}) == ["competition"]


def test_an_unknown_column_gives_a_clear_error():
    with pytest.raises(RecipeError, match="no_such_column"):
        evaluate({"product": ["runs_at_10", "no_such_column"]}, DF)


def test_an_unknown_recipe_kind_gives_a_clear_error():
    with pytest.raises(RecipeError, match="unknown recipe"):
        evaluate({"square": "runs_at_10"}, DF)
    with pytest.raises(RecipeError):
        inputs({"square": "runs_at_10"})
