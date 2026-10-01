"""The eight node functions. Each returns state changes plus a plain-language `summary`."""
from __future__ import annotations

from typing import Any

import numpy as np

from . import cricket_explanation, features as feature_registry, regression
from .data_loading import DataError, load_innings
from .evaluation import broadcaster_projection, mae, r2
from .season_split import split_by_year
from .state import FEATURE_ORDER, MARGIN_RUNS, MIN_TEST_INNINGS, RunState


def _r(x: float, n: int = 2) -> float:
    return round(float(x), n)


def _load(state: RunState):
    return load_innings(state.get("data_path"))


def load_data(state: RunState) -> dict[str, Any]:
    try:
        df = _load(state)
        train, test, test_year = split_by_year(df)
        if len(train) == 0:
            raise DataError("The data covers only one calendar year, so there is nothing to train on.")
        if len(test) < MIN_TEST_INNINGS:
            raise DataError(
                f"Only {len(test)} innings are available from {test_year}, fewer than the "
                f"{MIN_TEST_INNINGS} needed to test the model fairly."
            )
    except DataError as exc:
        return {
            "data_error": str(exc),
            "decision": {"branch": "stop", "reason": str(exc)},
            "summary": f"Could not load the data: {exc} The run stops here.",
        }
    years = df["match_date"].dt.year
    comps = sorted(df["competition"].unique().tolist())
    summary = {
        "innings": int(len(df)),
        "seasons": int(df["season"].nunique()),
        "competitions": comps,
        "years": [int(years.min()), int(years.max())],
        "by_competition": {c: int((df["competition"] == c).sum()) for c in comps},
    }
    return {
        "data_summary": summary,
        "data_error": None,
        "decision": {"branch": "ok", "reason": "The data loaded and the test year has enough innings."},
        "summary": (f"Loaded {summary['innings']} first innings from {summary['seasons']} seasons "
                    f"across {len(comps)} competitions ({', '.join(comps)})."),
    }


def explore(state: RunState) -> dict[str, Any]:
    df = _load(state)
    corr = float(np.corrcoef(df["runs_at_10"], df["final_total"])[0, 1])
    buckets = [("0-1 down", df["wickets_at_10"] <= 1),
               ("2-3 down", df["wickets_at_10"].between(2, 3)),
               ("4 or more down", df["wickets_at_10"] >= 4)]
    by_wickets = {}
    for name, mask in buckets:
        sub = df[mask]
        if len(sub):
            by_wickets[name] = {
                "innings": int(len(sub)),
                "avg_runs_at_10": _r(sub["runs_at_10"].mean(), 1),
                "avg_added_after_10": _r((sub["final_total"] - sub["runs_at_10"]).mean(), 1),
            }
    by_comp = {c: _r(g["final_total"].mean(), 1) for c, g in df.groupby("competition")}
    return {
        "explore": {"corr_runs_final": _r(corr, 3), "by_wickets": by_wickets,
                    "mean_total_by_competition": by_comp},
        "summary": (f"Runs at the halfway mark and the final total move closely together "
                    f"(correlation {_r(corr, 2)}). Sides with more wickets down add fewer runs in "
                    f"the second half."),
    }


def split(state: RunState) -> dict[str, Any]:
    train, test, test_year = split_by_year(_load(state))
    years = train["match_date"].dt.year
    info = {"train_n": int(len(train)), "test_n": int(len(test)), "test_year": test_year,
            "train_years": [int(years.min()), int(years.max())]}
    return {"split": info,
            "summary": (f"Trained on {info['train_n']} innings from {info['train_years'][0]} to "
                        f"{info['train_years'][1]}; testing on {info['test_n']} innings from "
                        f"{test_year}. Split by year, never at random.")}


def baseline(state: RunState) -> dict[str, Any]:
    _, test, _ = split_by_year(_load(state))
    err = mae(test["final_total"], broadcaster_projection(test["runs_at_10"]))
    return {"baseline_mae": _r(err),
            "summary": (f"The TV projected score (current run rate x 20 overs) misses the real "
                        f"total by {_r(err, 1)} runs on average across the test innings.")}


def fit_model(state: RunState) -> dict[str, Any]:
    feats = list(state.get("features") or FEATURE_ORDER[:1])
    train, _, _ = split_by_year(_load(state))
    fitted = regression.fit(train, feats)
    fitted["coefficients"] = {f: _r(c, 3) for f, c in fitted["coefficients"].items()}
    fitted["intercept"] = _r(fitted["intercept"], 3)
    fitted["feature_iqr"] = {f: _r(v, 2) for f, v in fitted["feature_iqr"].items()}
    names = ", ".join(feature_registry.label(f) for f in feats)
    return {**fitted, "features": feats,
            "summary": f"Fitted a straight-line model using: {names}."}


def evaluate(state: RunState) -> dict[str, Any]:
    _, test, _ = split_by_year(_load(state))
    feats = state["features"]
    pred = regression.predict(test, state["coefficients"], state["intercept"])
    model_mae = _r(mae(test["final_total"], pred))
    model_r2 = _r(r2(test["final_total"], pred))
    base = state["baseline_mae"]
    improvement = base - model_mae
    more = len(feats) < len(FEATURE_ORDER)
    if improvement >= MARGIN_RUNS:
        branch = "explain"
        reason = (f"The model is {_r(improvement, 1)} runs better than the TV projection, which "
                  f"clears the {MARGIN_RUNS}-run margin.")
    elif more:
        branch = "tune"
        reason = (f"The model is {_r(improvement, 1)} runs better than the TV projection, short of "
                  f"the {MARGIN_RUNS}-run margin, and there are more features to try."
                  if improvement > 0 else
                  f"The model is {_r(-improvement, 1)} runs worse than the TV projection and there "
                  f"are more features to try.")
    else:
        branch = "explain"
        gap = (f"{_r(improvement, 1)} runs better than" if improvement > 0
               else f"{_r(-improvement, 1)} runs worse than" if improvement < 0 else "level with")
        reason = f"The model is {gap} the TV projection and there are no more features to try."
    return {
        "model_mae": model_mae, "r2": model_r2,
        "attempts": [{"features": list(feats), "mae": model_mae, "r2": model_r2}],
        "decision": {"branch": branch, "reason": reason},
        "summary": (f"On the test year the model misses by {_r(model_mae, 1)} runs on average "
                    f"(R-squared {model_r2}); the TV projection misses by {_r(base, 1)}. {reason}"),
    }


def tune(state: RunState) -> dict[str, Any]:
    feats = list(state["features"])
    nxt = FEATURE_ORDER[len(feats)]
    feats.append(nxt)
    return {"features": feats,
            "summary": f"Adding {feature_registry.label(nxt)} to the model and fitting again."}


def explain_in_cricket_terms(state: RunState) -> dict[str, Any]:
    expl = cricket_explanation.build_explanation(dict(state), feature_registry.labels(), MARGIN_RUNS)
    return {"explanation": expl,
            "summary": "Turned the model's numbers into plain cricket sentences."}
