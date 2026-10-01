"""Run state and constants for the linear regression agent."""
from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict

# One named constant: how many runs of average error the model must be below the baseline.
MARGIN_RUNS = 3
FEATURE_ORDER = ["runs_at_10", "wickets_at_10", "powerplay_runs"]
MIN_TEST_INNINGS = 100
# Backstop only: the real bound is len(FEATURE_ORDER) fits.
RECURSION_LIMIT = 40


class Attempt(TypedDict):
    features: list[str]
    mae: float
    r2: float


class RunState(TypedDict, total=False):
    data_path: str                      # input only, never streamed
    summary: str                        # plain-language summary of the latest node
    data_summary: dict[str, Any]
    data_error: str | None
    explore: dict[str, Any]
    split: dict[str, Any]
    baseline_mae: float
    features: list[str]
    coefficients: dict[str, float]
    intercept: float
    feature_iqr: dict[str, float]
    model_mae: float
    r2: float
    attempts: Annotated[list[Attempt], operator.add]
    decision: dict[str, str]
    explanation: dict[str, Any]
