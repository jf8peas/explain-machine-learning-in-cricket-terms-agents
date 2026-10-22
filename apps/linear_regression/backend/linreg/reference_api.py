"""GET /api/reference: how good the two references are, for the introduction. App-specific.

Worked out on the test-population innings in the years before the first check year (test year - 3), so the check years and
the test year stay unseen and every method is scored on the kind of innings the whole app is judged on. The result is computed once per
process and kept; a failure is not kept, so the next request tries again. If the data cannot be read the goal and the
method names and the glossary (`terms`, `definitions`, `banned`, `terms_version`, feature 021) are still sent, with a message, so the page can show the goal and say the figures could not be loaded.

The hero (feature 013) adds `average_total` (the average-total guess's value), `example` (the innings named by
settings.EXAMPLE_MATCH_ID, from the same training rows, or None with a logged warning when it cannot be drawn) and `hero`
(the caption, panel sentence, footnote and chart text, worked out in hero_text).
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from . import accuracy_text, hero_text, settings
from .accuracy import accuracy, display
from .data_loading import DataError, load_innings
from .evaluation import broadcaster_projection, know_nothing_guess
from .goal import goal, meter, reference_finding
from .methods import method_defs, reference_terms
from .overs_loading import example_innings, load_overs, overs_path_for
from .season_split import rolling_checks

log = logging.getLogger("linreg.reference")
CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400"   # the same as /api/data
NOT_LOADED = "The accuracy figures could not be loaded."


def build_reference(path: str | Path | None = None) -> dict[str, Any]:
    """The whole response for the training years of the data at `path` (default: the committed data)."""
    rolling = rolling_checks(load_innings(path))
    # only test-population innings before the first check year are read from here on (never a check year or the test year)
    train = rolling.training_rows(rolling.checks[0], "all", "population")
    actual = train["final_total"]
    known = display(accuracy(actual, know_nothing_guess(actual, len(train))))
    projected = display(accuracy(actual, broadcaster_projection(train["runs_at_10"])))
    years = sorted(int(y) for y in train["match_date"].dt.year.unique())
    finding = reference_finding(known["average_miss"], projected["average_miss"])
    training = {"first_year": years[0], "last_year": years[-1], "innings": len(train)}
    average_total = round(float(actual.mean()))
    test = {"year": int(rolling.test_year), "innings": int(rolling.n_test)}      # counts only: no test row is read
    example = _example(train, path)
    return {
        "goal": goal(),
        "methods": method_defs(),
        "training": training,
        "figures": {"know_nothing": known, "broadcaster": projected},
        "gap": {"average_miss_runs": finding["gap_runs"], "average_miss_percent": finding["gap_percent"],
                "within_10_points": round(projected["within_10"] - known["within_10"], 1)},
        "finding": finding["finding"],
        "words": {m: {"bias": accuracy_text.bias_words(f["bias"]), "bias_short": accuracy_text.bias_short(f["bias"])}
                  for m, f in (("know_nothing", known), ("broadcaster", projected))},
        "sentences": {
            "headline": accuracy_text.bar_sentence(years[0], years[-1], len(train)),
            "gap": accuracy_text.gap_sentence(known, projected),
            "finding": accuracy_text.finding_sentence(finding["finding"], finding["gap_runs"], finding["gap_percent"]),
            "bias": accuracy_text.projection_bias_sentence(projected["bias"]),
        },
        "meter": meter(known["average_miss"], projected["average_miss"], training),
        "average_total": average_total,
        "example": example,
        "hero": hero_text.build_hero({"know_nothing": known, "broadcaster": projected}, training,
                                     goal()["margin_runs"], average_total, example),
        "message": None,
        "goal_card": hero_text.goal_card(goal()["margin_runs"], projected["average_miss"], training, test),
        "test": test,
        **reference_terms(),
    }


def _example(train, path: str | Path | None) -> dict[str, Any] | None:
    """The example innings for the hero; None (with a warning) when the per-over data or the innings cannot be used."""
    try:
        overs = load_overs(overs_path_for(path))
    except DataError as exc:
        log.warning("the example innings cannot be drawn: %s", exc)
        return None
    return example_innings(train, overs, settings.EXAMPLE_MATCH_ID)


def _unavailable() -> dict[str, Any]:
    return {"goal": goal(), "methods": method_defs(), "training": None, "figures": None, "gap": None,
            "finding": None, "words": None, "sentences": None, "meter": None, "average_total": None, "example": None,
            "hero": None, "message": NOT_LOADED,
            "goal_card": hero_text.goal_card(goal()["margin_runs"]), "test": None, **reference_terms()}


def create_router(data_path: str | Path | None = None) -> APIRouter:
    router = APIRouter()
    kept: dict[str, Any] = {}

    @router.get("/reference")
    def reference() -> JSONResponse:
        if "body" not in kept:
            try:
                kept["body"] = build_reference(data_path)
            except Exception as exc:  # noqa: BLE001 - the goal is still worth sending
                log.warning("reference figures could not be worked out: %s", exc)
                return JSONResponse(_unavailable(), headers={"Cache-Control": "no-store"})
        return JSONResponse(kept["body"], headers={"Cache-Control": CACHE_CONTROL})

    return router
