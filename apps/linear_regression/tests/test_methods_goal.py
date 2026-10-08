"""The four methods and the goal, each defined once, and the verdict worked out from displayed figures (feature 006)."""
import pytest

from linreg import goal as goal_module
from linreg.goal import CLEARLY_BETTER_SHARE, goal, reference_finding, verdict, verdict_sentence
from linreg.methods import BY_ID, METHODS, method_defs


# ---- the methods ----

def test_the_four_methods_in_display_order():
    assert [m.id for m in METHODS] == ["know_nothing", "broadcaster", "llm", "forward"]
    assert [m.marker for m in METHODS] == ["square", "circle", "triangle", "diamond"]


def test_every_method_has_its_own_name_note_and_marker():
    for field in ("id", "name", "note", "marker"):
        values = [getattr(m, field) for m in METHODS]
        assert all(values) and len(set(values)) == 4, field


def test_the_projection_is_called_the_tv_projection_and_its_note_says_what_it_is():
    m = BY_ID["broadcaster"]
    assert m.name == "the TV projection"
    assert "current run rate" in m.note and "20 overs" in m.note


def test_method_defs_are_plain_data_for_the_page_in_display_order():
    defs = method_defs(["forward", "know_nothing"])
    assert [d["id"] for d in defs] == ["know_nothing", "forward"]          # display order, whatever order is asked
    assert set(defs[0]) == {"id", "name", "note", "marker"}
    assert [d["id"] for d in method_defs()] == ["know_nothing", "broadcaster", "llm", "forward"]


# ---- the goal ----

def test_the_goal_is_built_from_the_margin_and_says_what_it_is_measured_against():
    g = goal()
    assert g["reference"] == "broadcaster" and g["margin_runs"] == 3
    assert "at least 3 runs of average miss" in g["text"]
    assert "TV projection" in g["text"] and "nothing was trained or chosen on" in g["text"]


def test_changing_the_margin_changes_the_goal_text_everywhere_it_is_built(monkeypatch):
    monkeypatch.setattr(goal_module, "MARGIN_RUNS", 5)
    g = goal()
    assert g["margin_runs"] == 5 and "at least 5 runs" in g["text"]
    assert verdict(20.0, 15.0, "forward")["reached"] is True
    assert verdict(20.0, 16.0, "forward")["reached"] is False


# ---- the verdict, from displayed figures ----

def test_the_verdict_for_a_small_win_short_of_the_goal():
    v = verdict(20.9, 18.9, "forward")
    assert v == {"reference_miss": 20.9, "winner_miss": 18.9, "improvement_runs": 2.0, "improvement_percent": 9.6,
                 "beat": True, "reached": False, "winner": "forward"}


def test_exactly_the_margin_is_reached():
    v = verdict(21.0, 18.0, "llm")
    assert v["improvement_runs"] == 3.0 and v["reached"] is True and v["beat"] is True


def test_floating_point_noise_does_not_decide_the_verdict():
    assert verdict(20.9, 17.9, "llm")["reached"] is True                    # 20.9 - 17.9 is 3.0000000000000036 in floats
    assert verdict(20.7, 17.7, "llm")["improvement_runs"] == 3.0


def test_a_worse_winner_has_a_negative_improvement_and_did_not_beat_it():
    v = verdict(20.0, 22.5, "forward")
    assert v["improvement_runs"] == -2.5 and v["improvement_percent"] == -12.5
    assert v["beat"] is False and v["reached"] is False


def test_a_reference_with_no_miss_does_not_divide_by_zero():
    v = verdict(0.0, 1.0, "llm")
    assert v["improvement_percent"] is None and v["beat"] is False


def test_the_percentage_can_be_reproduced_from_the_two_displayed_numbers():
    v = verdict(21.7, 19.3, "llm")
    assert v["improvement_percent"] == round((21.7 - 19.3) / 21.7 * 100, 1)


# ---- how good is the projection compared with knowing nothing ----

def test_the_clearly_better_share_is_ten_percent():
    assert CLEARLY_BETTER_SHARE == 0.10


@pytest.mark.parametrize("know_nothing,projection,expected", [
    (29.4, 21.8, "clearly_better"),          # 25.9% lower
    (30.0, 27.0, "clearly_better"),          # exactly 10% lower counts
    (30.0, 27.1, "slightly_better"),         # just under
    (30.0, 29.9, "slightly_better"),
    (30.0, 30.0, "no_better"),
    (30.0, 33.0, "no_better"),
])
def test_the_finding_for_the_projection_against_knowing_nothing(know_nothing, projection, expected):
    assert reference_finding(know_nothing, projection)["finding"] == expected


def test_the_finding_reports_the_gap_in_runs_and_percent_from_the_displayed_figures():
    f = reference_finding(29.4, 21.8)
    assert f["gap_runs"] == 7.6 and f["gap_percent"] == round(7.6 / 29.4 * 100, 1)


def test_the_finding_copes_with_a_know_nothing_miss_of_zero():
    f = reference_finding(0.0, 1.0)
    assert f["finding"] == "no_better" and f["gap_percent"] is None


# ---- the verdict in words ----

def test_a_win_that_reaches_the_goal_says_so_with_the_runs_and_the_percentage():
    text = verdict_sentence(verdict(21.0, 17.0, "llm"))
    assert "beat the TV projection by 4.0 runs (19.0%)" in text and "reaches the goal of at least 3 runs" in text


def test_a_win_short_of_the_goal_says_so_plainly():
    text = verdict_sentence(verdict(20.9, 18.9, "forward"))
    assert "beat the TV projection by 2.0 runs (9.6%)" in text and "short of the goal of at least 3 runs" in text


def test_a_loss_says_it_did_not_beat_the_projection_and_by_how_much_worse():
    text = verdict_sentence(verdict(20.0, 22.5, "forward"))
    assert "did not beat the TV projection" in text and "2.5 runs" in text and "worse" in text


def test_a_tie_is_not_a_win():
    assert "did not beat the TV projection" in verdict_sentence(verdict(20.0, 20.0, "forward"))


def test_the_goal_in_the_verdict_follows_the_margin(monkeypatch):
    monkeypatch.setattr(goal_module, "MARGIN_RUNS", 5)
    assert "at least 5 runs" in verdict_sentence(verdict(21.0, 17.0, "llm"))
