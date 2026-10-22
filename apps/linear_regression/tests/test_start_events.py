"""The `start` event (feature 022): the server says when each node begins, so a page can show which node is working. It comes
before that node's `step`, carries the number the step will have and no state, and the router stays generic."""
import json
from typing import TypedDict

from fastapi import FastAPI
from fastapi.testclient import TestClient
from langgraph.graph import END, START, StateGraph

from api.index import app
from linreg.graph_api import create_router

from tests.test_api import parse_sse


_visitor = iter(range(1, 250))


def visitor_client():
    """The real app as a visitor of its own, so the per-visitor run limit is never shared with another test."""
    return TestClient(app, headers={"X-Forwarded-For": f"10.22.{next(_visitor)}.7"})


def kinds(events):
    return [e for e, _ in events]


def test_every_step_of_the_real_graph_is_preceded_by_its_start():
    events = parse_sse(visitor_client().get("/api/run").text)
    assert kinds(events)[-1] == "done"
    body = events[:-1]
    assert kinds(body) == ["start", "step"] * (len(body) // 2)
    for (_, started), (_, finished) in zip(body[::2], body[1::2]):
        assert started == {"step": finished["step"], "node": finished["node"]}      # no state, no summary
    assert [d["step"] for _, d in body[1::2]] == list(range(1, len(body) // 2 + 1))
    assert events[-1][1]["steps"] == len(body) // 2


def test_the_first_and_last_nodes_start_where_the_graph_starts_and_ends():
    events = parse_sse(visitor_client().get("/api/run").text)
    starts = [d["node"] for e, d in events if e == "start"]
    assert starts[:2] == ["load_data", "split"] and starts[-1] == "write_in_cricket_terms"


def local_client(nodes, edges):
    class S(TypedDict, total=False):
        a: int

    g = StateGraph(S)
    for name, fn in nodes:
        g.add_node(name, fn)
    for source, target in edges:
        g.add_edge(source, target)
    local = FastAPI()
    local.include_router(create_router(g.compile(), lambda: {}, 10), prefix="/api")
    return TestClient(local)


def test_a_generic_graph_gets_start_events_too():
    c = local_client([("one", lambda s: {"a": 1}), ("two", lambda s: {"a": 2})],
                     [(START, "one"), ("one", "two"), ("two", END)])
    events = parse_sse(c.get("/api/run").text)
    assert kinds(events) == ["start", "step", "start", "step", "done"]
    assert [d["node"] for e, d in events if e == "start"] == ["one", "two"]


def test_a_node_that_fails_sends_its_start_and_then_the_error():
    def boom(state):
        raise RuntimeError("kaboom")

    c = local_client([("fine", lambda s: {"a": 1}), ("boom", boom)], [(START, "fine"), ("fine", "boom"), ("boom", END)])
    events = parse_sse(c.get("/api/run").text)
    assert kinds(events) == ["start", "step", "start", "error"]
    assert events[2][1] == {"step": 2, "node": "boom"} and "kaboom" in events[3][1]["message"]
    assert "done" not in kinds(events)


def test_a_run_with_no_model_chosen_uses_the_default_model():
    client = visitor_client()
    default = next(m for m in client.get("/api/models").json()["models"] if m["default"])
    first = parse_sse(client.get("/api/run").text)[1][1]                  # the load_data step
    assert first["node"] == "load_data" and first["changes"]["model_name"] == default["name"]
