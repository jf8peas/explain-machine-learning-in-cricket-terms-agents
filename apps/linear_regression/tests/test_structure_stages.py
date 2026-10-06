"""Stages in the structure response (feature 005): the generic merge in graph_api and this app's assignments."""
from typing import TypedDict

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from langgraph.graph import END, START, StateGraph

from api.index import app
from linreg.graph import NODE_ACTORS, NODE_STAGES, build_graph
from linreg.graph_api import create_router
from linreg.llm_fake import default_fake
from linreg.stages import CHOOSE_STAGE, FIT_STAGE, STAGES, StageError, check_stages

client = TestClient(app)


class S(TypedDict, total=False):
    x: int


def toy_client(**router_args):
    g = StateGraph(S)
    g.add_node("one", lambda state: {})
    g.add_edge(START, "one")
    g.add_edge("one", END)
    api = FastAPI()
    api.include_router(create_router(g.compile(), lambda: {}, 10, **router_args), prefix="/api")
    return TestClient(api)


def test_without_extras_the_structure_is_exactly_as_before():
    body = toy_client().get("/api/structure").json()
    assert set(body) == {"nodes", "edges"}


def test_extras_are_merged_without_the_router_knowing_their_content():
    calls = []

    def extras():
        calls.append(1)
        return {"anything": {"a": 1}, "more": ["b"]}

    c = toy_client(structure_extras=extras)
    first = c.get("/api/structure").json()
    assert first["anything"] == {"a": 1} and first["more"] == ["b"] and "nodes" in first and "edges" in first
    c.get("/api/structure")
    assert len(calls) == 1                                  # computed once, then kept


def test_a_failed_extras_call_is_not_kept_and_the_structure_still_loads():
    attempts = []

    def flaky():
        attempts.append(1)
        if len(attempts) == 1:
            raise RuntimeError("data not readable")
        return {"ok": True}

    c = toy_client(structure_extras=flaky)
    assert set(c.get("/api/structure").json()) == {"nodes", "edges"}   # the graph itself is still served
    assert c.get("/api/structure").json()["ok"] is True                # tried again, then kept
    assert len(attempts) == 2


def test_node_meta_stage_reaches_each_node():
    c = toy_client(node_meta={"one": {"stage": "fit"}})
    assert [n.get("stage") for n in c.get("/api/structure").json()["nodes"]] == [None, "fit", None]


def test_the_real_structure_has_the_eight_stages_in_order_and_the_loop():
    body = client.get("/api/structure").json()
    assert [s["id"] for s in body["stages"]] == [s.id for s in STAGES]
    assert [s["number"] for s in body["stages"]] == list(range(1, 9))
    assert body["loop"] == {"fit": FIT_STAGE, "choose": CHOOSE_STAGE}


EXPECTED = {
    "baseline": "frame", "load_data": "prepare", "explore": "understand", "split": "split", "fit_model": "fit",
    "propose_features": "choose", "check_proposal": "choose", "evaluate": "choose", "forward_selection": "choose",
    "final_test": "assess", "explain_in_cricket_terms": "interpret",
}


def test_every_real_node_has_its_stage_and_start_and_end_have_none():
    nodes = {n["id"]: n for n in client.get("/api/structure").json()["nodes"]}
    for name, stage in EXPECTED.items():
        assert nodes[name]["stage"] == stage and nodes[name]["actor"] == NODE_ACTORS[name]
    assert "stage" not in nodes["__start__"] and "stage" not in nodes["__end__"]
    assert NODE_STAGES == EXPECTED


def test_the_real_graph_passes_the_check():
    check_stages(build_graph(default_fake()), NODE_STAGES)


def test_removing_one_nodes_stage_makes_the_check_fail():
    mapping = dict(NODE_STAGES)
    del mapping["evaluate"]
    with pytest.raises(StageError, match="evaluate"):
        check_stages(build_graph(default_fake()), mapping)
    with pytest.raises(StageError, match="not-a-stage"):
        check_stages(build_graph(default_fake()), {**NODE_STAGES, "evaluate": "not-a-stage"})


def test_the_structure_with_stages_matches_the_schema_and_the_new_fields_are_optional():
    import json
    from pathlib import Path
    import jsonschema
    schema = json.loads((Path(__file__).resolve().parents[3] / "specs" / "001-linear-regression-agent" / "contracts"
                         / "structure.schema.json").read_text())
    jsonschema.validate(client.get("/api/structure").json(), schema)
    jsonschema.validate(toy_client().get("/api/structure").json(), schema)          # none of the new fields present
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate({**toy_client().get("/api/structure").json(), "stages": [{"id": "x"}]}, schema)


def test_the_web_fixture_of_this_apps_structure_matches_the_live_response():
    """web/tests/fixtures/linreg-structure.json lets Vitest use this app's real graph. Regenerate it when the
    structure changes (see the comment in web/tests/unit/bands.test.ts)."""
    import json
    from pathlib import Path
    fixture = json.loads((Path(__file__).resolve().parents[1] / "web" / "tests" / "fixtures"
                          / "linreg-structure.json").read_text(encoding="utf-8"))
    assert fixture == client.get("/api/structure").json()
