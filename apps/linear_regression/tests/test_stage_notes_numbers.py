"""The numbers in the stage notes are the app's constants, not copies of them (feature 010).

Each number is found in its note by the words around it, then compared with the constant that defines it. Changing a
constant changes the note; a number typed into the copy would fail here.
"""
import re

import pytest

from linreg import selection, setup_settings, state
from linreg.stage_info import note_texts, stage_notes
from linreg.season_split import rolling_checks
from linreg.data_loading import load_innings

COUNT_WORDS = {1: "one", 2: "two", 3: "three", 4: "four"}


def number_after(text: str, before: str) -> int:
    m = re.search(re.escape(before) + r"\s*(\d+)", text)
    assert m, f"'{before}' followed by a number is not in: {text[:80]}..."
    return int(m.group(1))


def number_before(text: str, after: str) -> int:
    m = re.search(r"(\d+)[ -]" + re.escape(after), text)
    assert m, f"a number before '{after}' is not in: {text[:80]}..."
    return int(m.group(1))


def test_the_feature_limit_the_round_cap_the_stop_rule_and_the_grid_size_in_the_choose_note():
    note = stage_notes()["choose"]
    assert number_after(note, "feature subset (up to") == state.SET_LIMIT
    assert number_after(note, "The loop runs up to") == state.ROUND_CAP
    assert number_after(note, "stops after") == state.NO_IMPROVE_STOP
    assert number_after(note, "grid search tries all") == len(selection.GRID)


def test_the_goal_margin_in_the_frame_and_assess_notes():
    notes = stage_notes()
    assert number_after(notes["frame"], "beat the TV projection by") == state.MARGIN_RUNS
    assert number_before(notes["assess"], "run goal was met") == state.MARGIN_RUNS


@pytest.mark.parametrize("name,value", [("SET_LIMIT", 5), ("ROUND_CAP", 9), ("NO_IMPROVE_STOP", 3), ("MARGIN_RUNS", 4)])
def test_changing_a_constant_changes_the_note(monkeypatch, name, value):
    monkeypatch.setattr(state, name, value)
    notes = note_texts()
    where = {"SET_LIMIT": ("choose", "feature subset (up to"), "ROUND_CAP": ("choose", "The loop runs up to"),
             "NO_IMPROVE_STOP": ("choose", "stops after"), "MARGIN_RUNS": ("frame", "beat the TV projection by")}[name]
    assert number_after(notes[where[0]], where[1]) == value


def test_changing_the_grid_changes_the_note(monkeypatch):
    monkeypatch.setattr(selection, "GRID", selection.GRID[:7])
    assert number_after(note_texts()["choose"], "grid search tries all") == 7


def test_a_margin_that_is_not_whole_keeps_its_decimal(monkeypatch):
    monkeypatch.setattr(state, "MARGIN_RUNS", 2.5)
    assert "by 2.5 runs of MAE" in note_texts()["frame"]


def test_the_split_note_counts_the_same_checks_as_the_rolling_checks():
    word = COUNT_WORDS[len(rolling_checks(load_innings()).checks)]
    assert len(setup_settings.CHECK_OFFSETS) == len(rolling_checks(load_innings()).checks)
    split = stage_notes()["split"]
    assert f"each of the {word} years before the latest" in split and f"the {word} mean absolute errors" in split
