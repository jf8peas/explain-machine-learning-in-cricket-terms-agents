"""Competition dummy variables: THE one definition of the mapping. App-specific.

A linear regression can only use numbers, so the text `competition` becomes 0/1 columns. T20 international
is the reference category: it has no column and is the row where both dummies are 0.

The preparation script, the load_data check, the Data tab columns and the tests all import from here.
Nothing else should spell out the dummy column names or what each one stands for.
"""
from __future__ import annotations

import pandas as pd

from .data_loading import REQUIRED_COLUMNS, DataError

REFERENCE = "t20i"
# dummy column -> the competition it stands for (order matters: it is the column order)
DUMMIES = {"is_ipl": "ipl", "is_bbl": "bbl"}
DUMMY_COLUMNS = list(DUMMIES)
KNOWN_COMPETITIONS = {REFERENCE, *DUMMIES.values()}


def _with_dummies_after_competition(columns: list[str]) -> list[str]:
    at = columns.index("competition") + 1
    return columns[:at] + DUMMY_COLUMNS + columns[at:]


# The full ordered column list of the prepared innings table.
PREPARED_COLUMNS = _with_dummies_after_competition(REQUIRED_COLUMNS)


class UnknownCompetition(ValueError):
    """A competition value that has no dummy definition."""


def _unknown(value) -> UnknownCompetition:
    return UnknownCompetition(
        f"Unknown competition {value!r}: expected one of {', '.join(sorted(KNOWN_COMPETITIONS))}. "
        "Add it to linreg/competition_dummies.py before preparing the data.")


def dummy_values(competition: str) -> dict[str, int]:
    """The 0/1 value of every dummy column for one competition."""
    if competition not in KNOWN_COMPETITIONS:
        raise _unknown(competition)
    return {col: int(competition == comp) for col, comp in DUMMIES.items()}


def manifest_entry() -> dict:
    """What data/manifest.json records about the dummies."""
    return {"reference": REFERENCE, "columns": dict(DUMMIES)}


def add_dummies(df: pd.DataFrame) -> pd.DataFrame:
    """A copy of the table with the dummy columns added (or refreshed) right after `competition`."""
    unknown = sorted(set(df["competition"].dropna().unique()) - KNOWN_COMPETITIONS)
    if unknown or df["competition"].isna().any():
        raise _unknown(unknown[0] if unknown else None)
    out = df.drop(columns=[c for c in DUMMY_COLUMNS if c in df.columns])
    at = list(out.columns).index("competition") + 1
    for offset, (col, comp) in enumerate(DUMMIES.items()):
        out.insert(at + offset, col, (out["competition"] == comp).astype(int))
    return out


def check_dummies(df: pd.DataFrame) -> None:
    """Every row's dummies must be 0 or 1 and agree with its competition; otherwise raise DataError.

    A row is wrong (counted once) if a value is missing or not 0/1, both are 1, a dummy differs from what
    its competition requires, or the competition is unknown.
    """
    wrong = ~df["competition"].isin(KNOWN_COMPETITIONS)
    for col, comp in DUMMIES.items():
        value = pd.to_numeric(df[col], errors="coerce")
        wrong |= value.isna() | ~value.isin([0, 1]) | (value != (df["competition"] == comp).astype(int))
    n = int(wrong.sum())
    if n:
        who = "row has" if n == 1 else "rows have"
        raise DataError(f"{n} {who} competition columns ({', '.join(DUMMY_COLUMNS)}) that do not match their "
                        "competition: each must be 0 or 1 and agree with the competition.")
