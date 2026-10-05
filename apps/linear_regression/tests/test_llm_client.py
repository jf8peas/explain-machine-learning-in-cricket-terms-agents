"""The OpenRouter client, exercised through httpx.MockTransport: no test reaches the network."""
import json
import logging

import httpx
import pytest

from linreg.llm_client import LlmRequest, LlmTimeout, LlmUnavailable, OpenRouterClient

KEY = "sk-or-test-SECRET-key-1234567890"
SCHEMA = {"type": "object", "properties": {"features": {"type": "array"}}}


def request(**kw) -> LlmRequest:
    base = dict(model="vendor/model-1", system="You choose features.", user="Which next?", max_tokens=700,
                timeout=12.5, json_schema=SCHEMA)
    base.update(kw)
    return LlmRequest(**base)


def ok(content='{"features": ["runs_at_10"], "reason": "r", "finished": false}'):
    return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": content}}]})


def client(handler, key=KEY) -> OpenRouterClient:
    return OpenRouterClient(api_key=key, transport=httpx.MockTransport(handler))


def test_it_posts_the_chat_completion_with_the_key_the_model_and_the_caps():
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["url"], seen["method"] = str(req.url), req.method
        seen["auth"] = req.headers["authorization"]
        seen["body"] = json.loads(req.content)
        seen["timeout"] = req.extensions["timeout"]
        return ok()

    text = client(handler).complete(request())
    assert text == '{"features": ["runs_at_10"], "reason": "r", "finished": false}'
    assert seen["url"] == "https://openrouter.ai/api/v1/chat/completions" and seen["method"] == "POST"
    assert seen["auth"] == f"Bearer {KEY}"
    body = seen["body"]
    assert body["model"] == "vendor/model-1"
    assert body["max_tokens"] == 700                       # the reply length cap goes on every call
    assert body["messages"] == [{"role": "system", "content": "You choose features."},
                                {"role": "user", "content": "Which next?"}]
    assert body["response_format"]["type"] == "json_schema" and body["response_format"]["json_schema"]["schema"] == SCHEMA
    assert body["temperature"] <= 0.5
    assert body["reasoning"] == {"effort": "low"}     # thinking must not use up the reply cap
    assert seen["timeout"]["read"] == 12.5                 # the per-call timeout is the one it was given


def test_without_a_schema_no_response_format_is_sent():
    seen = {}

    def handler(req):
        seen["body"] = json.loads(req.content)
        return ok()

    client(handler).complete(request(json_schema=None))
    assert "response_format" not in seen["body"]


def test_a_timeout_raises_llm_timeout():
    def handler(req):
        raise httpx.ReadTimeout("slow", request=req)

    with pytest.raises(LlmTimeout):
        client(handler).complete(request())


@pytest.mark.parametrize("status", [401, 402, 403, 404, 408, 429, 500, 502, 503])
def test_an_error_status_raises_unavailable_without_leaking_the_body(status):
    def handler(req):
        return httpx.Response(status, text=f"upstream said: key {KEY} was rejected")

    with pytest.raises(LlmUnavailable) as err:
        client(handler).complete(request())
    assert KEY not in str(err.value) and str(status) in str(err.value)


def test_an_unsupported_response_format_is_flagged_so_the_caller_can_retry_without_it():
    def handler(req):
        return httpx.Response(400, json={"error": {"message": "response_format json_schema is not supported by this provider"}})

    with pytest.raises(LlmUnavailable) as err:
        client(handler).complete(request())
    assert err.value.unsupported_format is True


def test_other_client_errors_are_not_flagged_as_a_format_problem():
    with pytest.raises(LlmUnavailable) as err:
        client(lambda req: httpx.Response(400, json={"error": {"message": "bad model id"}})).complete(request())
    assert err.value.unsupported_format is False


def test_a_missing_key_makes_no_request_at_all(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    calls = []

    def handler(req):
        calls.append(req)
        return ok()

    with pytest.raises(LlmUnavailable) as err:
        OpenRouterClient(transport=httpx.MockTransport(handler)).complete(request())
    assert calls == [] and "not configured" in str(err.value)


def test_the_key_is_read_from_the_environment_when_not_passed(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", KEY)
    seen = {}

    def handler(req):
        seen["auth"] = req.headers["authorization"]
        return ok()

    OpenRouterClient(transport=httpx.MockTransport(handler)).complete(request())
    assert seen["auth"] == f"Bearer {KEY}"


def test_the_key_never_appears_in_a_raised_message_or_a_log_record(caplog):
    def handler(req):
        raise httpx.ConnectError(f"cannot connect with {KEY}", request=req)

    with caplog.at_level(logging.DEBUG):
        with pytest.raises(LlmUnavailable) as err:
            client(handler).complete(request())
    assert KEY not in str(err.value) and "[redacted]" in str(err.value)
    assert all(KEY not in r.getMessage() and KEY not in str(r.args) for r in caplog.records)


@pytest.mark.parametrize("payload", [
    {}, {"choices": []}, {"choices": [{}]}, {"choices": [{"message": {}}]}, {"choices": [{"message": {"content": None}}]},
    {"error": {"message": "overloaded"}}, [],
])
def test_a_response_without_reply_text_is_unavailable(payload):
    with pytest.raises(LlmUnavailable):
        client(lambda req: httpx.Response(200, json=payload)).complete(request())


def test_a_response_that_is_not_json_is_unavailable():
    with pytest.raises(LlmUnavailable):
        client(lambda req: httpx.Response(200, text="<html>gateway</html>")).complete(request())


def test_content_given_as_a_list_of_parts_is_joined():
    payload = {"choices": [{"message": {"content": [{"type": "text", "text": "abc"}, {"type": "text", "text": "def"}]}}]}
    assert client(lambda req: httpx.Response(200, json=payload)).complete(request()) == "abcdef"
