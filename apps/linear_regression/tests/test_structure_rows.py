"""The display rows in the structure response (feature 020): every node belongs to exactly one row, the rows arrive in order
with their notes, and the check says what is wrong when a node is missed."""
import pytest
from fastapi.testclient import TestClient

from api.index import app
from linreg import state
from linreg.graph import NODE_ACTORS, NODE_ROWS, build_graph
from linreg.llm_fake import default_fake
from linreg.stage_info import rows
from linreg.stages import Row, RowError, check_rows

client = TestClient(app)

EXPECTED = {
    "load_data": "start", "split": "start", "explore": "start", "baseline": "start",
    "propose_features": "round", "check_proposal": "round", "fit_model": "round", "evaluate": "round",
    "grid_search": "yardstick",
    "final_test": "end", "explain_in_cricket_terms": "end", "write_in_cricket_terms": "end",
}


def test_the_real_graph_passes_the_check():
    check_rows(build_graph(default_fake()), NODE_ROWS, rows())
    assert NODE_ROWS == EXPECTED and set(NODE_ROWS) == set(NODE_ACTORS)


def test_a_node_with_no_row_is_named():
    mapping = dict(NODE_ROWS)
    del mapping["evaluate"]
    with pytest.raises(RowError, match="node 'evaluate' has no row"):
        check_rows(build_graph(default_fake()), mapping, rows())


def test_an_unknown_row_is_named():
    with pytest.raises(RowError, match="unknown row 'nonsense'"):
        check_rows(build_graph(default_fake()), {**NODE_ROWS, "evaluate": "nonsense"}, rows())


def test_a_mapping_key_that_is_not_a_node_is_named():
    with pytest.raises(RowError, match="'typo' is in the row mapping"):
        check_rows(build_graph(default_fake()), {**NODE_ROWS, "typo": "start"}, rows())


def test_every_problem_is_listed_at_once():
    mapping = {k: v for k, v in NODE_ROWS.items() if k != "split"}
    with pytest.raises(RowError) as error:
        check_rows(build_graph(default_fake()), {**mapping, "evaluate": "nope"}, rows())
    assert "split" in str(error.value) and "nope" in str(error.value)


def test_the_structure_sends_each_nodes_row_and_the_rows_in_order():
    body = client.get("/api/structure").json()
    assert [r["id"] for r in body["rows"]] == ["start", "round", "yardstick", "end"]
    by_id = {n["id"]: n for n in body["nodes"]}
    for node, row in EXPECTED.items():
        assert by_id[node]["row"] == row
    assert "row" not in by_id["__start__"] and "row" not in by_id["__end__"]
    assert all(r["title"] and r["note"] for r in body["rows"])


def test_the_round_note_reads_the_round_cap_from_its_constant():
    note = {r["id"]: r["note"] for r in client.get("/api/structure").json()["rows"]}["round"]
    assert f"up to {state.ROUND_CAP} rounds" in note and "rejected ideas count" in note


def test_the_rows_set_has_no_empty_title_or_note():
    assert all(isinstance(r, Row) and r.title and r.note for r in rows())
