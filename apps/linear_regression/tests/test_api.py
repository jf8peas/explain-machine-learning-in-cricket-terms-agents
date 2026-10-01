import json
from pathlib import Path
from typing import TypedDict

import jsonschema
from fastapi import FastAPI
from fastapi.testclient import TestClient
from langgraph.graph import END, START, StateGraph

from api.index import app
from linreg.graph_api import create_router, to_jsonable

CONTRACTS = Path(__file__).resolve().parents[3] / "specs" / "001-linear-regression-agent" / "contracts"
STRUCTURE_SCHEMA = json.loads((CONTRACTS / "structure.schema.json").read_text())
STEP_SCHEMA = json.loads((CONTRACTS / "step-event.schema.json").read_text())
client = TestClient(app)

NODE_ORDER_PREFIX = ["load_data", "explore", "split", "baseline", "fit_model", "evaluate"]


def parse_sse(text: str) -> list[tuple[str, dict]]:
    out = []
    for block in text.strip().split("\n\n"):
        lines = block.split("\n")
        out.append((lines[0].removeprefix("event: "), json.loads(lines[1].removeprefix("data: "))))
    return out


def test_structure_matches_schema_and_has_branch_labels():
    r = client.get("/api/structure")
    assert r.status_code == 200
    body = r.json()
    jsonschema.validate(body, STRUCTURE_SCHEMA)
    conditional = {(e["source"], e["target"]): e["branch"] for e in body["edges"] if e["conditional"]}
    assert conditional == {
        ("load_data", "explore"): "ok",
        ("load_data", "__end__"): "stop",
        ("evaluate", "tune"): "tune",
        ("evaluate", "explain_in_cricket_terms"): "explain",
    }
    assert {n["id"] for n in body["nodes"]} == {
        "__start__", "__end__", "load_data", "explore", "split", "baseline", "fit_model",
        "evaluate", "tune", "explain_in_cricket_terms"}


def test_run_streams_valid_ordered_events_then_done():
    r = client.get("/api/run")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")
    assert r.headers["cache-control"] == "no-cache"
    events = parse_sse(r.text)
    assert events[-1][0] == "done"
    steps = [d for e, d in events if e == "step"]
    assert events[-1][1]["steps"] == len(steps)
    assert [s["step"] for s in steps] == list(range(1, len(steps) + 1))
    for s in steps:
        jsonschema.validate(s, STEP_SCHEMA)
        assert "summary" not in s["changes"] and s["summary"]
    nodes = [s["node"] for s in steps]
    assert nodes[: len(NODE_ORDER_PREFIX)] == NODE_ORDER_PREFIX
    assert nodes[-1] == "explain_in_cricket_terms"
    # attempts arrive accumulated: one more entry after each evaluate
    counts = [len(s["changes"]["attempts"]) for s in steps if s["node"] == "evaluate"]
    assert counts == list(range(1, len(counts) + 1))


def test_error_event_on_unexpected_failure():
    class S(TypedDict, total=False):
        x: int

    def boom(state):
        raise RuntimeError("kaboom")

    g = StateGraph(S)
    g.add_node("boom", boom)
    g.add_edge(START, "boom")
    g.add_edge("boom", END)
    local = FastAPI()
    local.include_router(create_router(g.compile(), lambda: {}, 10), prefix="/api")
    events = parse_sse(TestClient(local).get("/api/run").text)
    assert events[-1][0] == "error" and "kaboom" in events[-1][1]["message"]
    assert "done" not in [e for e, _ in events]


def test_router_is_generic_for_any_graph():
    class S(TypedDict, total=False):
        a: int
        b: int

    g = StateGraph(S)
    g.add_node("one", lambda s: {"a": 1, "summary": "x"} if False else {"a": 1})
    g.add_node("two", lambda s: {"b": 2})
    g.add_edge(START, "one")
    g.add_edge("one", "two")
    g.add_edge("two", END)
    local = FastAPI()
    local.include_router(create_router(g.compile(), lambda: {}, 10), prefix="/api")
    c = TestClient(local)
    assert [e["target"] for e in c.get("/api/structure").json()["edges"]] == ["one", "two", "__end__"]
    steps = [d for e, d in parse_sse(c.get("/api/run").text) if e == "step"]
    assert [(s["node"], s["changes"]) for s in steps] == [("one", {"a": 1}), ("two", {"b": 2})]


def test_numpy_and_nan_become_plain_json():
    import numpy as np
    out = to_jsonable({"a": np.float64(1.5), "b": np.int64(3), "c": float("nan"), "d": [np.float32(2)]})
    assert out == {"a": 1.5, "b": 3, "c": None, "d": [2.0]}
    json.dumps(out, allow_nan=False)
