"""The shared stage set and the check that every node has a stage (feature 005)."""
import json
from typing import TypedDict

import pytest
from langgraph.graph import END, START, StateGraph

from linreg.stages import CHOOSE_STAGE, FIT_STAGE, STAGES, StageError, check_stages, stage_set


class S(TypedDict, total=False):
    x: int


def toy_app():
    g = StateGraph(S)
    for name in ("a", "b", "c"):
        g.add_node(name, lambda state: {})
    g.add_edge(START, "a")
    g.add_edge("a", "b")
    g.add_edge("b", "c")
    g.add_edge("c", END)
    return g.compile()


EXPECTED = [
    ("frame", "Frame the problem", "What are we predicting, and what counts as good?"),
    ("prepare", "Prepare the data", "Is the data clean and in a usable form?"),
    ("understand", "Understand the data", "What patterns are there?"),
    ("split", "Split the data", "What do we learn from, choose with, and mark on?"),
    ("fit", "Fit the model", "What are the best parameters for this setup?"),
    ("choose", "Choose the setup", "Which features, model type and hyperparameters?"),
    ("assess", "Final assessment", "How good is it on data it has never seen?"),
    ("interpret", "Interpret and communicate", "What does it mean?"),
]


def test_the_set_is_the_eight_stages_in_order():
    assert [(s.id, s.name, s.question) for s in STAGES] == EXPECTED


def test_numbers_are_positions_and_ids_and_numbers_are_unique():
    assert [s.number for s in STAGES] == list(range(1, 9))
    assert len({s.id for s in STAGES}) == 8


def test_every_stage_has_a_one_sentence_description():
    for s in STAGES:
        assert s.description.strip() and s.description.endswith(".")
        assert s.description.count(". ") == 0, f"{s.id} has more than one sentence"


def test_the_loop_stages_are_in_the_set():
    ids = [s.id for s in STAGES]
    assert (FIT_STAGE, CHOOSE_STAGE) == ("fit", "choose") and FIT_STAGE in ids and CHOOSE_STAGE in ids


def test_stage_set_is_plain_json_data():
    data = stage_set()
    assert json.loads(json.dumps(data)) == data
    assert [d["id"] for d in data] == [e[0] for e in EXPECTED]
    assert set(data[0]) == {"id", "number", "name", "question", "description"}


def test_a_full_mapping_passes_and_start_and_end_are_ignored():
    check_stages(toy_app(), {"a": "prepare", "b": "fit", "c": "interpret"})


def test_a_node_with_no_stage_fails_and_is_named():
    with pytest.raises(StageError) as err:
        check_stages(toy_app(), {"a": "prepare", "c": "interpret"})
    assert "b" in str(err.value) and "no stage" in str(err.value)


def test_an_unknown_stage_fails_and_is_named():
    with pytest.raises(StageError) as err:
        check_stages(toy_app(), {"a": "prepare", "b": "nonsense", "c": "interpret"})
    assert "nonsense" in str(err.value)


def test_a_mapping_key_that_is_not_a_node_fails():
    with pytest.raises(StageError) as err:
        check_stages(toy_app(), {"a": "prepare", "b": "fit", "c": "interpret", "typo": "fit"})
    assert "typo" in str(err.value)


def test_every_problem_is_reported_at_once():
    with pytest.raises(StageError) as err:
        check_stages(toy_app(), {"a": "bad", "extra": "fit"})
    text = str(err.value)
    assert "a" in text and "bad" in text and "b" in text and "c" in text and "extra" in text


def test_another_apps_stage_list_can_be_checked_against():
    from linreg.stages import Stage
    mine = (Stage("one", 1, "One", "Q?", "Do one."), Stage("two", 2, "Two", "Q?", "Do two."))
    check_stages(toy_app(), {"a": "one", "b": "two", "c": "two"}, stages=mine)
    with pytest.raises(StageError):
        check_stages(toy_app(), {"a": "one", "b": "two", "c": "fit"}, stages=mine)
