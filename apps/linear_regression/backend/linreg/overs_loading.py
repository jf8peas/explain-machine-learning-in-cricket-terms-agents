"""The per-over totals (data/overs.csv) and the example innings drawn in the Working tab's hero. App-specific.

overs.csv holds, for every kept first innings, the cumulative runs and wickets at the end of each over bowled. It is not
shown on the Data tab. The example innings is looked up among the introduction's training rows only (test-population
innings before the first check year), so a check-year or test-year innings can never be drawn. Anything unexpected about
it gives None and a logged warning, never a guess.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd

from .data_loading import DEFAULT_PATH, DataError

log = logging.getLogger("linreg.overs")
DEFAULT_OVERS_PATH = DEFAULT_PATH.with_name("overs.csv")
REQUIRED_COLUMNS = ["match_id", "over", "runs", "wickets"]
OVERS = 20
_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
           "November", "December"]


def overs_path_for(innings_path: str | Path | None) -> Path:
    """overs.csv lives next to the innings file it was prepared with."""
    return Path(innings_path).with_name("overs.csv") if innings_path else DEFAULT_OVERS_PATH


def load_overs(path: str | Path | None = None) -> pd.DataFrame:
    """Read and validate the per-over table. Match ids are kept as text."""
    p = Path(path) if path else DEFAULT_OVERS_PATH
    if not p.exists():
        raise DataError(f"The per-over data file was not found ({p.name}).")
    try:
        df = pd.read_csv(p, dtype={"match_id": str})
    except pd.errors.EmptyDataError:
        raise DataError("The per-over data file is empty.") from None
    except (ValueError, KeyError) as exc:
        raise DataError(f"The per-over data file could not be read: {exc}") from None
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise DataError("The per-over data file is missing columns: " + ", ".join(missing) + ".")
    return df


def date_label(when: pd.Timestamp) -> str:
    """"December 2020"."""
    return f"{_MONTHS[when.month - 1]} {when.year}"


def _warn(match_id: str, why: str) -> None:
    log.warning("the example innings (match %s) cannot be drawn: %s", match_id, why)


def example_innings(train: pd.DataFrame, overs: pd.DataFrame, match_id: str | int) -> dict[str, Any] | None:
    """The example innings for the hero, or None (with a warning) when it cannot be drawn honestly.

    `train` is the introduction's training rows; `overs` the per-over table. The innings must be one of the training rows,
    have exactly the overs 1 to 20, never lose runs or wickets from one over to the next, and agree with its row at
    over 10 and over 20."""
    wanted = str(match_id)
    rows = train[train["match_id"].astype(str) == wanted]
    if rows.empty:
        _warn(wanted, "it is not among the test-population innings before the first check year")
        return None
    row = rows.iloc[0]
    mine = overs[overs["match_id"].astype(str) == wanted].sort_values("over")
    if mine.empty:
        _warn(wanted, "it has no per-over totals")
        return None
    if list(mine["over"]) != list(range(1, OVERS + 1)):
        _warn(wanted, f"it does not have exactly the overs 1 to {OVERS}")
        return None
    runs = [int(x) for x in mine["runs"]]
    wickets = [int(x) for x in mine["wickets"]]
    if any(b < a for a, b in zip(runs, runs[1:])) or any(b < a for a, b in zip(wickets, wickets[1:])):
        _warn(wanted, "its cumulative totals go down")
        return None
    if (runs[9], wickets[9]) != (int(row["runs_at_10"]), int(row["wickets_at_10"])) or runs[-1] != int(row["final_total"]):
        _warn(wanted, "its per-over totals disagree with the innings table at over 10 or over 20")
        return None
    final = int(row["final_total"])
    projection = int(row["runs_at_10"]) * 2
    previous = [0, *wickets[:-1]]
    return {
        "match_id": wanted,
        "batting_team": str(row["batting_team"]),
        "bowling_team": str(row["bowling_team"]),
        "venue": str(row["venue"]),
        "date": row["match_date"].date().isoformat(),
        "date_label": date_label(row["match_date"]),
        "runs": runs,
        "wickets": wickets,
        "runs_at_10": int(row["runs_at_10"]),
        "wickets_at_10": int(row["wickets_at_10"]),
        "final_total": final,
        "tv_projection": projection,
        "tv_miss": round(abs(final - projection), 1),
        "wicket_overs": [over for over, now, before in zip(range(1, OVERS + 1), wickets, previous) if now > before],
    }
