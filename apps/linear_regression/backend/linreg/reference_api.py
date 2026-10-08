"""GET /api/reference: how good the two references are, for the introduction. App-specific.

Worked out on the training years only, so the validation and test years stay unseen. The result is computed once per
process and kept; a failure is not kept, so the next request tries again. If the data cannot be read the goal and the
method names are still sent, with a message, so the page can show the goal and say the figures could not be loaded.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from . import accuracy_text
from .accuracy import accuracy, display
from .data_loading import load_innings
from .evaluation import broadcaster_projection, know_nothing_guess
from .goal import goal, reference_finding
from .methods import method_defs
from .season_split import split_three_ways

log = logging.getLogger("linreg.reference")
CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400"   # the same as /api/data
NOT_LOADED = "The accuracy figures could not be loaded."


def build_reference(path: str | Path | None = None) -> dict[str, Any]:
    """The whole response for the training years of the data at `path` (default: the committed data)."""
    train = split_three_ways(load_innings(path)).train          # only the training slice is used from here on
    actual = train["final_total"]
    known = display(accuracy(actual, know_nothing_guess(actual, len(train))))
    projected = display(accuracy(actual, broadcaster_projection(train["runs_at_10"])))
    years = sorted(int(y) for y in train["match_date"].dt.year.unique())
    finding = reference_finding(known["average_miss"], projected["average_miss"])
    return {
        "goal": goal(),
        "methods": method_defs(),
        "training": {"first_year": years[0], "last_year": years[-1], "innings": len(train)},
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
        "message": None,
    }


def _unavailable() -> dict[str, Any]:
    return {"goal": goal(), "methods": method_defs(), "training": None, "figures": None, "gap": None,
            "finding": None, "words": None, "sentences": None, "message": NOT_LOADED}


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
