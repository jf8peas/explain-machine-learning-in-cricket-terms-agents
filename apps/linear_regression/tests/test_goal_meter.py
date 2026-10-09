"""The miss meter's numbers, worked out on the server from the displayed one-decimal figures (feature 007)."""
import math

import pytest

from linreg import goal as goal_module
from linreg.goal import goal, meter

TRAINING = {"first_year": 2005, "last_year": 2024, "innings": 4036}


def marks(m):
    return {x["id"]: x["value"] for x in m["marks"]}


def test_goal_value_is_the_projections_displayed_miss_minus_the_margin():
    m = meter(29.4, 21.8, TRAINING)
    assert marks(m) == {"know_nothing": 29.4, "broadcaster": 21.8, "goal": 18.8}


def test_goal_value_is_rounded_to_one_decimal_where_plain_subtraction_is_not():
    # find a displayed value whose plain float subtraction carries noise, so the rounding step is shown to matter
    noisy = next(v / 10 for v in range(40, 400) if v / 10 - 3 != round(v / 10 - 3, 1))
    m = meter(noisy + 8, noisy, TRAINING)
    assert marks(m)["goal"] == round(noisy - 3, 1)
    assert marks(m)["goal"] != noisy - 3


def test_scale_for_todays_figures():
    assert meter(29.4, 21.8, TRAINING)["scale"] == {"min": 15, "max": 33}


def test_marks_are_three_in_a_fixed_order_with_labels_from_the_method_names():
    m = meter(29.4, 21.8, TRAINING)
    assert [x["id"] for x in m["marks"]] == ["know_nothing", "broadcaster", "goal"]
    assert [x["label"] for x in m["marks"]] == ["Know-nothing guess", "TV projection", "The goal"]


def test_caption_and_text_equivalent():
    m = meter(29.4, 21.8, TRAINING)
    assert m["caption"] == "Average miss, runs · 2005 to 2024, 4,036 innings"
    assert m["text"] == ("Average miss, lower is better: the know-nothing guess 29.4, the TV projection 21.8, "
                         "the goal 18.8 or less.")
    for s in (m["caption"], m["text"], *(x["label"] for x in m["marks"])):
        assert "<" not in s and ">" not in s


@pytest.mark.parametrize("known,projected", [
    (29.4, 21.8),     # today
    (20.0, 25.0),     # the projection is worse than knowing nothing
    (30.0, 2.0),      # a goal below zero
    (22.0, 21.8),     # a tiny spread (minimum padding)
    (100.0, 60.0),    # large figures
])
def test_every_value_is_strictly_inside_the_scale_with_room_either_side(known, projected):
    m = meter(known, projected, TRAINING)
    values = list(marks(m).values())
    low, high = min(values), max(values)
    pad = max(3, math.ceil(0.2 * (high - low)))
    assert m["scale"]["min"] == math.floor(low - pad)
    assert m["scale"]["max"] == math.ceil(high + pad)
    assert m["scale"]["min"] < low and high < m["scale"]["max"]
    assert float(m["scale"]["min"]).is_integer() and float(m["scale"]["max"]).is_integer()


def test_a_goal_at_or_below_zero_extends_the_scale_below_zero_and_is_stated_as_it_is():
    m = meter(30.0, 2.0, TRAINING)
    assert marks(m)["goal"] == -1.0
    assert m["scale"]["min"] < 0
    assert "the goal -1.0 or less" in m["text"]


def test_a_tiny_spread_still_gets_the_minimum_padding():
    m = meter(22.0, 21.8, TRAINING)      # values 18.8 / 21.8 / 22.0: spread 3.2, so the 20% share (0.64) is under 3
    assert m["scale"] == {"min": 15, "max": 25}


def test_lead_names_the_margin_and_follows_it(monkeypatch):
    g = goal()
    assert g["lead"] == ("At 10 overs, the TV shows a projected score. The agent tries to beat it: predict the final "
                         "total, and miss by 3 runs less on average.")
    monkeypatch.setattr(goal_module, "MARGIN_RUNS", 5)
    assert "miss by 5 runs less on average" in goal()["lead"]
    assert marks(meter(29.4, 21.8, TRAINING))["goal"] == 16.8
