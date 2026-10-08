"""The shared store behind the run limits: counters with expiry and a run-in-progress lock. App-specific.

Vercel functions keep no memory between requests, so the limits live in Upstash Redis, reached over its REST API with
httpx (no SDK). An in-process store exists for development and tests only and must be asked for explicitly; with no
store configured the caller treats the limits as unreachable and does not call a language model.
"""
from __future__ import annotations

import logging
import time
from typing import Callable, Mapping, Protocol
from urllib.parse import urlsplit

import httpx

log = logging.getLogger("linreg.limits")


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

    def _clean(self, text: object, limit: int = 300) -> str:
        """Text for a log line: the token removed, newlines folded, and cut short."""
        out = str(text).replace(self._token, "[redacted]") if self._token else str(text)
        return " ".join(out.split())[:limit]

    def _fail(self, op: str, started: float, message: str, **detail: object) -> StoreUnavailable:
        """Log why a store call failed, for the server's owner (never the token), and return the error to raise."""
        extra = " ".join(f"{k}={self._clean(v)}" for k, v in detail.items())
        log.warning("run limit store call failed: op=%s host=%s elapsed=%.2fs reason=%r %s", op, _host(self._url),
                    time.monotonic() - started, message, extra)
        return StoreUnavailable(message)

    def _send(self, path: str, body, op: str = "") -> object:
        op = op or str(body[0] if body and isinstance(body[0], str) else "pipeline")
        started = time.monotonic()
        try:
            with httpx.Client(transport=self._transport, timeout=self._timeout) as http:
                response = http.post(self._url + path, json=body, headers={"Authorization": f"Bearer {self._token}"})
        except httpx.HTTPError as exc:
            raise self._fail(op, started, "The run-limit store could not be reached.",
                             error=type(exc).__name__, detail=exc) from None
        if response.status_code >= 400:
            raise self._fail(op, started, f"The run-limit store answered with an error ({response.status_code}).",
                             status=response.status_code, body=response.text) from None
        try:
            data = response.json()
        except ValueError:
            raise self._fail(op, started, "The run-limit store sent an answer that could not be read.",
                             status=response.status_code, body=response.text) from None
        results = data if isinstance(data, list) else [data]
        if any(not isinstance(r, dict) or "error" in r for r in results):
            problems = [r.get("error") if isinstance(r, dict) else r for r in results if not isinstance(r, dict) or "error" in r]
            raise self._fail(op, started, "The run-limit store reported an error.", status=response.status_code,
                             store_error=problems)
        return data

    def incr(self, key: str, ttl: int) -> tuple[int, int]:
        data = self._send("/pipeline", [["INCR", key], ["EXPIRE", key, ttl, "NX"], ["TTL", key]], op="INCR+EXPIRE+TTL")
        try:
            return int(data[0]["result"]), max(0, int(data[2]["result"]))
        except (KeyError, IndexError, TypeError, ValueError):
            log.warning("run limit store call failed: op=INCR+EXPIRE+TTL host=%s reason='unexpected answer' answer=%r",
                        _host(self._url), self._clean(data))
            raise StoreUnavailable("The run-limit store sent an unexpected answer.") from None

    def decr(self, key: str) -> None:
        self._send("", ["DECR", key])

    def take_lock(self, key: str, ttl: int) -> bool:
        return self._send("", ["SET", key, "1", "NX", "EX", ttl]).get("result") == "OK"  # type: ignore[union-attr]

    def release_lock(self, key: str) -> None:
        self._send("", ["DEL", key])


def _host(url: str) -> str:
    """The host of a store URL, for logs; says so if the URL has no scheme or no host."""
    parts = urlsplit(url)
    return parts.netloc if parts.scheme and parts.netloc else f"(not a usable url: scheme={parts.scheme or 'none'})"


def _describe_setting(name: str, value: str | None) -> str:
    """Whether a setting is present and shaped sensibly, without revealing it: only its length and stray characters."""
    if not value:
        return f"{name}=missing"
    flags = []
    if value != value.strip():
        flags.append("leading or trailing whitespace")
    if value[:1] in "\"'" or value[-1:] in "\"'":
        flags.append("wrapped in quotes")
    if "\n" in value or "\r" in value:
        flags.append("contains a newline")
    return f"{name}=present(chars={len(value)}{', ' + ', '.join(flags) if flags else ''})"


def store_from_env(environ: Mapping[str, str]) -> LimitStore | None:
    """Upstash when configured; the in-process store only when RATE_LIMIT_STORE=memory; otherwise None.

    What was found is logged once, without any secret, so a deployment that cannot check its limits can be diagnosed."""
    if environ.get("RATE_LIMIT_STORE") == "memory":
        log.info("run limit store: in-process (RATE_LIMIT_STORE=memory), for development and tests only")
        return MemoryStore()
    url, token = environ.get("UPSTASH_REDIS_REST_URL"), environ.get("UPSTASH_REDIS_REST_TOKEN")
    summary = f"{_describe_setting('UPSTASH_REDIS_REST_URL', url)} {_describe_setting('UPSTASH_REDIS_REST_TOKEN', token)}"
    if url and token:
        if not url.strip().lower().startswith(("http://", "https://")):
            log.warning("run limit store: UPSTASH_REDIS_REST_URL has no http:// or https:// at the start, so calls will "
                        "fail (%s)", summary)
        else:
            log.info("run limit store: Upstash at %s (%s)", _host(url.strip()), summary)
        return UpstashStore(url, token)
    log.warning("run limit store: not configured, so the language model will not be used (%s)", summary)
    return None
