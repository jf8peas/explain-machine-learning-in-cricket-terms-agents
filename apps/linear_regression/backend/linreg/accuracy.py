"""How far predictions are from actual values, in four ways. Shared-library candidate; no knowledge of any sport.

One function takes the actual and the predicted values and returns the figures a person needs to judge a prediction:
how many were scored, the average miss, the share of predictions within a few units of the truth, the average miss as
a share of a typical actual value, and the bias (does it tend to guess too high or too low).

Predictions are never rounded before the figures are worked out. `display` rounds them once, for storing and showing,
so everything built from the displayed figures (a verdict, a percentage) can be checked by hand from them.
"""
from __future__ import annotations

from typing import Any, Mapping, Sequence

import numpy as np

TOLERANCES = (10, 20)          # "within" this many units, inclusive; the key names in the figures come from these
LARGE_BIAS_SHARE = 0.5         # a bias is large when it is at least this share of the average miss, either way
_EPSILON = 1e-9                # so that a miss of exactly 10 is within 10 even after floating-point arithmetic

KEYS = ("average_miss", "within_10", "within_20", "miss_percent", "bias")


def accuracy(actual, predicted) -> dict[str, Any]:
    """The figures for one method, unrounded. With nothing to score `n` is 0 and every other figure is None.

    average_miss: mean of |predicted - actual|.  within_N: percent of predictions within N (inclusive).
    miss_percent: average_miss / mean(actual) * 100 (None if the mean is zero).  bias: mean of predicted - actual,
    so a positive bias means it guesses too high.
    """
    a = np.asarray(actual, dtype=float)
    p = np.asarray(predicted, dtype=float)
    if a.shape != p.shape:
        raise ValueError("actual and predicted must have the same length")
    if a.size == 0:
        return {"n": 0, **{k: None for k in KEYS}}
    error = p - a
    miss = np.abs(error)
    average_miss = float(miss.mean())
    mean_actual = float(a.mean())
    figures: dict[str, Any] = {"n": int(a.size), "average_miss": average_miss}
    for tolerance in TOLERANCES:
        figures[f"within_{tolerance}"] = float(np.mean(miss <= tolerance + _EPSILON) * 100)
    figures["miss_percent"] = average_miss / mean_actual * 100 if mean_actual else None
    figures["bias"] = float(error.mean())
    return figures


def display(figures: Mapping[str, Any]) -> dict[str, Any]:
    """The figures rounded for storing and showing: one decimal for values and percentages, a whole count of items scored."""
    shown: dict[str, Any] = {"n": int(figures["n"])}
    for key in KEYS:
        value = figures.get(key)
        shown[key] = None if value is None else round(float(value), 1)
    return shown


def is_large_bias(figures: Mapping[str, Any]) -> bool:
    """True when the bias, in either direction, is at least LARGE_BIAS_SHARE of the average miss."""
    miss, bias = figures.get("average_miss"), figures.get("bias")
    if miss is None or bias is None or miss <= 0:
        return False
    return abs(bias) >= LARGE_BIAS_SHARE * miss


def same_direction_large_bias(all_figures: Sequence[Mapping[str, Any]]) -> str | None:
    """"high" or "low" when every method given has a large bias leaning that same way; otherwise None.

    It needs at least two methods. Which methods to pass is the caller's choice.
    """
    if len(all_figures) < 2 or not all(is_large_bias(f) for f in all_figures):
        return None
    signs = {1 if f["bias"] > 0 else -1 for f in all_figures}
    if len(signs) != 1:
        return None
    return "high" if signs == {1} else "low"
