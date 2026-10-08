"""Scoring the methods on one set of innings, in one place. App-specific.

`final_test` hands this module the training and test innings and the models it fitted; it gives back everything the page
needs to compare the four methods: the figures for each, the order, which pairs gave identical predictions, whether every
method that uses the score at 10 overs leans the same way, how the projection compared with knowing nothing, the
verdict, and the points for the chart. Each method is scored exactly once, by one call to `accuracy`.
"""
from __future__ import annotations

from typing import Any, Mapping

import numpy as np

from . import accuracy_text, regression
from .accuracy import TOLERANCES, accuracy, display, same_direction_large_bias
from .evaluation import broadcaster_projection, know_nothing_guess
from .goal import compare, reference_finding, verdict, verdict_sentence
from .methods import METHODS, method_defs

# The methods whose bias the "everyone leans the same way" finding looks at. The know-nothing guess is the training
# average, so its bias is near zero by construction and would stop the finding from ever applying.
USES_THE_SCORE_AT_10 = ("broadcaster", "llm", "forward")


def predictions(train, test, fitted_models: Mapping[str, dict]) -> dict[str, np.ndarray]:
    """The unrounded predictions for the test innings, for each method present, in display order.

    `fitted_models` maps "llm" and/or "forward" to the fitted model (coefficients and intercept)."""
    preds: dict[str, np.ndarray] = {
        "know_nothing": know_nothing_guess(train["final_total"], len(test)),
        "broadcaster": np.asarray(broadcaster_projection(test["runs_at_10"]), dtype=float),
    }
    for key, fitted in fitted_models.items():
        preds[key] = np.asarray(regression.predict(test, fitted["coefficients"], fitted["intercept"]), dtype=float)
    return {m.id: preds[m.id] for m in METHODS if m.id in preds}


def score(actual, preds: Mapping[str, np.ndarray]) -> dict[str, dict[str, Any]]:
    """The displayed figures for each method, one scoring each."""
    return {method: display(accuracy(actual, p)) for method, p in preds.items()}


def identical_pairs(preds: Mapping[str, np.ndarray]) -> list[list[str]]:
    """Pairs of methods whose predictions are the same (to floating-point noise). Both stay in the results."""
    ids = list(preds)
    return [[a, b] for i, a in enumerate(ids) for b in ids[i + 1:]
            if np.allclose(preds[a], preds[b], rtol=0.0, atol=1e-9)]


def bias_finding(acc: Mapping[str, Mapping[str, Any]]) -> dict[str, Any]:
    """Whether every method that uses the score at 10 overs has a large bias leaning the same way."""
    figures = [acc[m] for m in USES_THE_SCORE_AT_10 if m in acc]
    direction = same_direction_large_bias(figures)
    return {"same_direction_large": direction is not None, "direction": direction}


def bias_sentence(finding: Mapping[str, Any]) -> str | None:
    """The plain sentence for the same-direction finding, or None when it does not apply."""
    return accuracy_text.large_bias_sentence(finding["direction"]) if finding["same_direction_large"] else None


def chart_points(actual, preds: Mapping[str, np.ndarray]) -> dict[str, Any]:
    """One value per test innings for the chart, rounded to one decimal for transport only."""
    return {"actual": [round(float(x), 1) for x in np.asarray(actual, dtype=float)],
            "predicted": {m: [round(float(x), 1) for x in p] for m, p in preds.items()}}


def final_scoring(train, test, fitted_models: Mapping[str, dict], winner: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Everything `final_test` adds: (the additions to `final`, the chart points)."""
    actual = test["final_total"]
    preds = predictions(train, test, fitted_models)
    acc = score(actual, preds)
    finding = reference_finding(acc["know_nothing"]["average_miss"], acc["broadcaster"]["average_miss"])
    finding["sentence"] = accuracy_text.finding_sentence(finding["finding"], finding["gap_runs"], finding["gap_percent"])
    bias = bias_finding(acc)
    the_verdict = verdict(acc["broadcaster"]["average_miss"], acc[winner]["average_miss"], winner)
    additions = {
        "accuracy": acc,
        "methods": list(preds),
        "method_defs": method_defs(list(preds)),
        "identical": identical_pairs(preds),
        "bias_finding": bias,
        "bias_sentence": bias_sentence(bias),
        "bias_words": {m: accuracy_text.bias_words(f["bias"]) for m, f in acc.items()},
        "reference_finding": finding,
        "verdict": the_verdict,
        "verdict_sentence": verdict_sentence(the_verdict),
        "versus_know_nothing": compare(acc["know_nothing"]["average_miss"], acc[winner]["average_miss"]),
        "tolerances": list(TOLERANCES),
    }
    return additions, chart_points(actual, preds)
