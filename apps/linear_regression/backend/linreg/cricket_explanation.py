"""Turn run state into plain cricket sentences. Shared-library candidate.

Every number in the sentences is read from the run state (or derived from it) and
recorded in `figures`, so nothing is hard-coded. Words, not digits, are used for
fixed ideas such as "halfway".
"""
from __future__ import annotations

from typing import Any


def _runs(x: float) -> float:
    return round(float(x), 1)


def build_explanation(state: dict[str, Any], labels: dict[str, dict[str, str]],
                      margin_runs: float) -> dict[str, Any]:
    features: list[str] = state["features"]
    coefs: dict[str, float] = state["coefficients"]
    iqr: dict[str, float] = state["feature_iqr"]
    attempts: list[dict] = state["attempts"]
    split = state["split"]
    baseline_mae = float(state["baseline_mae"])
    model_mae = float(state["model_mae"])
    r2 = float(state["r2"])

    importance = {f: _runs(abs(coefs[f] * iqr[f])) for f in features}
    most = max(features, key=lambda f: abs(coefs[f] * iqr[f]))
    improvement = baseline_mae - model_mae
    beat = improvement > 0
    cleared = improvement >= margin_runs

    figures: dict[str, float] = {
        "train_n": split["train_n"], "test_n": split["test_n"], "test_year": split["test_year"],
        "model_mae": _runs(model_mae), "baseline_mae": _runs(baseline_mae),
        "improvement": _runs(abs(improvement)), "margin_runs": _runs(margin_runs),
        "r2": round(r2, 2), "fits": len(attempts), "importance_runs": importance[most],
        "importance_iqr": _runs(iqr[most]),
    }
    lab = lambda f: labels[f]["label"]  # noqa: E731
    unit = lambda f: labels[f]["unit"]  # noqa: E731

    sentences: list[str] = []
    sentences.append(
        f"We trained on {split['train_n']} innings from before {split['test_year']} and tested "
        f"on {split['test_n']} innings from {split['test_year']}, which the model had never seen."
    )
    sentences.append(
        f"The biggest factor was {lab(most)}: a typical difference of {_runs(iqr[most])} "
        f"{unit(most)} moves the predicted final total by about {importance[most]} runs."
    )

    if "wickets_at_10" in coefs:
        c = coefs["wickets_at_10"]
        figures["wicket_cost"] = _runs(abs(c))
        if c < 0:
            sentences.append(
                f"Each extra wicket lost at the halfway mark costs about {_runs(abs(c))} runs "
                f"by the end of the innings, given the other things the model knows."
            )
        else:
            sentences.append(
                f"Surprisingly, in this data a wicket lost at the halfway mark did not cost "
                f"runs by the end: the model gave it a change of {_runs(abs(c))} runs in the "
                f"other direction, so treat it with caution."
            )
    else:
        sentences.append(
            "The final model did not use wickets lost, so it cannot say what a wicket costs."
        )

    for prev, cur in zip(attempts, attempts[1:]):
        added = [f for f in cur["features"] if f not in prev["features"]]
        if added:
            figures[f"mae_{len(cur['features'])}"] = _runs(cur["mae"])
            figures[f"mae_{len(prev['features'])}"] = _runs(prev["mae"])
            sentences.append(
                f"Adding {lab(added[0])} moved the average miss from {_runs(prev['mae'])} to "
                f"{_runs(cur['mae'])} runs."
            )

    sentences.append(
        f"On average the final model's prediction was {_runs(model_mae)} runs away from the real "
        f"total, against {_runs(baseline_mae)} runs for the TV projected score."
    )
    if beat:
        verdict = (f"The model beat the TV projection by {_runs(improvement)} runs on average.")
    else:
        verdict = (f"The model did not beat the TV projection: it was {_runs(abs(improvement))} "
                   f"runs worse on average.")
    if beat and not cleared:
        verdict += (f" That is short of the {_runs(margin_runs)}-run margin we asked for, so we "
                    f"tried every feature we had.")
    elif beat and cleared:
        verdict += f" That clears the {_runs(margin_runs)}-run margin we asked for."
    sentences.append(verdict)

    return {
        "sentences": sentences,
        "most_important": most,
        "comparison": {
            "model_mae": _runs(model_mae), "baseline_mae": _runs(baseline_mae),
            "beat_baseline": beat, "cleared_margin": cleared,
            "improvement": _runs(improvement), "r2": round(r2, 2),
        },
        "importance": importance,
        "figures": figures,
    }
