"""Run limits and the language-model budget: every refusal is clear, and no refused start ever reaches the model."""
import json

import pytest
from fastapi.testclient import TestClient
from starlette.datastructures import Headers

from api.index import create_app
from linreg.graph import build_graph
from linreg.graph_api import run_events
from linreg.limit_store import LimitStore, MemoryStore, StoreUnavailable
from linreg.llm_fake import FAKE_MODEL_OPTIONS, default_fake
from linreg.model_options import ModelOptions
from linreg.run_budget import RunBudget
from linreg.run_gate import RunGate, visitor_id
from linreg.state import RECURSION_LIMIT

OPTIONS = ModelOptions.from_env({"MODEL_OPTIONS": json.dumps(FAKE_MODEL_OPTIONS)})


def app_with(environ=None, store=None, llm=None):
    llm = llm or default_fake()
    env = {"RATE_LIMIT_STORE": "memory", "VISITOR_ID_SECRET": "test-secret", **(environ or {})}
    tc = TestClient(create_app(llm, OPTIONS, env, store))
    return tc, llm


def visitor(n: int) -> dict:
    return {"X-Forwarded-For": f"203.0.113.{n}"}


def fake_request(headers: dict):
    """Just enough of a request for visitor_id: real headers are case-insensitive."""
    return type("R", (), {"headers": Headers(headers=headers), "client": None})()


def first_step(r) -> dict:
    return json.loads(r.text.split("\n\n")[0].split("\n")[1].removeprefix("data: "))


def final_state(r) -> dict:
    state: dict = {}
    for block in r.text.strip().split("\n\n"):
        lines = block.split("\n")
        if lines[0] == "event: step":
            state.update(json.loads(lines[1].removeprefix("data: "))["changes"])
    return state


# --- the hourly limit ---

def test_the_next_start_after_the_hourly_limit_is_refused_with_when_to_try_again_and_no_model_call():
    tc, llm = app_with({"RUN_LIMIT_PER_HOUR": "2"})
    for _ in range(2):
        assert tc.get("/api/run", headers=visitor(1)).status_code == 200
    calls = len(llm.requests)
    r = tc.get("/api/run", headers=visitor(1))
    assert r.status_code == 429
    body = r.json()
    assert body["reason"] == "hourly_limit" and "another" in body["message"] and "minute" in body["message"]
    assert 1 <= body["retry_after_seconds"] <= 3600 and r.headers["retry-after"] == str(body["retry_after_seconds"])
    assert len(llm.requests) == calls                                 # nothing was asked of a model
    assert tc.get("/api/run", headers=visitor(2)).status_code == 200   # another visitor is not affected


def test_a_refused_start_uses_up_no_quota_and_leaves_no_lock():
    store = MemoryStore()
    tc, _ = app_with({"RUN_LIMIT_PER_HOUR": "1"}, store)
    assert tc.get("/api/run", headers=visitor(1)).status_code == 200
    for _ in range(3):
        assert tc.get("/api/run", headers=visitor(1)).status_code == 429
    gate = RunGate(OPTIONS, {"VISITOR_ID_SECRET": "test-secret"}, store)
    request = fake_request(visitor(1))
    vid = visitor_id(request, "test-secret")
    assert store.take_lock(f"run:lock:{vid}", 5) is True              # no lock was left behind
    day = [k for k in store._counters if k.startswith("runs:day:")][0]
    assert store.peek(day) == 1                                       # only the one allowed run was counted
    assert gate.store is store


# --- the daily cap ---

def test_the_daily_cap_refuses_every_visitor_and_says_when():
    tc, llm = app_with({"RUN_LIMIT_PER_DAY": "2"})
    assert tc.get("/api/run", headers=visitor(1)).status_code == 200
    assert tc.get("/api/run", headers=visitor(2)).status_code == 200
    calls = len(llm.requests)
    r = tc.get("/api/run", headers=visitor(3))
    assert r.status_code == 429 and r.json()["reason"] == "daily_limit"
    assert "00:00 UTC" in r.json()["message"] and "hour" in r.json()["message"] or "minute" in r.json()["message"]
    assert len(llm.requests) == calls


def test_a_daily_refusal_does_not_use_up_the_visitors_hourly_quota():
    store = MemoryStore()
    tc, _ = app_with({"RUN_LIMIT_PER_DAY": "1", "RUN_LIMIT_PER_HOUR": "5"}, store)
    assert tc.get("/api/run", headers=visitor(1)).status_code == 200
    assert tc.get("/api/run", headers=visitor(2)).status_code == 429
    hour = [k for k in store._counters if k.startswith("runs:hour:")]
    assert len(hour) == 1 and store.peek(hour[0]) == 1                # only visitor 1's allowed run is counted


# --- one run at a time ---

def test_a_second_start_while_one_is_in_progress_is_refused_without_a_model_call():
    store = MemoryStore()
    tc, llm = app_with(store=store)
    request = fake_request(visitor(5))
    assert store.take_lock(f"run:lock:{visitor_id(request, 'test-secret')}", 90)   # a run is going for this visitor
    calls = len(llm.requests)
    r = tc.get("/api/run", headers=visitor(5))
    assert r.status_code == 429 and r.json()["reason"] == "run_in_progress" and "already in progress" in r.json()["message"]
    assert len(llm.requests) == calls
    assert tc.get("/api/run", headers=visitor(6)).status_code == 200  # a different visitor can run


def test_the_lock_is_released_when_the_run_ends():
    store = MemoryStore()
    tc, _ = app_with(store=store)
    assert tc.get("/api/run", headers=visitor(7)).status_code == 200
    assert tc.get("/api/run", headers=visitor(7)).status_code == 200  # not blocked by the run that just finished


def test_the_lock_is_released_when_the_client_goes_away_mid_run():
    released = []
    stream = run_events(build_graph(default_fake()), {}, RECURSION_LIMIT,
                        {"model_id": "fake/steady", "model_name": "Fast", "llm_allowed": True,
                         "budget": RunBudget(deadline=1e18, max_calls=50, reserve=0)}, release=lambda: released.append(1))
    next(stream)
    stream.close()                                                    # the browser disconnected
    assert released == [1]


# --- the store being unreachable ---

class Broken(MemoryStore):
    def take_lock(self, key, ttl):
        raise StoreUnavailable("down")


def test_if_the_store_cannot_be_reached_the_model_is_not_called_and_forward_selection_still_runs():
    tc, llm = app_with(store=Broken())
    r = tc.get("/api/run", headers=visitor(1))
    assert r.status_code == 200 and not llm.requests
    state = final_state(r)
    assert state["llm_status"] == "not_used" and "could not be checked" in state["llm_failure"]
    assert state["final"]["llm_took_part"] is False and state["final"]["winner"] == "forward"


def test_with_no_store_configured_the_model_is_not_called_either():
    llm = default_fake()
    tc = TestClient(create_app(llm, OPTIONS, {}))                      # no RATE_LIMIT_STORE, no Upstash settings
    r = tc.get("/api/run")
    assert r.status_code == 200 and not llm.requests
    assert final_state(r)["llm_status"] == "not_used"


# --- visitors ---

def test_the_visitor_is_identified_by_a_hash_and_the_address_is_never_stored():
    store = MemoryStore()
    tc, _ = app_with(store=store)
    tc.get("/api/run", headers={"X-Forwarded-For": "198.51.100.77, 10.0.0.1"})
    keys = " ".join(list(store._counters) + list(store._locks))
    assert "198.51.100.77" not in keys and "10.0.0.1" not in keys
    assert any(k.startswith("runs:hour:") for k in store._counters)


def test_the_first_forwarded_address_is_the_visitor():
    a = fake_request({"X-Forwarded-For": "198.51.100.7, 1.1.1.1"})
    b = fake_request({"X-Forwarded-For": "198.51.100.7, 9.9.9.9"})
    c = fake_request({"X-Forwarded-For": "198.51.100.8"})
    assert visitor_id(a, "s") == visitor_id(b, "s") != visitor_id(c, "s")
    assert visitor_id(a, "s") != visitor_id(a, "another-secret")


# --- the language-model budget ---

class Clock:
    def __init__(self, now=0.0):
        self.now = now

    def __call__(self):
        return self.now


def test_each_call_gets_a_timeout_that_fits_the_time_left_and_keeps_a_reserve():
    clock = Clock()
    b = RunBudget(deadline=30.0, max_calls=10, call_timeout=25.0, reserve=8.0, clock=clock)
    assert b.take_call() == 22.0                      # 30 - 8 left, capped at the per-call timeout of 25
    clock.now = 20.0
    assert b.take_call() == 2.0                       # only 2 s usable after the reserve
    clock.now = 21.0
    assert b.next_timeout() is None and b.take_call() is None   # not worth starting a call


def test_the_call_cap_is_enforced():
    b = RunBudget(deadline=1e9, max_calls=2, clock=Clock())
    assert b.take_call() is not None and b.take_call() is not None
    assert b.take_call() is None and b.calls == 2


def test_the_budget_is_read_from_the_environment_with_the_documented_defaults():
    b = RunBudget.from_env(100.0, {}, clock=Clock(100.0))
    assert (b.max_calls, b.call_timeout, b.max_tokens, b.deadline) == (8, 25.0, 800, 180.0)
    b = RunBudget.from_env(0.0, {"LLM_MAX_CALLS": "3", "LLM_CALL_TIMEOUT": "10", "LLM_MAX_TOKENS": "321",
                                 "RUN_DEADLINE_SECONDS": "50"}, clock=Clock())
    assert (b.max_calls, b.call_timeout, b.max_tokens, b.deadline) == (3, 10.0, 321, 50.0)
    assert RunBudget.from_env(0.0, {"LLM_MAX_CALLS": "lots"}, clock=Clock()).max_calls == 8


def test_every_request_carries_the_reply_length_cap_and_a_timeout():
    tc, llm = app_with({"LLM_MAX_TOKENS": "321"})
    tc.get("/api/run", headers=visitor(1))
    assert llm.requests and all(r.max_tokens == 321 for r in llm.requests)
    assert all(0 < r.timeout <= 25 for r in llm.requests)


def test_no_more_model_calls_than_the_cap_and_the_run_still_completes():
    tc, llm = app_with({"LLM_MAX_CALLS": "2"})
    r = tc.get("/api/run", headers=visitor(1))
    assert len(llm.requests) == 2
    state = final_state(r)
    assert "budget" in state["llm_failure"] and state["llm_status"] == "failed"   # the model ran out of calls
    assert state["final"]["winner"] in ("llm", "forward") and state["explanation"]["sentences"]
    assert r.text.strip().endswith("}") and "event: done" in r.text


def test_a_run_that_runs_out_of_time_still_reaches_the_end():
    tc, llm = app_with({"RUN_DEADLINE_SECONDS": "5"})                  # less than the reserve: no model call fits
    r = tc.get("/api/run", headers=visitor(1))
    assert not llm.requests and "event: done" in r.text
    assert final_state(r)["llm_status"] == "failed"
