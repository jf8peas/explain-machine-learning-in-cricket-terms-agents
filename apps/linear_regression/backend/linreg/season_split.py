"""Calendar-year splits: the rolling validation checks and the test year. Shared-library candidate.

Never random: innings from the same match or year must not appear in two slices, and a check only ever learns from years
before the one it checks.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from . import setup_settings
from .data_loading import DataError
from .population import COLUMN as POPULATION_COLUMN


# --- rolling validation (feature 008) ------------------------------------------------------------------------------

@dataclass(frozen=True)
class CheckSpec:
    """One check (or the final test): the year it scores and the calendar years strictly before it."""
    year: int
    label: str
    earlier_years: tuple[int, ...]


def years_for(spec: CheckSpec, window: str) -> tuple[int, ...]:
    """The earlier years a window allows for one check, relative to the year being scored."""
    reach = setup_settings.window_years(window)
    return spec.earlier_years if reach is None else tuple(y for y in spec.earlier_years if y >= spec.year - reach)


def age(match_year: int, scored_year: int) -> int:
    """How many years before the year being scored a match was played."""
    return scored_year - match_year


class Rolling:
    """The rolling checks for one table: the test year, three checks, the final test's spec and the row selections.

    Only `test_rows()` returns test-year rows; every other method reads years before the year it is given, so the test year
    is touched in one place."""

    def __init__(self, df: pd.DataFrame, test_year: int, checks: tuple[CheckSpec, ...], final: CheckSpec,
                 n_check: dict[int, int], n_test: int, date_col: str = "match_date"):
        self._df = df
        self._years = df[date_col].dt.year
        self._in_population = df[POPULATION_COLUMN].astype(int) == 1
        self.test_year, self.checks, self.final = test_year, checks, final
        self.n_check, self.n_test = n_check, n_test

    def test_rows(self) -> pd.DataFrame:
        """The test-population innings of the test year (read by the final test only)."""
        return self._df[(self._years == self.test_year) & self._in_population]

    def check_rows(self, spec: CheckSpec) -> pd.DataFrame:
        """The test-population innings of a check year."""
        if spec.year >= self.test_year:
            raise ValueError("check_rows is for the validation years; the test year is read with test_rows()")
        return self._df[(self._years == spec.year) & self._in_population]

    def training_rows(self, spec: CheckSpec, window: str, training_innings: str) -> pd.DataFrame:
        """The rows a setup learns from for one check (or for the final test): the years before `spec.year` that the window
        allows, narrowed to the test population when the setup asks for that."""
        mask = self._years.isin(years_for(spec, window))
        if training_innings == "population":
            mask &= self._in_population
        return self._df[mask]

    def ages(self, rows: pd.DataFrame, spec: CheckSpec) -> pd.Series:
        return spec.year - rows["match_date"].dt.year


def _few_years(n: int) -> DataError:
    word = {1: "one", 2: "two", 3: "three", 4: "four"}[n]
    return DataError(f"The data covers only {word} calendar year{'s' if n > 1 else ''}. It needs at least five: "
                     "earlier years to learn from, three check years and the test year.")


def rolling_checks(df: pd.DataFrame, date_col: str = "match_date") -> Rolling:
    """The rolling checks for a table: with test year Y (the latest calendar year present) the checks are Y-3, Y-2 and Y-1,
    each trained only on the years before it. Raises DataError when a check year or the test year has too few
    test-population innings, or when there are too few years to learn from."""
    if POPULATION_COLUMN not in df.columns:
        raise DataError(f"The innings data file is missing columns: {POPULATION_COLUMN}.")
    years = df[date_col].dt.year
    n_years = int(years.nunique())
    if n_years < 5:
        raise _few_years(n_years)
    test_year = int(years.max())
    inside = df[POPULATION_COLUMN].astype(int) == 1
    per_year = {int(y): int(n) for y, n in years[inside].value_counts().items()}
    check_years = tuple(test_year - k for k in setup_settings.CHECK_OFFSETS)
    for name, year in [*[("validate", y) for y in check_years], ("test", test_year)]:
        n = per_year.get(year, 0)
        if n < setup_settings.MIN_CHECK_INNINGS:
            raise DataError(f"Only {n} test-population innings are available from {year}, fewer than the "
                            f"{setup_settings.MIN_CHECK_INNINGS} needed to {name} the model fairly.")
    first = check_years[0]
    before_first = sum(n for y, n in per_year.items() if y < first)
    if before_first < setup_settings.MIN_TRAIN_INNINGS:
        raise DataError(f"Only {before_first} test-population innings come from the years before {first}, fewer than "
                        f"the {setup_settings.MIN_TRAIN_INNINGS} needed to learn from before the first check.")
    all_years = sorted(int(y) for y in years.unique())

    def spec(year: int) -> CheckSpec:
        return CheckSpec(year=year, label=str(year), earlier_years=tuple(y for y in all_years if y < year))

    checks = tuple(spec(y) for y in check_years)
    return Rolling(df, test_year, checks, spec(test_year), {y: per_year[y] for y in check_years}, per_year[test_year],
                   date_col)
