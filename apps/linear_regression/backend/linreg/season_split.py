"""Calendar-year splits. Shared-library candidate.

Never random: innings from the same match or year must not appear in two slices.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class Slices:
    """Training (earliest years), validation (the year before the latest) and test (the latest year)."""
    train: pd.DataFrame
    validation: pd.DataFrame
    test: pd.DataFrame
    validation_year: int | None
    test_year: int
    n_train: int = 0         # row counts, so callers can report sizes without touching a slice's data
    n_validation: int = 0
    n_test: int = 0


def split_three_ways(df: pd.DataFrame, date_col: str = "match_date") -> Slices:
    """Test on the latest calendar year present, validate on the latest year before it, train on all earlier years."""
    years = df[date_col].dt.year
    test_year = int(years.max())
    before = years[years < test_year]
    validation_year = int(before.max()) if len(before) else None
    train = df[years < validation_year] if validation_year is not None else df.iloc[0:0]
    validation = df[years == validation_year] if validation_year is not None else df.iloc[0:0]
    test = df[years == test_year]
    return Slices(train=train, validation=validation, test=test, validation_year=validation_year, test_year=test_year,
                  n_train=len(train), n_validation=len(validation), n_test=len(test))


def split_by_year(df: pd.DataFrame, date_col: str = "match_date") -> tuple[pd.DataFrame, pd.DataFrame, int]:
    """Test on the latest calendar year present, train on all earlier years."""
    years = df[date_col].dt.year
    test_year = int(years.max())
    return df[years < test_year], df[years == test_year], test_year
