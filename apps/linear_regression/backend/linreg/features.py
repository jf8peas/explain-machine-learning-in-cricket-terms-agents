"""Feature registry: ids and the cricket words used to describe them."""
from __future__ import annotations

FEATURES = {
    "runs_at_10": {
        "label": "runs scored at the halfway mark",
        "unit": "runs",
    },
    "wickets_at_10": {
        "label": "wickets lost at the halfway mark",
        "unit": "wickets",
    },
    "powerplay_runs": {
        "label": "runs scored in the powerplay",
        "unit": "runs",
    },
}


def label(feature: str) -> str:
    return FEATURES[feature]["label"]


def unit(feature: str) -> str:
    return FEATURES[feature]["unit"]


def labels() -> dict[str, dict[str, str]]:
    return FEATURES
