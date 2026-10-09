"""Run state and constants for the linear regression agent."""
from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict

# How many runs of average error a winning model must be below the broadcaster's projection to count as beating it.
MARGIN_RUNS = 3
# Feature selection
SET_LIMIT = 8            # most features in one proposed set (the language model's and forward selection's)
ROUND_CAP = 6            # most propose-check-fit rounds, rejections included
NO_IMPROVE_STOP = 2      # stop after this many fitted rounds in a row without a better validation error
# Backstop only: the real bounds are the round cap and the set limit. Per run there are at most about
# 4 steps a round, 9 forward-selection steps and a handful of others.
RECURSION_LIMIT = 80

LLM = "llm"
FORWARD = "forward_selection"


class Attempt(TypedDict):
    features: list[str]
    proposer: str               # "llm" or "forward_selection"
    window: str                 # the other three parts of the setup (menu ids, see setup_settings.py)
    weighting: str
    training_innings: str
    validation_mae: float       # the mean of the three rolling checks' errors, computed by code
    validation_r2: float
    checks: list[dict]          # [{year, mae}] one per rolling check
    improved: bool              # lower validation error than the best so far for this proposer
    round: int                  # round number for the language model; step number for forward selection


class RoundNote(TypedDict, total=False):
    round: int
    features: list[str]
    window: str | None          # the other parts of the proposed setup, as given (None if missing)
    weighting: str | None
    training_innings: str | None
    reason: str                 # the model's reason, verbatim
    finished: bool
    outcome: str                # fit, rejected, finished or failed
    message: str                # why, in plain language, when rejected or failed


class RunState(TypedDict, total=False):
    data_path: str                      # input only, never streamed
    summary: str                        # plain-language summary of the latest node
    data_summary: dict[str, Any]
    data_error: str | None
    model_name: str | None              # the chosen model's friendly name (its id stays in the run config)
    llm_status: str                     # "ok", "failed" or "not_used"
    llm_failure: str | None
    split: dict[str, Any]               # the test year, the three check years and their innings counts
    explore: dict[str, Any]             # training years only
    baseline_validation_mae: float
    reference_validation: dict[str, Any]   # the know-nothing guess and the TV projection on the validation year
    proposal: dict[str, Any] | None     # the latest proposal: features, window, weighting, training_innings, reason, finished
    setup: dict[str, str]               # window, weighting and training_innings of the proposal that passed the check
    rounds: Annotated[list[RoundNote], operator.add]
    rejections: Annotated[list[dict], operator.add]
    rounds_used: int                    # proposals received, rejected ones included (cap: ROUND_CAP)
    no_improve: int                     # consecutive fitted rounds without a better validation error
    attempts: Annotated[list[Attempt], operator.add]
    llm_best: Attempt | None
    forward_set: list[str]
    forward_best: Attempt | None        # the rival's best setup: the winning cell of the grid search
    grid: dict[str, Any]                # the grid search's cells, best cell and build-up (see selection.grid_search)
    features: list[str]                 # the model in focus; at the end, the winner's
    chart_points: dict[str, Any]        # test-year actual and predicted totals for the chart (one decimal, for transport)
    coefficients: dict[str, float]
    intercept: float
    feature_iqr: dict[str, float]
    final: dict[str, Any]
    validation_winner: dict[str, Any]   # which method's best setup won, decided on validation error before the test year
    explanation: dict[str, Any]
    decision: dict[str, str]
