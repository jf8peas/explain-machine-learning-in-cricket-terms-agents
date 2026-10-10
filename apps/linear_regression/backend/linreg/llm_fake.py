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
from .prompts import WRITING_MARKER

Script = list | Callable[[LlmRequest], str]


def reply(features: list[str], reason: str = "A sensible next thing to try.", finished: bool = False, *,
          window: str = "all", weighting: str = "none", training_innings: str = "population",
          omit: tuple[str, ...] = ()) -> str:
    """A well-formed reply in the shape the agent asks for: a full setup. `omit` leaves parts out, to script a bad reply."""
    body = {"features": features, "window": window, "weighting": weighting, "training_innings": training_innings,
            "reason": reason, "finished": finished}
    return json.dumps({k: v for k, v in body.items() if k not in omit})


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


# --- the closing writing step (feature 012): scripted wording, named by the facts it uses ---------------------------

def is_writing(request: LlmRequest) -> bool:
    return WRITING_MARKER in request.system


def writing_fact_ids(request: LlmRequest) -> list[str]:
    return re.findall(r"^- \{([A-Za-z0-9_]+)\}:", request.user, flags=re.MULTILINE)


def writing_block_ids(request: LlmRequest) -> list[str]:
    return re.findall(r"^- (\w+): .*Usual title:", request.user, flags=re.MULTILINE)


def writing_reply(blocks: dict | None = None, order: list[str] | None = None, closing_lead: str | None = None) -> str:
    """A reply in the shape the writing step asks for."""
    body: dict = {"blocks": blocks or {}}
    if order is not None:
        body["order"] = order
    if closing_lead is not None:
        body["closing_lead"] = closing_lead
    return json.dumps(body)


def valid_writing(request: LlmRequest, *, markup: bool = False) -> str:
    """Good wording for whatever blocks and facts the request names: placeholders only, no digit, within the limits."""
    facts, blocks = set(writing_fact_ids(request)), writing_block_ids(request)
    sentence = "The winner, {winner_name}, was picked on the check years, and the test year stayed untouched."
    if markup:
        sentence = '<b>bold</b> <script>x</script> & "q": the winner was {winner_name}.'
    wording: dict[str, dict] = {
        "verdict": {"title": "How it did against the TV", "sentences": [
            "The winner missed by {winner_test_miss} runs on average; the TV projected score missed by {tv_test_miss}."]},
        "drivers": {"title": "What moves the total", "sentences": [
            "Most of the movement comes from {biggest_factor}, worth about {biggest_factor_effect} runs for a typical "
            "difference."]},
        "how_chosen": {"title": "Picked before the test", "sentences": [sentence]},
        "closing": {"title": "What it means", "sentences": ["The score at the halfway mark does most of the work, and the "
                                                            "model adds a little more."]},
    }
    if "wicket_cost" in facts:
        wording["wicket"] = {"title": "What a wicket costs", "sentences": [
            "Each wicket lost by the halfway mark moves the final total by about {wicket_cost} runs."]}
    elif "wicket_in_hand_value" in facts:
        wording["wicket"] = {"title": "What a wicket is worth", "sentences": [
            "An extra wicket in hand moves the final total by about {wicket_in_hand_value} runs."]}
    movable = [b for b in ("drivers", "wicket", "how_chosen") if b in blocks]
    return writing_reply({b: w for b, w in wording.items() if b in blocks}, order=list(reversed(movable)),
                         closing_lead="biggest_factor")


class FakeLlm:
    """script: model id -> a list of replies (used in call order for that model) or a callable(request) -> reply.

    The closing writing step is answered separately, so it never consumes a proposing reply and is not counted in
    `requests`: `writers` maps a model id to a reply, a list of replies or a callable(request) -> reply (an exception
    instance is raised), and any other model gets good wording. The writing requests are recorded in `writing_requests`."""

    def __init__(self, script: dict[str, Script] | None = None, writers: dict[str, Script] | None = None):
        self.script = script or {}
        self.writers = writers or {}
        self.requests: list[LlmRequest] = []
        self.writing_requests: list[LlmRequest] = []
        self._calls: dict[str, int] = {}
        self._writes: dict[str, int] = {}

    def _write(self, request: LlmRequest) -> str:
        self.writing_requests.append(request)
        entry = self.writers.get(request.model)
        if entry is None:
            return valid_writing(request)
        if callable(entry):
            return entry(request)
        if isinstance(entry, str):
            return entry
        n = self._writes.get(request.model, 0)
        self._writes[request.model] = n + 1
        item = entry[min(n, len(entry) - 1)]
        if isinstance(item, Exception):
            raise item
        return item

    def complete(self, request: LlmRequest) -> str:
        if is_writing(request):
            return self._write(request)
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
    reply(["runs_at_10", "wickets_in_hand"], "A side with wickets in hand can swing harder in the last ten overs, and the "
          "last ten seasons are closer to today's game.", window="last_10", weighting="gentle"),
    reply(["runs_at_10", "wickets_in_hand", "sixes_at_10"], "Sixes already hit suggest the batters are set to go big, and "
          "scoring has risen lately, so recent seasons should count for more.", window="last_5", weighting="gentle",
          training_innings="all"),
    reply(["runs_at_10", "wickets_in_hand", "sixes_at_10"], "Let me try that once more.",   # a repeat: rejected by code
          window="last_5", weighting="gentle", training_innings="all"),
    reply(["runs_at_10", "wickets_in_hand"], "I think that is as good as it gets.", finished=True),
]
QUICK = [
    reply(["runs_at_10", "wickets_in_hand"], "Runs and wickets in hand say most of it."),
    reply(["runs_at_10", "wickets_in_hand"], "That is enough for me.", finished=True),
]
# One bad reply for each way code rejects a proposal, for tests that need to see every reason (not a model the server lists).
BAD_REPLIES = {
    "missing_part": reply(["runs_at_10"], "No weighting named.", omit=("weighting",)),
    "unknown_window": reply(["runs_at_10"], "A window that is not on the menu.", window="last_7"),
    "unknown_weighting": reply(["runs_at_10"], "A weighting that is not on the menu.", weighting="extreme"),
    "unknown_training_innings": reply(["runs_at_10"], "Innings that are not on the menu.", training_innings="leagues"),
    "unknown_feature": reply(["net_run_rate"], "Not in the catalogue."),
    "empty": reply([], "No features at all."),
    "too_many": reply(["runs_at_10", "wickets_at_10", "fours_at_10", "sixes_at_10", "dot_balls_at_10", "extras_at_10",
                       "partnership_runs", "balls_since_last_wicket", "powerplay_runs"], "Nine is too many."),
    "redundant": reply(["wickets_at_10", "wickets_in_hand"], "These say the same thing."),
}
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
    }, writers={"fake/markup": lambda request: valid_writing(request, markup=True)})
