"""The shared limit store: counters with expiry and a run-in-progress lock. Memory (tests, development) and Upstash REST."""
import json

import httpx
import pytest

from linreg.limit_store import MemoryStore, StoreUnavailable, UpstashStore, store_from_env


class Clock:
    def __init__(self, now=1000.0):
        self.now = now

    def __call__(self):
        return self.now


# --- the in-process store ---

def test_a_counter_counts_and_reports_the_seconds_until_it_expires():
    clock = Clock()
    s = MemoryStore(clock)
    assert s.incr("k", 3600) == (1, 3600)
    clock.now += 600
    assert s.incr("k", 3600) == (2, 3000)


def test_a_counter_starts_again_after_it_expires():
    clock = Clock()
    s = MemoryStore(clock)
    s.incr("k", 60)
    s.incr("k", 60)
    clock.now += 61
    assert s.incr("k", 60) == (1, 60)


def test_decr_undoes_a_count_and_never_goes_below_zero():
    s = MemoryStore(Clock())
    s.incr("k", 60)
    s.decr("k")
    s.decr("k")
    assert s.incr("k", 60)[0] == 1


def test_the_lock_is_taken_once_released_and_expires_by_itself():
    clock = Clock()
    s = MemoryStore(clock)
    assert s.take_lock("run:1", 90) is True
    assert s.take_lock("run:1", 90) is False         # already held
    assert s.take_lock("run:2", 90) is True          # another visitor is independent
    s.release_lock("run:1")
    assert s.take_lock("run:1", 90) is True
    clock.now += 91
    assert s.take_lock("run:1", 90) is True          # a crashed run cannot lock a visitor out forever
    clock.now += 91
    s.release_lock("never-taken")                    # releasing nothing is harmless


# --- Upstash over REST ---

def upstash(handler):
    return UpstashStore("https://example.upstash.io", "TOKEN123", transport=httpx.MockTransport(handler))


def test_incr_sends_one_pipeline_with_incr_expire_nx_and_ttl_and_the_bearer_token():
    seen = {}

    def handler(req):
        seen["url"], seen["auth"], seen["body"] = str(req.url), req.headers["authorization"], json.loads(req.content)
        return httpx.Response(200, json=[{"result": 3}, {"result": 0}, {"result": 2500}])

    assert upstash(handler).incr("runs:hour:abc:1", 3600) == (3, 2500)
    assert seen["url"] == "https://example.upstash.io/pipeline" and seen["auth"] == "Bearer TOKEN123"
    assert seen["body"] == [["INCR", "runs:hour:abc:1"], ["EXPIRE", "runs:hour:abc:1", 3600, "NX"], ["TTL", "runs:hour:abc:1"]]


def test_the_lock_uses_set_nx_ex_and_reports_whether_it_was_taken():
    bodies = []

    def handler(req):
        bodies.append(json.loads(req.content))
        return httpx.Response(200, json={"result": "OK" if len(bodies) == 1 else None})

    s = upstash(handler)
    assert s.take_lock("run:lock:abc", 90) is True and s.take_lock("run:lock:abc", 90) is False
    assert bodies[0] == ["SET", "run:lock:abc", "1", "NX", "EX", 90]


def test_release_and_decr_send_del_and_decr():
    bodies = []

    def handler(req):
        bodies.append(json.loads(req.content))
        return httpx.Response(200, json={"result": 1})

    s = upstash(handler)
    s.release_lock("run:lock:abc")
    s.decr("runs:day:2026-10-05")
    assert bodies == [["DEL", "run:lock:abc"], ["DECR", "runs:day:2026-10-05"]]


@pytest.mark.parametrize("response", [
    httpx.Response(500, text="boom"), httpx.Response(401, json={"error": "bad token"}),
    httpx.Response(200, json={"error": "ERR something"}), httpx.Response(200, text="not json"),
    httpx.Response(200, json=[{"error": "ERR x"}]),
])
def test_a_failing_store_raises_store_unavailable_without_the_token(response):
    with pytest.raises(StoreUnavailable) as err:
        upstash(lambda req: response).incr("k", 60)
    assert "TOKEN123" not in str(err.value)


def test_a_network_error_raises_store_unavailable_without_the_token():
    def handler(req):
        raise httpx.ConnectError("cannot reach TOKEN123", request=req)

    with pytest.raises(StoreUnavailable) as err:
        upstash(handler).take_lock("k", 10)
    assert "TOKEN123" not in str(err.value)


# --- choosing a store from the environment ---

def test_memory_is_chosen_only_when_asked_for():
    assert isinstance(store_from_env({"RATE_LIMIT_STORE": "memory"}), MemoryStore)


def test_upstash_is_chosen_when_its_settings_are_present():
    s = store_from_env({"UPSTASH_REDIS_REST_URL": "https://x.upstash.io", "UPSTASH_REDIS_REST_TOKEN": "t"})
    assert isinstance(s, UpstashStore)


def test_without_any_settings_there_is_no_store_so_the_model_will_not_be_used():
    assert store_from_env({}) is None
    assert store_from_env({"UPSTASH_REDIS_REST_URL": "https://x.upstash.io"}) is None      # the token is missing
