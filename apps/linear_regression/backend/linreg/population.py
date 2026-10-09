"""The test population: which innings the whole app is judged on. App-specific.

Every IPL and BBL innings, and every T20 international innings where both teams are ICC full members. The preparation
script records the answer per innings (`in_test_population`); everything else reads that column through here, and
`check_population` makes sure the column agrees with the flags it is built from.
"""
from __future__ import annotations

import pandas as pd

from .competition_dummies import REFERENCE
from .data_loading import DataError

COLUMN = "in_test_population"
FLAGS = ["batting_full_member", "bowling_full_member"]


def in_population(df: pd.DataFrame) -> pd.Series:
    """True for the innings in the test population."""
    return df[COLUMN].astype(int) == 1


def population_counts(df: pd.DataFrame) -> dict:
    """How many innings are in and out of the population, overall and per competition."""
    inside = in_population(df)
    by_competition = {c: {"in": int(inside[g.index].sum()), "out": int((~inside[g.index]).sum())}
                      for c, g in df.groupby("competition", sort=False)}
    return {"in": int(inside.sum()), "out": int((~inside).sum()), "by_competition": by_competition}


def check_population(df: pd.DataFrame) -> None:
    """Raise DataError unless the population column agrees with the competition and the two full-member flags."""
    missing = [c for c in (COLUMN, *FLAGS) if c not in df.columns]
    if missing:
        raise DataError("The innings data file is missing columns: " + ", ".join(missing) + ".")
    league = df["competition"] != REFERENCE
    flags = df[FLAGS].apply(pd.to_numeric, errors="coerce")
    bad = int((league & (flags.fillna(1) != 0).any(axis=1)).sum())
    if bad:
        raise DataError(f"{bad} league {'innings has' if bad == 1 else 'innings have'} a full-member flag that is not 0 "
                        "(IPL and BBL sides are franchises, not national teams).")
    expected = (league | (flags.fillna(0) == 1).all(axis=1)).astype(int)
    wrong = int((pd.to_numeric(df[COLUMN], errors="coerce") != expected).sum())
    if wrong:
        raise DataError(f"{wrong} {'row has' if wrong == 1 else 'rows have'} an {COLUMN} value that does not match its "
                        "competition and the full-member flags.")
