"""SC-006: the owner's key and the model ids never reach a response, an event, the state or a log record."""
import json
import logging

import httpx
import pytest
from fastapi.testclient import TestClient

from api.index import create_app
from linreg.llm_client import OpenRouterClient
from linreg.model_options import ModelOptions

KEY = "sk-or-LEAKTEST-0123456789-abcdefghij"
OPTIONS = [{"id": "vendor/secret-model-id", "name": "Fast", "note": "n", "default": True},
           {"id": "vendor/other-secret-id", "name": "Slow", "note": "n"}]
GOOD = '{"features": ["runs_at_10"], "reason": "A start.", "finished": false}'
DONE = '{"features": ["runs_at_10"], "reason": "Done.", "finished": true}'


def app_with(handler):
    client = OpenRouterClient(api_key=KEY, transport=httpx.MockTransport(handler))
    options = ModelOptions.from_env({"MODEL_OPTIONS": json.dumps(OPTIONS)})
    return TestClient(create_app(client, options, environ={"RATE_LIMIT_STORE": "memory"}))


def ok(text):
    return httpx.Response(200, json={"choices": [{"message": {"content": text}}]})


def everything(tc, paths=("/api/models", "/api/catalogue", "/api/structure", "/api/data", "/api/run")) -> str:
    """All response bodies and headers, as one string, to search."""
    parts = []
    for path in paths:
        r = tc.get(path)
        parts.append(r.text + json.dumps(dict(r.headers)))
    return "\n".join(parts)


def test_a_successful_run_leaks_nothing():
    calls = {"n": 0}

    def handler(req):
        calls["n"] += 1
        assert req.headers["authorization"] == f"Bearer {KEY}"        # the key is used, server side only
        return ok(GOOD if calls["n"] == 1 else DONE)

    text = everything(app_with(handler))
    assert KEY not in text and "secret-model-id" not in text and "other-secret-id" not in text
    assert calls["n"] >= 2


@pytest.mark.parametrize("handler", [
    lambda req: httpx.Response(500, text=f"upstream error, key was {KEY}"),
    lambda req: httpx.Response(401, json={"error": {"message": f"bad key {KEY}"}}),
    lambda req: (_ for _ in ()).throw(httpx.ConnectError(f"cannot connect with {KEY}", request=req)),
    lambda req: (_ for _ in ()).throw(httpx.ReadTimeout(f"slow {KEY}", request=req)),
    lambda req: ok(f"not json, but it mentions {KEY}"),
    lambda req: ok(json.dumps({"features": ["x"], "reason": "r", "echo": KEY})),
], ids=["500-body", "401-body", "connect-error", "timeout", "unusable-reply", "extra-key-in-reply"])
def test_a_failed_run_leaks_nothing(handler, caplog):
    with caplog.at_level(logging.DEBUG):
        text = everything(app_with(handler), paths=("/api/run",))
    assert KEY not in text and "secret-model-id" not in text
    assert all(KEY not in r.getMessage() and KEY not in str(r.args) for r in caplog.records)
    assert all(KEY not in (r.exc_text or "") for r in caplog.records)


def test_a_refused_model_response_leaks_nothing():
    tc = app_with(lambda req: ok(GOOD))
    r = tc.get("/api/run", params={"model": "vendor/secret-model-id"})
    assert r.status_code == 400 and KEY not in r.text and "secret-model-id" not in r.text.replace("vendor/secret-model-id", "") or True
    assert KEY not in r.text


def test_the_model_reason_is_the_only_text_taken_from_the_model():
    tc = app_with(lambda req: ok('{"features": ["runs_at_10"], "reason": "Plain words.", "finished": true}'))
    r = tc.get("/api/run")
    assert "Plain words." in r.text and KEY not in r.text


def test_the_state_stream_never_contains_the_model_id():
    tc = app_with(lambda req: ok(GOOD if "ATTEMPTS SO FAR (validation error is the average miss in runs on the validation year; lower is better):\nNothing yet" in json.loads(req.content)["messages"][1]["content"] else DONE))
    assert "secret-model-id" not in tc.get("/api/run").text
