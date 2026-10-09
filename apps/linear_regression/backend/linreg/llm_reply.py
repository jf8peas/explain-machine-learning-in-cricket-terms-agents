"""Defensive parsing of the language model's reply. App-specific.

The model is asked for {"features": [...], "window": "...", "weighting": "...", "training_innings": "...", "reason":
"...", "finished": false}. Models do not always obey, so the
parser tries plain JSON, then the contents of a markdown code fence, then the text from the first "{" to the last
"}", and validates the result with pydantic. Anything that still fails is an "unusable reply".
"""
from __future__ import annotations

import json
import re
from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError, field_validator


class UnusableReply(ValueError):
    """The reply could not be turned into a proposal."""


class Proposal(BaseModel):
    model_config = ConfigDict(extra="ignore", strict=False)

    # The four parts of a setup are optional here on purpose: a missing part must reach the proposal check, which rejects it
    # with its own reason, instead of making the whole reply unusable. The three menu choices are kept as they came so an
    # off-menu or wrongly typed value is rejected by name too.
    features: list[str] | None = None
    window: Any = None
    weighting: Any = None
    training_innings: Any = None
    reason: str
    finished: bool = False

    @field_validator("reason")
    @classmethod
    def _reason_is_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("the reason is blank")
        return value  # kept exactly as given


_FENCE = re.compile(r"```[a-zA-Z]*\s*(.*?)```", re.DOTALL)


def _candidates(text: str):
    yield text.strip()
    for block in _FENCE.findall(text):
        yield block.strip()
    first, last = text.find("{"), text.rfind("}")
    if 0 <= first < last:
        yield text[first:last + 1]
        # an earlier brace pair that is not the answer: try each "{" up to the last "}"
        for m in re.finditer(r"\{", text):
            if m.start() > first:
                yield text[m.start():last + 1]


def parse_reply(text: str) -> Proposal:
    """Return the proposal in the reply, or raise UnusableReply."""
    for candidate in _candidates(text or ""):
        try:
            data = json.loads(candidate)
        except ValueError:
            continue
        if not isinstance(data, dict):
            continue
        try:
            return Proposal.model_validate(data)
        except ValidationError:
            continue
    raise UnusableReply("The reply did not contain a usable proposal (features, reason and finished as JSON).")
