"""GET /api/models and the model choice on /api/run: only the owner's list can ever be used."""
import json

import pytest
from fastapi.testclient import TestClient

import api.index as index
from api.index import app

client = TestClient(app)


def run_events(query: str = ""):
    r = client.get("/api/run" + query)
    return r


def steps(r) -> list[dict]:
    out = []
    for block in r.text.strip().split("\n\n"):
        lines = block.split("\n")
        if lines[0] == "event: step":
            out.append(json.loads(lines[1].removeprefix("data: ")))
    return out


def model_name_of(r) -> str:
    return steps(r)[0]["changes"]["model_name"]


def test_models_lists_names_notes_the_default_and_tokens_but_never_an_id():
    r = client.get("/api/models")
    assert r.status_code == 200
    models = r.json()["models"]
    assert [m["choice"] for m in models] == [f"m{i}" for i in range(1, len(models) + 1)]
    assert sum(1 for m in models if m["default"]) == 1 and models[0]["default"] is True
    assert all(m["name"] and m["note"] for m in models)
    assert "fake/" not in r.text and "/" not in "".join(m["choice"] for m in models)
    assert "s-maxage" in r.headers["cache-control"]


def test_a_run_with_no_model_uses_the_default():
    r = run_events()
    assert r.status_code == 200 and model_name_of(r) == "Fast"
    assert index.llm.requests[-1].model == "fake/steady"


def test_a_listed_choice_is_used_and_only_its_friendly_name_is_in_the_run():
    before = len(index.llm.requests)
    r = run_events("?model=m2")
    assert r.status_code == 200 and model_name_of(r) == "Quick"
    assert index.llm.requests[before].model == "fake/quick"
    assert "fake/" not in r.text                                   # the id never reaches the browser


@pytest.mark.parametrize("value", ["m0", "m99", "M1", "", "m1 ", "fake/steady", "openai/gpt-6-luna", "../m1", "m-1", "null"])
def test_anything_not_on_the_list_is_refused_before_any_model_call(value):
    before = len(index.llm.requests)
    r = client.get("/api/run", params={"model": value})
    assert r.status_code == 400
    body = r.json()
    assert body["reason"] == "model_not_allowed" and "no longer available" in body["message"] or "not available" in body["message"]
    assert r.headers["content-type"].startswith("application/json")  # not a stream
    assert len(index.llm.requests) == before                       # no model was called


def test_a_repeated_model_parameter_is_an_altered_request_and_is_refused():
    before = len(index.llm.requests)
    r = client.get("/api/run?model=m1&model=fake/steady")
    assert r.status_code == 400 and r.json()["reason"] == "model_not_allowed"
    assert len(index.llm.requests) == before


def test_every_model_ever_called_is_on_the_owners_list():
    allowed = {"fake/steady", "fake/quick", "fake/slow", "fake/markup", "fake/broken", "fake/timeout"}
    assert all(call.model in allowed for call in index.llm.requests)


def test_the_run_state_holds_the_name_not_the_id():
    r = run_events("?model=m4")
    state_text = json.dumps([s["changes"] for s in steps(r)])
    assert "Markup" in state_text and "fake/markup" not in state_text
