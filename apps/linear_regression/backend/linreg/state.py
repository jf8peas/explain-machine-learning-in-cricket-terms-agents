"""Run state and constants for the linear regression agent."""
from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict

# How many runs of average error a winning model must be below the broadcaster's projection to count as beating it.
MARGIN_RUNS = 3
MIN_TEST_INNINGS = 100   # the validation year and the test year each need at least this many innings
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
    validation_mae: float       # computed by code on the validation year
    validation_r2: float
    improved: bool              # lower validation error than the best so far for this proposer
    round: int                  # round number for the language model; step number for forward selection


class RoundNote(TypedDict, total=False):
    round: int
    features: list[str]
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
    split: dict[str, Any]
    explore: dict[str, Any]             # training years only
    baseline_validation_mae: float
    proposal: dict[str, Any] | None     # the latest proposal: features, reason (verbatim), finished
    rounds: Annotated[list[RoundNote], operator.add]
    rejections: Annotated[list[dict], operator.add]
    rounds_used: int                    # proposals received, rejected ones included (cap: ROUND_CAP)
    no_improve: int                     # consecutive fitted rounds without a better validation error
    attempts: Annotated[list[Attempt], operator.add]
    llm_best: Attempt | None
    forward_set: list[str]
    forward_best: Attempt | None
    features: list[str]                 # the model in focus; at the end, the winner's
    coefficients: dict[str, float]
    intercept: float
    feature_iqr: dict[str, float]
    final: dict[str, Any]
    explanation: dict[str, Any]
    decision: dict[str, str]
