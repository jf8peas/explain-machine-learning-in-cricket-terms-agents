"""The owner's list of allowed language models. App-specific.

The list comes from the MODEL_OPTIONS environment variable (JSON: id, name, note, default) with a checked-in fallback
for local development. Visitors only ever see names, notes and opaque choice tokens; model ids stay on the server, and
a request naming anything that is not a listed token is refused before any model call.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Mapping

# Timed and priced on 2026-10-06 with scripts/time_models.py; see MODEL_OPTIONS.md for the comparison and why each
# model is here.
FALLBACK_OPTIONS: list[dict] = [
    {"id": "openai/gpt-6-luna", "name": "Fast", "note": "Quick and cheap; a good first try."},
    {"id": "minimax/minimax-m3", "name": "Fast, Chinese maker", "note": "A quick, cheap model from MiniMax (China), to compare styles."},
    {"id": "anthropic/claude-haiku-4.5", "name": "Balanced", "default": True, "note": "Quickest here and reliable, with careful reasons."},
    {"id": "anthropic/claude-sonnet-5.5", "name": "More thorough", "note": "Slower and more careful; costs more."},
    {"id": "moonshotai/kimi-k3", "name": "Frontier, Chinese maker", "note": "Moonshot AI's (China) top model; quick, but the priciest here."},
]

_TOKEN = re.compile(r"m([1-9][0-9]*)")


class ModelConfigError(ValueError):
    """MODEL_OPTIONS is present but not a valid list."""


@dataclass(frozen=True)
class ModelOption:
    id: str
    name: str
    note: str
    default: bool = False


def _fail(why: str) -> ModelConfigError:
    return ModelConfigError(f"MODEL_OPTIONS is not valid: {why}. Expected a JSON list of "
                            '{"id", "name", "note", "default"} with exactly one default.')


def _parse(raw: str) -> list[ModelOption]:
    try:
        items = json.loads(raw)
    except ValueError:
        raise _fail("it is not JSON") from None
    if not isinstance(items, list) or not items:
        raise _fail("it is not a non-empty list")
    out: list[ModelOption] = []
    for item in items:
        if not isinstance(item, dict):
            raise _fail("an entry is not an object")
        values = {k: item.get(k) for k in ("id", "name", "note")}
        if not all(isinstance(v, str) and v.strip() for v in values.values()):
            raise _fail("every entry needs a non-empty id, name and note")
        out.append(ModelOption(values["id"], values["name"], values["note"], bool(item.get("default", False))))
    if len({m.id for m in out}) != len(out):
        raise _fail("two entries have the same id")
    if sum(m.default for m in out) != 1:
        raise _fail("exactly one entry must be the default")
    return out


class ModelOptions:
    def __init__(self, options: list[ModelOption]):
        self.options = options

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "ModelOptions":
        raw = (os.environ if environ is None else environ).get("MODEL_OPTIONS", "").strip()
        if not raw:
            return cls(_parse(json.dumps(FALLBACK_OPTIONS)))
        return cls(_parse(raw))

    @property
    def default(self) -> ModelOption:
        return next(m for m in self.options if m.default)

    def resolve(self, choice: str | None) -> ModelOption | None:
        """The option for an opaque choice token, the default for no choice, or None for anything else."""
        if choice is None:
            return self.default
        m = _TOKEN.fullmatch(choice)
        if not m or int(m.group(1)) > len(self.options):
            return None
        return self.options[int(m.group(1)) - 1]

    def public(self) -> dict:
        """What GET /api/models returns: names, notes, the default flag and a token. Never an id."""
        return {"models": [{"name": o.name, "note": o.note, "default": o.default, "choice": f"m{i}"}
                           for i, o in enumerate(self.options, start=1)]}
