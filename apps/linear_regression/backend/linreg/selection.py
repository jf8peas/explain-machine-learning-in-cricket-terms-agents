"""Pure rules for feature selection: the proposal check, the stopping rules and (later) forward selection.

No model, no network: everything here is ordinary code that can be tested exactly. App-specific.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from . import features, regression
from .evaluation import mae, r2
from .redundancy import repeating_features
from .state import NO_IMPROVE_STOP, ROUND_CAP, SET_LIMIT


@dataclass(frozen=True)
class Check:
    """The outcome of checking one proposal: fit it, or reject it with a reason in plain language."""
    outcome: str                   # "fit" or "rejected"
    reason: str | None             # unknown_feature, empty, too_many, already_tried, redundant
    message: str
    features: list[str]            # the features the outcome is about (the set to fit, or the offending ones)


def _words(ids: list[str]) -> str:
    names = [features.label(i) if i in features.BY_ID else f"'{i}'" for i in ids]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def check_proposal(proposed: list[str], tried: list[list[str]], train: pd.DataFrame) -> Check:
    """Apply every rule to a proposal. The first rule that fails decides; nothing is changed or guessed.

    Order: unknown name (exact match to the catalogue), empty, more than the limit, already tried (as a set),
    then redundant (a feature that can be built exactly from the others, found from the training data).
    """
    unknown = [name for name in proposed if name not in features.BY_ID]
    if unknown:
        names = ", ".join(f"'{n}'" for n in unknown)
        return Check("rejected", "unknown_feature",
                     f"{names} {'is' if len(unknown) == 1 else 'are'} not in the catalogue. Features must be "
                     "named exactly as they appear in the catalogue.", unknown)
    if not proposed:
        return Check("rejected", "empty", "The proposal named no features.", [])
    if len(proposed) > SET_LIMIT:
        return Check("rejected", "too_many",
                     f"The proposal named {len(proposed)} features; the limit is {SET_LIMIT}.", list(proposed))
    if any(set(proposed) == set(t) for t in tried):
        return Check("rejected", "already_tried", "That set of features was already tried.", list(proposed))
    twice = [f for f in dict.fromkeys(proposed) if proposed.count(f) > 1]
    if twice:
        return Check("rejected", "redundant", f"{_words(twice)} was named more than once.", twice)
    repeating = repeating_features(train, list(proposed))
    if repeating:
        return Check("rejected", "redundant",
                     f"{_words(repeating)} repeat each other: one can be worked out exactly from the others, so a "
                     "straight-line fit would have no single answer.", repeating)
    return Check("fit", None, "The proposal passed every check.", list(proposed))


def stop_reason(*, finished: bool, rounds_used: int, rounds_without_improvement: int) -> str | None:
    """Why the proposal loop should end now, or None to keep going.

    `rounds_used` counts every round including rejected proposals; `rounds_without_improvement` counts consecutive
    fitted rounds whose validation error did not beat the best so far.
    """
    if finished:
        return "finished"
    if rounds_without_improvement >= NO_IMPROVE_STOP:
        return "no_improvement"
    if rounds_used >= ROUND_CAP:
        return "round_cap"
    return None


# --- fitting and scoring ---------------------------------------------------------------------------------------

def fit_and_score(train: pd.DataFrame, scored: pd.DataFrame, feats: list[str]) -> tuple[dict, float, float]:
    """Fit the set on `train` and score it on `scored`: returns (fitted model, average miss in runs, R-squared).

    Every number the agent shows comes from here (or the same functions); the language model never supplies one.
    """
    fitted = regression.fit(train, feats)
    pred = regression.predict(scored, fitted["coefficients"], fitted["intercept"])
    return fitted, mae(scored["final_total"], pred), r2(scored["final_total"], pred)


def forward_step(train: pd.DataFrame, validation: pd.DataFrame, current: list[str],
                 candidates: list[str] | None = None) -> dict | None:
    """The single feature whose addition gives the lowest validation error, or None if nothing can be added.

    Candidates are tried in catalogue order and the first of any tie wins, so the result is deterministic. An addition is
    skipped if it would exceed the set limit or make the set redundant (a feature that can be built exactly from the
    others). Uses training and validation data only.
    """
    if len(current) >= SET_LIMIT:
        return None
    best: dict | None = None
    for feature in (features.IDS if candidates is None else candidates):
        if feature in current:
            continue
        trial = current + [feature]
        if repeating_features(train, trial):
            continue
        _, error, score = fit_and_score(train, validation, trial)
        if best is None or error < best["mae"]:
            best = {"feature": feature, "features": trial, "mae": error, "r2": score}
    return best
