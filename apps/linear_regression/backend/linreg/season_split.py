"""Calendar-year train/test split. Shared-library candidate.

Never random: innings from the same match or year must not appear in both sets.
"""
from __future__ import annotations

import pandas as pd


def split_by_year(df: pd.DataFrame, date_col: str = "match_date") -> tuple[pd.DataFrame, pd.DataFrame, int]:
    """Test on the latest calendar year present, train on all earlier years."""
    years = df[date_col].dt.year
    test_year = int(years.max())
    return df[years < test_year], df[years == test_year], test_year
