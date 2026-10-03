"""Notes shown on the Data tab, beside the column guide. App-specific.

Each note is {title, paragraphs, example?}; the generic <data-grid> shows it as a collapsible section and
knows nothing about what it says. The worked example is built from real rows of the loaded data.
"""
from __future__ import annotations

from typing import Any

import pandas as pd

from .competition_dummies import DUMMIES, REFERENCE


def _example(df: pd.DataFrame, names: dict[str, str]) -> dict[str, Any]:
    """The first row of each competition (reference first), showing its name and its dummy values."""
    rows = []
    for competition in [REFERENCE, *DUMMIES.values()]:
        found = df[df["competition"] == competition]
        if found.empty:
            continue
        first = found.iloc[0]
        rows.append([names[competition], *(str(first[col]) for col in DUMMIES)])
    return {
        "caption": "Three real innings from this table, one per competition",
        "columns": ["Competition", *(f"{names[comp]} (0/1)" for comp in DUMMIES.values())],
        "rows": rows,
    }


def build_notes(df: pd.DataFrame, names: dict[str, str]) -> list[dict[str, Any]]:
    """`names` maps competition codes to display names; `df` is the loaded, checked innings table."""
    reference, first, second = names[REFERENCE], *(names[comp] for comp in DUMMIES.values())
    return [{
        "title": "What are dummy variables?",
        "paragraphs": [
            f"A dummy variable is a yes/no question about an innings, written as a number: 1 means yes and "
            f"0 means no. \"Was this an {first} innings?\" is 1 for an {first} innings and 0 for any other.",
            f"Why bother? A linear regression is arithmetic: it multiplies and adds numbers. It can work with "
            f"\"89 runs at 10 overs\", but not with the word \"{first}\". Turning the word into 1s and 0s lets "
            "the model do sums with it.",
            f"Why two columns for three competitions? Every innings here is a {reference}, an {first} or a "
            f"{second}. If it is not {first} and not {second}, it must be a {reference}, so a third \"Is this a "
            f"{reference}?\" column would only repeat what the first two already say. That repetition stops a "
            "linear regression from working properly: it cannot tell which of the repeating columns deserves the "
            "credit, so the sums break down. Two columns carry all the information.",
            f"{reference} is the reference. It has no column: an innings is a {reference} when both columns are 0. "
            "When a model uses these columns, each one will read as \"how many more or fewer runs than a "
            f"{reference} innings from the same position\": {first} (0/1) is the {first}'s difference and "
            f"{second} (0/1) is the {second}'s.",
            "The agent's model does not use these columns yet. They are prepared and shown here only.",
        ],
        "example": _example(df, names),
    }]
