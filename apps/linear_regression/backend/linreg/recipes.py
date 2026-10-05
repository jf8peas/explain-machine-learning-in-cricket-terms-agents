"""Declarative recipes for derived features, and the small interpreter that evaluates them.

A recipe is plain data, so the same definition is read by the data preparation script, the backend checks and
(through /api/catalogue) the browser. Kinds:

    {"difference": {"from": 10, "of": "wickets_at_10"}}        from - of   (`from` is a number or a column)
    {"product": ["runs_at_10", "wickets_in_hand"]}             product of two columns
    {"indicator": {"column": "competition", "equals": "ipl"}}  1 if the column equals the value, else 0
"""
from __future__ import annotations

from typing import Any

import pandas as pd


class RecipeError(ValueError):
    """A recipe that cannot be evaluated: an unknown kind or a column that is not there."""


def _kind(recipe: dict) -> str:
    if not isinstance(recipe, dict) or len(recipe) != 1:
        raise RecipeError(f"unknown recipe: {recipe!r}")
    kind = next(iter(recipe))
    if kind not in {"difference", "product", "indicator"}:
        raise RecipeError(f"unknown recipe kind {kind!r}")
    return kind


def inputs(recipe: dict) -> list[str]:
    """The columns a recipe reads, in order."""
    kind = _kind(recipe)
    if kind == "difference":
        d = recipe["difference"]
        return [c for c in (d["from"], d["of"]) if isinstance(c, str)]
    if kind == "product":
        return list(recipe["product"])
    return [recipe["indicator"]["column"]]


def _get(data: Any, column: str):
    try:
        return data[column]
    except (KeyError, IndexError):
        raise RecipeError(f"the recipe needs the column {column!r}, which is not there") from None


def evaluate(recipe: dict, data: Any):
    """Evaluate one recipe over a DataFrame (returns a Series) or a single row given as a dict or Series."""
    kind = _kind(recipe)
    if kind == "difference":
        d = recipe["difference"]
        left = _get(data, d["from"]) if isinstance(d["from"], str) else d["from"]
        return left - _get(data, d["of"])
    if kind == "product":
        a, b = recipe["product"]
        return _get(data, a) * _get(data, b)
    spec = recipe["indicator"]
    value = _get(data, spec["column"])
    hit = value == spec["equals"]
    return hit.astype(int) if isinstance(hit, pd.Series) else int(hit)
