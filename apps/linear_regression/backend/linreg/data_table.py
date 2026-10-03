"""Builds the Data tab's table: columns, rows and summary for this app's innings data."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from .competition_dummies import DUMMIES, PREPARED_COLUMNS, REFERENCE, check_dummies
from .data_loading import DEFAULT_PATH, DataError, load_innings
from .data_notes import build_notes
from .graph_api import to_jsonable
from .season_split import split_by_year

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


def _dummy_column(key: str, competition: str) -> dict[str, Any]:
    name = COMPETITION_NAMES[competition]
    return {"key": key, "label": f"{name} (0/1)", "type": "integer", "filter": "select",
            "description": f"A yes/no question about the innings, as a number: 1 if it was played in the {name}, "
                           f"otherwise 0. A {COMPETITION_NAMES[REFERENCE]} innings has 0 in both of the (0/1) "
                           "competition columns."}


_BASE_COLUMNS: list[dict[str, Any]] = [
    {"key": "match_id", "label": "Match ID", "type": "integer",
     "description": "Cricsheet's identifier for the match."},
    {"key": "match_date", "label": "Match date", "type": "date", "filter": "year",
     "description": "The date the match was played."},
    {"key": "season", "label": "Season", "type": "text",
     "description": "The season the match belongs to, as Cricsheet labels it (for example 2023/24)."},
    {"key": "competition", "label": "Competition", "type": "text", "filter": "select",
     "labels": COMPETITION_NAMES, "description": "Men's T20 internationals, the IPL or the BBL."},
    {"key": "venue", "label": "Venue", "type": "text",
     "description": "The ground where the match was played."},
    {"key": "runs_at_10", "label": "Runs at 10 overs", "type": "integer",
     "description": "Runs scored by the first-batting side after 10 overs."},
    {"key": "wickets_at_10", "label": "Wickets at 10 overs", "type": "integer",
     "description": "Wickets lost by the first-batting side after 10 overs."},
    {"key": "powerplay_runs", "label": "Powerplay runs (overs 1-6)", "type": "integer",
     "description": "Runs scored in the first six overs."},
    {"key": "final_total", "label": "Final total", "type": "integer",
     "description": "The first innings' final score, which is what the agent tries to predict."},
    {"key": "used_for", "label": "Used for", "type": "text", "filter": "select",
     "labels": {"training": "Training", "test": "Test"},
     "description": "Whether the agent learns from this innings (Training) or is marked on it (Test). "
                    "The latest calendar year is the test set; earlier years are training."},
]
# The two dummy columns sit immediately after `competition`, built from the one definition of the mapping.
_at = next(i for i, c in enumerate(_BASE_COLUMNS) if c["key"] == "competition") + 1
COLUMNS: list[dict[str, Any]] = (_BASE_COLUMNS[:_at]
                                 + [_dummy_column(key, comp) for key, comp in DUMMIES.items()]
                                 + _BASE_COLUMNS[_at:])
COLUMN_KEYS = [c["key"] for c in COLUMNS]


def _day(ts: pd.Timestamp) -> str:
    return f"{ts.day} {ts.strftime('%b %Y')}"


def _summary(df: pd.DataFrame, manifest: dict[str, Any]) -> dict[str, Any]:
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
    df = load_innings(data_path, required=PREPARED_COLUMNS)
    check_dummies(df)  # the Data tab never shows a file whose dummies are wrong
    mpath = Path(manifest_path) if manifest_path else DEFAULT_MANIFEST
    try:
        manifest = json.loads(mpath.read_text(encoding="utf-8"))
        summary = _summary(df, manifest)
    except (OSError, ValueError, KeyError) as exc:
        raise DataError(f"The data summary could not be read: {exc}") from None
    _, test, _ = split_by_year(df)
    test_index = set(test.index)
    rows = []
    for idx, rec in zip(df.index, df.itertuples(index=False)):
        values = [getattr(rec, k) for k in COLUMN_KEYS[:-1]]
        values[COLUMN_KEYS.index("match_date")] = values[COLUMN_KEYS.index("match_date")].strftime("%Y-%m-%d")
        values.append("test" if idx in test_index else "training")
        rows.append(to_jsonable(values))
    return {"columns": COLUMNS, "rows": rows, "summary": summary, "notes": build_notes(df, COMPETITION_NAMES)}
