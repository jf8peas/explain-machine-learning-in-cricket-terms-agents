"""Load and validate the prepared innings table. Shared-library candidate."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

DEFAULT_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "innings.csv"
REQUIRED_COLUMNS = ["match_id", "match_date", "season", "competition", "venue",
                    "runs_at_10", "wickets_at_10", "powerplay_runs", "final_total"]


class DataError(Exception):
    """The prepared data is missing, empty or malformed."""


def load_innings(path: str | Path | None = None) -> pd.DataFrame:
    p = Path(path) if path else DEFAULT_PATH
    if not p.exists():
        raise DataError(f"The innings data file was not found ({p.name}).")
    try:
        df = pd.read_csv(p, parse_dates=["match_date"])
    except pd.errors.EmptyDataError:
        raise DataError("The innings data file is empty.") from None
    except (ValueError, KeyError) as exc:
        raise DataError(f"The innings data file could not be read: {exc}") from None
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise DataError("The innings data file is missing columns: " + ", ".join(missing) + ".")
    if df.empty:
        raise DataError("The innings data file has no innings in it.")
    return df
