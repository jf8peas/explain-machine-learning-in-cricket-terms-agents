"""Reading settings from the environment forgivingly, and describing them for logs without revealing them.

A line copied from a `.env` file and pasted into a hosting dashboard often keeps its quote marks, so the stored value is
`"https://..."` instead of `https://...`. Every setting is read through `unwrap` so that mistake does not break the app.
"""
from __future__ import annotations

import logging

log = logging.getLogger("linreg.settings")
_QUOTES = "\"'"


def unwrap(value: str | None) -> str | None:
    """The value without surrounding whitespace and one pair of matching quote marks. None stays None."""
    if value is None:
        return None
    cleaned = value.strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in _QUOTES:
        cleaned = cleaned[1:-1].strip()
    return cleaned


def describe(name: str, value: str | None) -> str:
    """Whether a setting is present and sensibly shaped, without revealing it: only its length and stray characters."""
    if not value:
        return f"{name}=missing"
    flags = []
    if value != value.strip():
        flags.append("leading or trailing whitespace")
    if value[:1] in _QUOTES or value[-1:] in _QUOTES:
        flags.append("wrapped in quotes")
    if "\n" in value or "\r" in value:
        flags.append("contains a newline")
    return f"{name}=present(chars={len(value)}{', ' + ', '.join(flags) if flags else ''})"


def read(environ, name: str) -> str | None:
    """The setting `name` with stray quotes and whitespace removed; says so (never the value) when it removed any."""
    raw = environ.get(name)
    cleaned = unwrap(raw)
    if raw and cleaned != raw:
        log.warning("%s had surrounding quotes or whitespace, which were removed; fix the value where it is set so it is "
                    "stored without them", name)
    return cleaned
