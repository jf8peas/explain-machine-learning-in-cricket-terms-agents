"""Settings pasted into a dashboard with their quote marks still work, and nothing secret is logged."""
import json
import logging

import httpx
import pytest

from linreg.llm_client import LlmRequest, OpenRouterClient
from linreg.model_options import ModelOptions
from linreg.run_gate import RunGate
from linreg.settings import describe, read, unwrap


@pytest.mark.parametrize("raw,expected", [
    ("https://x.io", "https://x.io"), ('"https://x.io"', "https://x.io"), ("'https://x.io'", "https://x.io"),
    ('  "https://x.io"  ', "https://x.io"), ('" spaced "', "spaced"), ("a'b", "a'b"), ('"unbalanced', '"unbalanced'),
    ('"mixed\'', '"mixed\''), ("", ""), ('""', ""), ('"', '"'),
])
def test_unwrap_removes_one_matching_pair_of_quotes_and_the_whitespace_around(raw, expected):
    assert unwrap(raw) == expected


def test_unwrap_leaves_none_alone():
    assert unwrap(None) is None


def test_describe_says_how_a_value_looks_without_showing_it():
    text = describe("TOKEN", '"SECRET-VALUE"\n')
    assert "chars=" in text and "wrapped in quotes" in text and "contains a newline" in text and "SECRET" not in text
    assert describe("TOKEN", None) == "TOKEN=missing" and describe("TOKEN", "") == "TOKEN=missing"
    assert describe("TOKEN", "plain") == "TOKEN=present(chars=5)"


def test_read_warns_by_name_only_when_it_had_to_clean_a_value(caplog):
    with caplog.at_level(logging.INFO, logger="linreg.settings"):
        assert read({"A": '"SECRET-A"', "B": "clean"}, "A") == "SECRET-A"
        assert read({"A": '"SECRET-A"', "B": "clean"}, "B") == "clean"
        assert read({}, "MISSING") is None
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert "A had surrounding quotes" in text and "B had" not in text and "SECRET-A" not in text


def test_a_quoted_api_key_is_sent_without_its_quotes(monkeypatch):
    seen = []

    def handler(req):
        seen.append(req.headers["authorization"])
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}]})

    monkeypatch.setenv("OPENROUTER_API_KEY", '"sk-or-QUOTED"')
    client = OpenRouterClient(transport=httpx.MockTransport(handler))
    client.complete(LlmRequest(model="m", system="s", user="u", max_tokens=10, timeout=5))
    assert seen == ["Bearer sk-or-QUOTED"]


def test_a_quoted_model_list_still_parses():
    raw = json.dumps([{"id": "a/b", "name": "A", "note": "n", "default": True}])
    for wrapped in (raw, f"'{raw}'", f'"{raw}"'.replace('"[', '"[', 1)):
        assert [m.id for m in ModelOptions.from_env({"MODEL_OPTIONS": wrapped}).options] == ["a/b"]


def test_a_quoted_visitor_secret_is_used_without_its_quotes():
    quoted = RunGate(ModelOptions.from_env({}), {"VISITOR_ID_SECRET": '"abc"', "RATE_LIMIT_STORE": "memory"})
    plain = RunGate(ModelOptions.from_env({}), {"VISITOR_ID_SECRET": "abc", "RATE_LIMIT_STORE": "memory"})
    assert quoted._secret == plain._secret == "abc"
