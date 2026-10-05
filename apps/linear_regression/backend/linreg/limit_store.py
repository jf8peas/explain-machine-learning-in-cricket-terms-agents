"""The shared store behind the run limits: counters with expiry and a run-in-progress lock. App-specific.

Vercel functions keep no memory between requests, so the limits live in Upstash Redis, reached over its REST API with
httpx (no SDK). An in-process store exists for development and tests only and must be asked for explicitly; with no
store configured the caller treats the limits as unreachable and does not call a language model.
"""
from __future__ import annotations

import time
from typing import Callable, Mapping, Protocol

import httpx


class StoreUnavailable(Exception):
    """The store could not be reached or answered with an error. Messages never contain the token."""


class LimitStore(Protocol):
    def incr(self, key: str, ttl: int) -> tuple[int, int]:
        """Add one to a counter that expires `ttl` seconds after it was first created. Returns (count, seconds left)."""

    def decr(self, key: str) -> None:
        """Undo one count (used when a later check refuses the start)."""

    def take_lock(self, key: str, ttl: int) -> bool:
        """Take a lock that expires by itself after `ttl` seconds. False if it is already held."""

    def release_lock(self, key: str) -> None: ...


class MemoryStore:
    """In-process store for development and tests. Time comes from an injectable clock."""

    def __init__(self, clock: Callable[[], float] = time.time):
        self._clock = clock
        self._counters: dict[str, tuple[int, float]] = {}   # key -> (count, expires at)
        self._locks: dict[str, float] = {}                   # key -> expires at

    def incr(self, key: str, ttl: int) -> tuple[int, int]:
        now = self._clock()
        count, expires = self._counters.get(key, (0, 0.0))
        if expires <= now:
            count, expires = 0, now + ttl
        count += 1
        self._counters[key] = (count, expires)
        return count, int(round(expires - now))

    def decr(self, key: str) -> None:
        if key in self._counters:
            count, expires = self._counters[key]
            self._counters[key] = (max(0, count - 1), expires)

    def peek(self, key: str) -> int:
        """The current count (tests)."""
        count, expires = self._counters.get(key, (0, 0.0))
        return count if expires > self._clock() else 0

    def take_lock(self, key: str, ttl: int) -> bool:
        now = self._clock()
        if self._locks.get(key, 0.0) > now:
            return False
        self._locks[key] = now + ttl
        return True

    def release_lock(self, key: str) -> None:
        self._locks.pop(key, None)


class UpstashStore:
    def __init__(self, url: str, token: str, transport: httpx.BaseTransport | None = None, timeout: float = 3.0):
        self._url = url.rstrip("/")
        self._token = token
        self._transport = transport
        self._timeout = timeout

    def _send(self, path: str, body) -> object:
        try:
            with httpx.Client(transport=self._transport, timeout=self._timeout) as http:
                response = http.post(self._url + path, json=body, headers={"Authorization": f"Bearer {self._token}"})
        except httpx.HTTPError:
            raise StoreUnavailable("The run-limit store could not be reached.") from None
        if response.status_code >= 400:
            raise StoreUnavailable(f"The run-limit store answered with an error ({response.status_code}).")
        try:
            data = response.json()
        except ValueError:
            raise StoreUnavailable("The run-limit store sent an answer that could not be read.") from None
        results = data if isinstance(data, list) else [data]
        if any(not isinstance(r, dict) or "error" in r for r in results):
            raise StoreUnavailable("The run-limit store reported an error.")
        return data

    def incr(self, key: str, ttl: int) -> tuple[int, int]:
        data = self._send("/pipeline", [["INCR", key], ["EXPIRE", key, ttl, "NX"], ["TTL", key]])
        try:
            return int(data[0]["result"]), max(0, int(data[2]["result"]))
        except (KeyError, IndexError, TypeError, ValueError):
            raise StoreUnavailable("The run-limit store sent an unexpected answer.") from None

    def decr(self, key: str) -> None:
        self._send("", ["DECR", key])

    def take_lock(self, key: str, ttl: int) -> bool:
        return self._send("", ["SET", key, "1", "NX", "EX", ttl]).get("result") == "OK"  # type: ignore[union-attr]

    def release_lock(self, key: str) -> None:
        self._send("", ["DEL", key])


def store_from_env(environ: Mapping[str, str]) -> LimitStore | None:
    """Upstash when configured; the in-process store only when RATE_LIMIT_STORE=memory; otherwise None."""
    if environ.get("RATE_LIMIT_STORE") == "memory":
        return MemoryStore()
    url, token = environ.get("UPSTASH_REDIS_REST_URL"), environ.get("UPSTASH_REDIS_REST_TOKEN")
    if url and token:
        return UpstashStore(url, token)
    return None
