"""The language-model budget for one run: calls, reply length and time. App-specific.

The deadline is recorded once, when the request starts. Each model call is given a timeout that fits the time left,
keeping a reserve so that forward selection, the final test and the explanation always have time to finish. The
budget lives in the run's config, never in the graph state.
"""
from __future__ import annotations

import os
import time
from typing import Callable, Mapping

from .state import ROUND_CAP

MIN_CALL_SECONDS = 2.0   # a call given less time than this is not worth starting
WRITING_RESERVE = 1.0    # the closing writing step needs no time kept back for later steps
WRITING_CALLS = 1        # one call beyond the proposing cap, kept for the step that writes the closing words


class RunBudget:
    def __init__(self, deadline: float, max_calls: int, call_timeout: float = 25.0, reserve: float = 8.0,
                 max_tokens: int = 800, clock: Callable[[], float] = time.monotonic):
        self.deadline = deadline          # a clock reading (monotonic seconds)
        self.max_calls = max_calls
        self.call_timeout = call_timeout
        self.reserve = reserve
        self.max_tokens = max_tokens
        self.calls = 0
        self._clock = clock

    @classmethod
    def from_env(cls, started: float, environ: Mapping[str, str] | None = None,
                 clock: Callable[[], float] = time.monotonic) -> "RunBudget":
        env = os.environ if environ is None else environ

        def number(name: str, default: float) -> float:
            try:
                return float(env.get(name, default))
            except (TypeError, ValueError):
                return default

        return cls(deadline=started + number("RUN_DEADLINE_SECONDS", 80),
                   max_calls=int(number("LLM_MAX_CALLS", ROUND_CAP + 2)),
                   call_timeout=number("LLM_CALL_TIMEOUT", 25), max_tokens=int(number("LLM_MAX_TOKENS", 800)),
                   clock=clock)

    def time_left(self) -> float:
        return self.deadline - self._clock()

    def next_timeout(self) -> float | None:
        """The timeout the next call would get, or None if the call cap or the time is used up."""
        if self.calls >= self.max_calls:
            return None
        usable = self.time_left() - self.reserve
        timeout = min(self.call_timeout, usable)
        return timeout if timeout >= MIN_CALL_SECONDS else None

    def take_call(self) -> float | None:
        """Reserve a call and return its timeout, or None if there is no budget for one."""
        timeout = self.next_timeout()
        if timeout is not None:
            self.calls += 1
        return timeout

    def take_writing_call(self) -> float | None:
        """The call for the closing writing step: allowed one call beyond the proposing cap (so proposing retries cannot
        starve it, and it still counts in `calls`), and the time the deadline allows; None if there is neither."""
        if self.calls >= self.max_calls + WRITING_CALLS:
            return None
        timeout = min(self.call_timeout, self.time_left() - WRITING_RESERVE)
        if timeout < MIN_CALL_SECONDS:
            return None
        self.calls += 1
        return timeout
