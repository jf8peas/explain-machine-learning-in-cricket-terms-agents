"""Pure rules for choosing a setup: the proposal check, the stopping rules, forward selection inside one setup, the grid search
over every combination of window, weighting and training innings, and the choice of winner on validation error.

No model, no network: everything here is ordinary code that can be tested exactly. App-specific.
"""
from __future__ import annotations

from dataclasses import dataclass

from . import features, setup_settings
from .state import NO_IMPROVE_STOP, ROUND_CAP, SET_LIMIT


@dataclass(frozen=True)
class Check:
    """The outcome of checking one proposal: fit it, or reject it with a reason in plain language."""
    outcome: str                   # "fit" or "rejected"
    reason: str | None             # missing_part, unknown_window, unknown_weighting, unknown_training_innings,
                                   # unknown_feature, empty, too_many, already_tried, too_few_innings, redundant
    message: str
    features: list[str]            # the features the outcome is about (the set to fit, or the offending ones)


def _words(ids: list[str]) -> str:
    names = [features.label(i) if i in features.BY_ID else f"'{i}'" for i in ids]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


# The parts of a setup other than its features, in the order a proposal names them, with the menu each comes from.
SETUP_PARTS = (("window", setup_settings.WINDOW_IDS), ("weighting", setup_settings.WEIGHTING_IDS),
               ("training_innings", setup_settings.TRAINING_INNINGS_IDS))
DEFAULT_SETUP = ("all", "none", "population")        # (window, weighting, training innings): used when no setup is named


def setup_key(parts: dict) -> tuple:
    """What makes two setups the same: the features as a set, and the other three parts."""
    return (frozenset(parts["features"]), parts["window"], parts["weighting"], parts["training_innings"])


def _menu_text(menu: str, ids: list[str]) -> str:
    return ", ".join(f"{i} ({setup_settings.label(menu, i)})" for i in ids)


def check_proposal(proposal: dict, tried: list[dict], fitter) -> Check:
    """Apply every rule to a proposed setup. The first rule that fails decides; nothing is changed or guessed.

    `proposal` has features, window, weighting and training_innings (a part may be absent or None); `tried` holds the
    setups already fitted, in the same shape; `fitter` is the `fitting.Fitter` for the run, which judges how many innings a
    setup leaves in each check and whether the features repeat each other in any check's training rows.

    Order: a missing part, an off-menu window, weighting or training innings (each matched exactly), an unknown feature,
    no features, more than the limit, the same setup already tried (all four parts, features as a set), too few training
    innings in some check, then redundant features."""
    names = ("features", "window", "weighting", "training_innings")
    missing = [n for n in names if proposal.get(n) is None]
    if missing:
        return Check("rejected", "missing_part",
                     f"The proposal did not give {_join(missing)}. A setup needs all four parts: features, window, "
                     "weighting and training_innings.", [])
    for part, ids in SETUP_PARTS:
        value = proposal[part]
        if not isinstance(value, str) or value not in ids:
            return Check("rejected", f"unknown_{part}",
                         f"{value!r} is not a choice for {part}. Choose exactly one of: {_menu_text(part, ids)}.", [])
    proposed = proposal["features"]
    if not isinstance(proposed, list) or not all(isinstance(f, str) for f in proposed):
        return Check("rejected", "unknown_feature", "The features must be a list of catalogue names.", [])
    unknown = [name for name in proposed if name not in features.BY_ID]
    if unknown:
        listed = ", ".join(f"'{n}'" for n in unknown)
        return Check("rejected", "unknown_feature",
                     f"{listed} {'is' if len(unknown) == 1 else 'are'} not in the catalogue. Features must be "
                     "named exactly as they appear in the catalogue.", unknown)
    if not proposed:
        return Check("rejected", "empty", "The proposal named no features.", [])
    if len(proposed) > SET_LIMIT:
        return Check("rejected", "too_many",
                     f"The proposal named {len(proposed)} features; the limit is {SET_LIMIT}.", list(proposed))
    window, weighting, innings = proposal["window"], proposal["weighting"], proposal["training_innings"]
    here = setup_key({"features": proposed, "window": window, "weighting": weighting, "training_innings": innings})
    if any(setup_key(t) == here for t in tried):
        return Check("rejected", "already_tried",
                     "That setup was already tried: the same features, window, weighting and training innings.",
                     list(proposed))
    short = fitter.too_few(window, innings)
    if short:
        year, n = short[0]
        return Check("rejected", "too_few_innings",
                     f"With {setup_settings.label('window', window)} and {setup_settings.label('training_innings', innings)}, "
                     f"the check on {year} would have only {n} innings to learn from; at least "
                     f"{setup_settings.MIN_TRAIN_INNINGS} are needed.", list(proposed))
    twice = [f for f in dict.fromkeys(proposed) if proposed.count(f) > 1]
    if twice:
        return Check("rejected", "redundant", f"{_words(twice)} was named more than once.", twice)
    repeating = fitter.repeating(window, innings, list(proposed))
    if repeating:
        return Check("rejected", "redundant",
                     f"{_words(repeating)} repeat each other: one can be worked out exactly from the others, so a "
                     "straight-line fit would have no single answer.", repeating)
    return Check("fit", None, "The proposal passed every check.", list(proposed))


def _join(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


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


# --- rolling validation (feature 008) -------------------------------------------------------------------------------

def forward_step_rolling(fitter, window: str, weighting: str, training_innings: str, current: list[str],
                         candidates: list[str] | None = None) -> dict | None:
    """The single feature whose addition gives the lowest average validation error over the three rolling checks, or None.

    Candidates are tried in catalogue order and the first of any tie wins. An addition is skipped if it would exceed the
    set limit or make the set redundant in any check's training rows."""
    if len(current) >= SET_LIMIT:
        return None
    best: dict | None = None
    for feature in (features.IDS if candidates is None else candidates):
        if feature in current:
            continue
        trial = current + [feature]
        if fitter.redundant(window, training_innings, trial):
            continue
        result = fitter.evaluate(window, weighting, training_innings, trial)
        if best is None or result["mae"] < best["mae"]:
            best = {"feature": feature, "features": trial, "mae": result["mae"], "r2": result["r2"],
                    "checks": result["checks"]}
    return best


def validation_winner(llm_best: dict | None, forward_best: dict | None) -> dict:
    """Which method's best setup wins: the lower displayed average validation error, decided before the test year is read.
    A tie goes to the language model; with only one method's setup, that one wins."""
    if llm_best is not None and forward_best is not None:
        llm_error, forward_error = llm_best["validation_mae"], forward_best["validation_mae"]
        if forward_error < llm_error:
            winner, why = "forward", (f"forward selection's best setup had the lower average validation error "
                                      f"({forward_error} against {llm_error})")
        elif llm_error < forward_error:
            winner, why = "llm", (f"the language model's best setup had the lower average validation error "
                                  f"({llm_error} against {forward_error})")
        else:
            winner, why = "llm", (f"the two best setups tied on average validation error ({llm_error}), "
                                  "so the language model's is taken")
    elif llm_best is not None:
        winner, why = "llm", "forward selection produced no setup"
    else:
        winner, why = "forward", "the language model produced no setup"
    return {"winner": winner, "reason": why, "chosen_on": "validation"}


# --- the grid search: the rival (feature 008) ------------------------------------------------------------------------

# Every combination of training innings, window and weighting, in this order (the order breaks ties).
GRID = [(innings, window, weighting) for innings in setup_settings.TRAINING_INNINGS_IDS
        for window in setup_settings.WINDOW_IDS for weighting in setup_settings.WEIGHTING_IDS]


def _two(x: float) -> float:
    return round(float(x), 2)


def _cell_checks(checks: list[dict]) -> list[dict]:
    return [{"year": c["year"], "mae": _two(c["mae"])} for c in checks]


def grid_search(fitter) -> dict:
    """Forward selection inside every combination in GRID, all judged on the same three rolling checks.

    Inside a combination each step adds the single feature that most lowers the average error over the three checks
    (the first of a tie wins), skipping additions that exceed the set limit or repeat other features in any check, and
    stops when the displayed (two decimal) error no longer falls. Across combinations the lowest displayed error wins and
    the first in GRID order takes a tie. A combination that leaves too few training innings in a check is shown as not
    allowed and is never fitted. Returns {"cells", "best", "build_up"} as plain data."""
    cells: list[dict] = []
    best: dict | None = None
    best_build: list[dict] = []
    for innings, window, weighting in GRID:
        cell: dict = {"training_innings": innings, "window": window, "weighting": weighting, "allowed": True, "note": None,
                      "features": [], "validation_mae": None, "validation_r2": None, "checks": []}
        short = fitter.too_few(window, innings)
        if short:
            year, n = short[0]
            cell.update(allowed=False, note=f"Only {n} innings to learn from in the {year} check; at least "
                                            f"{setup_settings.MIN_TRAIN_INNINGS} are needed.")
            cells.append(cell)
            continue
        current: list[str] = []
        build: list[dict] = []
        previous: float | None = None
        last: dict | None = None
        while True:
            step = forward_step_rolling(fitter, window, weighting, innings, current)
            if step is None or (previous is not None and _two(step["mae"]) >= previous):
                break
            current, previous, last = step["features"], _two(step["mae"]), step
            build.append({"feature": step["feature"], "validation_mae": previous})
        if last is not None:
            cell.update(features=list(current), validation_mae=previous, validation_r2=_two(last["r2"]),
                        checks=_cell_checks(last["checks"]))
        cells.append(cell)
        if last is not None and (best is None or cell["validation_mae"] < best["validation_mae"]):
            best, best_build = cell, build
    return {"cells": cells, "best": best, "build_up": best_build}
