"""Builds the Data tab's table: columns, rows and summary for this app's innings data."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from . import features
from .competition_dummies import DUMMIES, REFERENCE, check_dummies
from .data_loading import DEFAULT_PATH, DataError, load_innings
from .data_notes import build_notes
from .graph_api import to_jsonable
from .season_split import split_three_ways

DEFAULT_MANIFEST = DEFAULT_PATH.parent / "manifest.json"
COMPETITION_NAMES = {"t20i": "T20 International", "ipl": "IPL", "bbl": "BBL"}
EXCLUSIONS_NOTE = (
    "These choices were made before the agent runs, when the data was prepared by the script "
    "scripts/prepare_data.py. The agent does not decide what to exclude: it only ever sees the innings "
    "that were kept."
)
EXCLUSION_LABELS = {
    "women": "Women's matches",
    "no_result": "No result",
    "dls": "Rain-affected (DLS)",
    "reduced_overs": "Reduced overs",
    "super_over": "Super overs",
    "ended_before_10_overs": "Innings ended before 10 overs",
    "no_first_innings": "No first innings",
}


_FIXED_COLUMNS: dict[str, dict[str, Any]] = {
    "match_id": {"label": "Match ID", "type": "integer", "description": "Cricsheet's identifier for the match."},
    "match_date": {"label": "Match date", "type": "date", "filter": "year",
                   "description": "The date the match was played."},
    "season": {"label": "Season", "type": "text",
               "description": "The season the match belongs to, as Cricsheet labels it (for example 2023/24)."},
    "competition": {"label": "Competition", "type": "text", "filter": "select", "labels": COMPETITION_NAMES,
                    "description": "Men's T20 internationals, the IPL or the BBL."},
    "venue": {"label": "Venue", "type": "text", "description": "The ground where the match was played."},
    "final_total": {"label": "Final total", "type": "integer",
                    "description": "The first innings' final score, which is what the agent tries to predict."},
}
USED_FOR = {"key": "used_for", "label": "Used for", "type": "text", "filter": "select",
            "labels": {"training": "Training", "validation": "Validation", "test": "Test"},
            "description": "Training: the agent fits its models on these innings. Validation: the year used to judge "
                           "feature sets while choosing. Test: the latest year, used once at the end for the final "
                           "mark. Split by calendar year, never at random."}


def _column(key: str) -> dict[str, Any]:
    if key in _FIXED_COLUMNS:
        return {"key": key, **_FIXED_COLUMNS[key]}
    f = features.BY_ID[key]  # a candidate feature: heading, description and (for the dummies) a 0/1 filter
    column = {"key": key, "label": f["heading"], "type": "integer", "description": f["description"]}
    if key in DUMMIES:
        column["filter"] = "select"
    return column


# Columns follow the prepared table's order, which the catalogue defines; "Used for" comes last.
COLUMNS: list[dict[str, Any]] = [_column(k) for k in features.PREPARED_COLUMNS] + [USED_FOR]
COLUMN_KEYS = [c["key"] for c in COLUMNS]


def _day(ts: pd.Timestamp) -> str:
    return f"{ts.day} {ts.strftime('%b %Y')}"


def _summary(df: pd.DataFrame, manifest: dict[str, Any]) -> dict[str, Any]:
    slices = split_three_ways(df)
    train_years = sorted(int(y) for y in slices.train["match_date"].dt.year.unique())
    counts = manifest["counts"]
    comps = [(k, v) for k, v in counts.items() if isinstance(v, dict)]
    excluded: dict[str, int] = {}
    for _, comp in comps:
        for reason, n in comp.get("excluded", {}).items():
            excluded[reason] = excluded.get(reason, 0) + int(n)
    downloaded = pd.Timestamp(manifest["download_date"])
    return {
        "headline": [
            {"label": "Innings", "value": f"{int(counts['total_innings']):,}"},
            {"label": "Dates", "value": f"{_day(df['match_date'].min())} to {_day(df['match_date'].max())}"},
            {"label": "Downloaded from Cricsheet", "value": _day(downloaded)},
        ],
        "sections": [
            {"title": "Innings per competition",
             "rows": [{"label": COMPETITION_NAMES.get(k, k), "value": f"{int(v['innings_kept']):,}"} for k, v in comps]},
            {"title": "Slices, by calendar year", "note": "How the agent uses the innings. The latest year is kept for "
                                                          "a single final test.",
             "rows": [{"label": f"Training ({train_years[0]} to {train_years[-1]})" if train_years else "Training", "value": f"{len(slices.train):,}"},
                      {"label": f"Validation ({slices.validation_year})" if slices.validation_year else "Validation", "value": f"{len(slices.validation):,}"},
                      {"label": f"Test ({slices.test_year})", "value": f"{len(slices.test):,}"}]},
            {"title": "Excluded, and why", "note": EXCLUSIONS_NOTE,
             "rows": [{"label": EXCLUSION_LABELS.get(r, r.replace("_", " ").capitalize()), "value": f"{n:,}"}
                      for r, n in excluded.items() if n]},
        ],
        "attribution": manifest["attribution"],
        "attribution_url": "https://cricsheet.org",
        "file_stem": "t20-first-innings",
        "file_date": manifest["download_date"],
    }


def build_table(data_path: str | Path | None = None, manifest_path: str | Path | None = None) -> dict[str, Any]:
    df = load_innings(data_path, required=features.PREPARED_COLUMNS)
    features.check_features(df)
    check_dummies(df)  # the Data tab never shows a file whose dummies are wrong
    mpath = Path(manifest_path) if manifest_path else DEFAULT_MANIFEST
    try:
        manifest = json.loads(mpath.read_text(encoding="utf-8"))
        summary = _summary(df, manifest)
    except (OSError, ValueError, KeyError) as exc:
        raise DataError(f"The data summary could not be read: {exc}") from None
    slices = split_three_ways(df)
    used = {**{i: "training" for i in slices.train.index}, **{i: "validation" for i in slices.validation.index},
            **{i: "test" for i in slices.test.index}}
    rows = []
    for idx, rec in zip(df.index, df.itertuples(index=False)):
        values = [getattr(rec, k) for k in COLUMN_KEYS[:-1]]
        values[COLUMN_KEYS.index("match_date")] = values[COLUMN_KEYS.index("match_date")].strftime("%Y-%m-%d")
        values.append(used[idx])
        rows.append(to_jsonable(values))
    return {"columns": COLUMNS, "rows": rows, "summary": summary, "notes": build_notes(df, COMPETITION_NAMES)}
