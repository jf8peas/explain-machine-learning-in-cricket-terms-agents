"""A scripted stand-in for the language model, for tests and the end-to-end server. App-specific.

It makes no network call and reads no key. Tests build a FakeLlm with a script per model id; the app uses
`default_fake()` when LLM_PROVIDER=fake, which knows a few behaviours selected by model id (a sensible sequence, a
quick one, a slow one, one that always fails, one whose reason contains markup). Production never sets
LLM_PROVIDER, so this is never used there.

Every request the fake receives is recorded in `requests`, so tests can search prompts and count calls.
"""
from __future__ import annotations

import json
import re
import time
from typing import Callable

from .llm_client import LlmRequest, LlmTimeout, LlmUnavailable

Script = list | Callable[[LlmRequest], str]


def reply(features: list[str], reason: str = "A sensible next thing to try.", finished: bool = False) -> str:
    """A well-formed reply in the shape the agent asks for."""
    return json.dumps({"features": features, "reason": reason, "finished": finished})


def round_of(request: LlmRequest) -> int:
    """Which round the agent is on, read from the history in the prompt (attempts plus rejections, plus one)."""
    return 1 + len(re.findall(r"^- Round \d+:", request.user, flags=re.MULTILINE))


def by_round(replies: list, delay: float = 0.0) -> Callable[[LlmRequest], str]:
    """A script that answers by round: replies[0] for round 1 and so on (the last repeats). An exception instance
    in the list is raised instead of returned."""
    def script(request: LlmRequest) -> str:
        if delay:
            time.sleep(delay)
        item = replies[min(round_of(request), len(replies)) - 1]
        if isinstance(item, Exception):
            raise item
        return item
    return script


class FakeLlm:
    """script: model id -> a list of replies (used in call order for that model) or a callable(request) -> reply."""

    def __init__(self, script: dict[str, Script] | None = None):
        self.script = script or {}
        self.requests: list[LlmRequest] = []
        self._calls: dict[str, int] = {}

    def complete(self, request: LlmRequest) -> str:
        self.requests.append(request)
        entry = self.script.get(request.model)
        if entry is None:
            raise AssertionError(f"FakeLlm has no script for model {request.model!r}")
        if callable(entry):
            return entry(request)
        n = self._calls.get(request.model, 0)
        self._calls[request.model] = n + 1
        if n >= len(entry):
            raise AssertionError(f"FakeLlm script for {request.model!r} ran out after {n} calls")
        item = entry[n]
        if isinstance(item, Exception):
            raise item
        return item


# --- the behaviours the end-to-end server knows by model id ---------------------------------------------------

STEADY = [
    reply(["runs_at_10"], "Runs at the halfway mark is the obvious place to start for a final total."),
    reply(["runs_at_10", "wickets_in_hand"], "A side with wickets in hand can swing harder in the last ten overs."),
    reply(["runs_at_10", "wickets_in_hand", "sixes_at_10"], "Sixes already hit suggest the batters are set to go big."),
    reply(["runs_at_10", "wickets_in_hand", "sixes_at_10"], "Let me try that once more."),  # a repeat: rejected by code
    reply(["runs_at_10", "wickets_in_hand"], "I think that is as good as it gets.", finished=True),
]
QUICK = [
    reply(["runs_at_10", "wickets_in_hand"], "Runs and wickets in hand say most of it."),
    reply(["runs_at_10", "wickets_in_hand"], "That is enough for me.", finished=True),
]
MARKUP = [
    reply(["runs_at_10"], '<b>bold</b> <script>window.__pwned = true</script> & "quotes" <img src=x onerror=alert(1)>'),
    reply(["runs_at_10"], "Done.", finished=True),
]


# The model list the app uses when LLM_PROVIDER=fake and MODEL_OPTIONS is not set (the ids default_fake() knows).
FAKE_MODEL_OPTIONS = [
    {"id": "fake/steady", "name": "Fast", "note": "A steady scripted model.", "default": True},
    {"id": "fake/quick", "name": "Quick", "note": "Finishes in two rounds."},
    {"id": "fake/slow", "name": "Thorough", "note": "The same steady sequence, but slow."},
    {"id": "fake/markup", "name": "Markup", "note": "Its reason contains HTML, which must show as text."},
    {"id": "fake/broken", "name": "Unreliable", "note": "Always fails, so forward selection runs alone."},
    {"id": "fake/timeout", "name": "Sluggish", "note": "Always times out."},
]


def default_fake() -> FakeLlm:
    """The fake the end-to-end server uses; the model ids match the MODEL_OPTIONS in web/playwright.config.ts."""
    return FakeLlm({
        "fake/steady": by_round(STEADY),
        "fake/quick": by_round(QUICK),
        "fake/slow": by_round(STEADY, delay=0.5),
        "fake/markup": by_round(MARKUP),
        "fake/broken": by_round([LlmUnavailable("The language model's provider answered with an error (503).")]),
        "fake/timeout": by_round([LlmTimeout("The language model did not reply in time.")]),
    })
