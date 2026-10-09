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
from .population import population_counts
from .season_split import rolling_checks

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
    "batting_team": {"label": "Batting team", "type": "text",
                     "description": "The side batting first, with its name as written in the source files mapped to one name per team."},
    "bowling_team": {"label": "Bowling team", "type": "text", "description": "The side bowling first."},
    "in_test_population": {"label": "In test population", "type": "integer", "filter": "select",
                           "labels": {"1": "In", "0": "Out"},
                           "description": "1 if the innings is one the agent is tested on: every IPL and BBL innings, and the T20 "
                                          "internationals where both teams are ICC full members. 0 otherwise."},
    "final_total": {"label": "Final total", "type": "integer",
                    "description": "The first innings' final score, which is what the agent tries to predict."},
}
USED_FOR = {"key": "used_for", "label": "Used for", "type": "text", "filter": "select",
            "labels": {"training": "Training", "training_validation": "Training and validation", "test": "Test"},
            "description": "Training: the earliest years, which the agent only learns from. Training and validation: the "
                           "three years before the test year; each is a check year, judged by a model that learned only "
                           "from the years before it, and is also learning data for the checks after it. Test: the "
                           "latest year, used once at the end for the final mark. Split by calendar year, never at "
                           "random. Only innings in the test population are ever scored."}


def _column(key: str) -> dict[str, Any]:
    if key in _FIXED_COLUMNS:
        return {"key": key, **_FIXED_COLUMNS[key]}
    f = features.BY_ID[key]  # a candidate feature: heading, description and (for the dummies) a 0/1 filter
    column = {"key": key, "label": f["heading"], "type": "integer", "description": f["description"]}
    if key in DUMMIES or f["unit"] == "0/1":
        column["filter"] = "select"
    return column


# Columns follow the prepared table's order, which the catalogue defines; "Used for" comes last.
COLUMNS: list[dict[str, Any]] = [_column(k) for k in features.PREPARED_COLUMNS] + [USED_FOR]
COLUMN_KEYS = [c["key"] for c in COLUMNS]


def _day(ts: pd.Timestamp) -> str:
    return f"{ts.day} {ts.strftime('%b %Y')}"


def exclusion_rows(manifest: dict[str, Any]) -> list[dict[str, str]]:
    """What the preparation script left out and why, totalled over the competitions: one row per reason that applied.
    The Data tab's "Excluded, and why" section and the graph's done-beforehand summary both use this."""
    excluded: dict[str, int] = {}
    for comp in manifest["counts"].values():
        if isinstance(comp, dict):
            for reason, n in comp.get("excluded", {}).items():
                excluded[reason] = excluded.get(reason, 0) + int(n)
    return [{"label": EXCLUSION_LABELS.get(r, r.replace("_", " ").capitalize()), "value": f"{n:,}"}
            for r, n in excluded.items() if n]


def used_for_by_year(rolling) -> dict[int, str]:
    """What each calendar year is used for: the test year, the three check years, or training before them."""
    marks = {c.year: "training_validation" for c in rolling.checks}
    marks[rolling.test_year] = "test"
    return marks


def _summary(df: pd.DataFrame, manifest: dict[str, Any]) -> dict[str, Any]:
    rolling = rolling_checks(df)
    years = df["match_date"].dt.year
    marks = used_for_by_year(rolling)
    first_check = rolling.checks[0].year
    training = int((years < first_check).sum())
    checks = int(years.isin([c.year for c in rolling.checks]).sum())
    tests = int((years == rolling.test_year).sum())
    train_years = sorted(int(y) for y in years.unique() if y < first_check)
    check_years = [str(c.year) for c in rolling.checks]
    counts = manifest["counts"]
    comps = [(k, v) for k, v in counts.items() if isinstance(v, dict)]
    downloaded = pd.Timestamp(manifest["download_date"])
    pop = population_counts(df)
    return {
        "headline": [
            {"label": "Innings", "value": f"{int(counts['total_innings']):,}"},
            {"label": "Dates", "value": f"{_day(df['match_date'].min())} to {_day(df['match_date'].max())}"},
            {"label": "Downloaded from Cricsheet", "value": _day(downloaded)},
        ],
        "sections": [
            {"title": "Innings per competition",
             "rows": [{"label": COMPETITION_NAMES.get(k, k), "value": f"{int(v['innings_kept']):,}"} for k, v in comps]},
            {"title": "How the years are used", "note": "How the agent uses the innings, by calendar year: every setup is judged "
                                                         "on three check years, each by a model that learned only from the "
                                                         "years before it, and the latest year is kept for a single final test.",
             "rows": [{"label": f"Training ({train_years[0]} to {train_years[-1]})" if train_years else "Training",
                       "value": f"{training:,}"},
                      {"label": f"Training and validation ({', '.join(check_years[:-1])} and {check_years[-1]})",
                       "value": f"{checks:,}"},
                      {"label": f"Test ({rolling.test_year})", "value": f"{tests:,}"}]},
            {"title": "Test population", "note": "The innings the agent is judged on: every IPL and BBL innings, and the T20 "
                                                  "internationals where both teams are ICC full members. Every check year "
                                                  "and the test year are scored on these innings only.",
             "rows": [{"label": "In the test population", "value": f"{pop['in']:,}"},
                      {"label": "Outside it", "value": f"{pop['out']:,}"},
                      *[{"label": f"{COMPETITION_NAMES.get(c, c)}: in the population",
                         "value": f"{v['in']:,} of {v['in'] + v['out']:,}"} for c, v in pop["by_competition"].items()]]},
            {"title": "Excluded, and why", "note": EXCLUSIONS_NOTE,
             "rows": exclusion_rows(manifest)},
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
    marks = used_for_by_year(rolling_checks(df))
    rows = []
    for rec in df.itertuples(index=False):
        values = [getattr(rec, k) for k in COLUMN_KEYS[:-1]]
        date = values[COLUMN_KEYS.index("match_date")]
        values[COLUMN_KEYS.index("match_date")] = date.strftime("%Y-%m-%d")
        values.append(marks.get(date.year, "training"))
        rows.append(to_jsonable(values))
    return {"columns": COLUMNS, "rows": rows, "summary": summary, "notes": build_notes(df, COMPETITION_NAMES)}
