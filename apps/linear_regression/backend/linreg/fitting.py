"""Fast, exact fitting for the rolling checks. App-specific.

Fitting a straight line is a small linear solve once the sums of products are known. For each check and each (window,
training innings) subset the arrays are built once; for each recency weighting the weighted Gram matrix (Xt W X, with the
intercept and every catalogue feature) and Xt W y are built once. Fitting any feature subset is then a solve on the
matching rows and columns, and predicting a validation year is a small matrix product, so judging thousands of setups
costs milliseconds each. `regression.fit` stays as the reference and a test holds the two together.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import features, setup_settings
from .evaluation import r2 as r2_score
from .redundancy import repeating_columns
from .season_split import CheckSpec, Rolling

IDS = features.IDS
_COLUMN = {feature: i + 1 for i, feature in enumerate(IDS)}     # column 0 of every design is the intercept


def _design(rows: pd.DataFrame) -> np.ndarray:
    return np.column_stack([np.ones(len(rows)), rows[IDS].to_numpy(dtype=float)])


def _weights(ages: np.ndarray, weighting: str) -> np.ndarray:
    half_life = setup_settings.HALF_LIVES[weighting]
    return np.ones(len(ages)) if half_life is None else 0.5 ** (ages / half_life)


class _Subset:
    """The training rows for one (window, training innings) choice in one check, with the Gram matrices per weighting."""

    def __init__(self, rows: pd.DataFrame, spec: CheckSpec):
        self.n = len(rows)
        self.X = _design(rows)
        self.y = rows["final_total"].to_numpy(dtype=float)
        self.ages = (spec.year - rows["match_date"].dt.year).to_numpy(dtype=float)
        self._gram: dict[str, tuple[np.ndarray, np.ndarray]] = {}

    def gram(self, weighting: str) -> tuple[np.ndarray, np.ndarray]:
        if weighting not in self._gram:
            w = _weights(self.ages, weighting)
            weighted = self.X * w[:, None]
            self._gram[weighting] = (weighted.T @ self.X, weighted.T @ self.y)
        return self._gram[weighting]


class _Check:
    def __init__(self, rolling: Rolling, spec: CheckSpec):
        self.rolling, self.spec = rolling, spec
        validation = rolling.check_rows(spec)
        self.Xv = _design(validation)
        self.yv = validation["final_total"].to_numpy(dtype=float)
        self._subsets: dict[tuple[str, str], _Subset] = {}

    def subset(self, window: str, training_innings: str) -> _Subset:
        key = (window, training_innings)
        if key not in self._subsets:
            self._subsets[key] = _Subset(self.rolling.training_rows(self.spec, window, training_innings), self.spec)
        return self._subsets[key]


def _solve(gram: np.ndarray, rhs: np.ndarray, idx: list[int]) -> np.ndarray:
    block = gram[np.ix_(idx, idx)]
    try:
        return np.linalg.solve(block, rhs[idx])
    except np.linalg.LinAlgError:                       # a redundant set: the shared check normally rejects it first
        return np.linalg.lstsq(block, rhs[idx], rcond=None)[0]


class Fitter:
    """Judges setups on the three rolling checks of one table. Build it once per run; every method reads only years before
    the year it scores."""

    def __init__(self, rolling: Rolling):
        self.rolling = rolling
        self.checks = [_Check(rolling, spec) for spec in rolling.checks]
        self.memo: dict = {}          # results that depend on nothing but the data, such as the grid search, kept per fitter

    # -- fitting and scoring ---------------------------------------------------------------------------------------

    def fit_check(self, index: int, window: str, weighting: str, training_innings: str,
                  feature_ids: list[str]) -> tuple[dict[str, float], float]:
        """Coefficients and intercept for one check, from the cached Gram matrices."""
        gram, rhs = self.checks[index].subset(window, training_innings).gram(weighting)
        beta = _solve(gram, rhs, [0] + [_COLUMN[f] for f in feature_ids])
        return {f: float(c) for f, c in zip(feature_ids, beta[1:])}, float(beta[0])

    def evaluate(self, window: str, weighting: str, training_innings: str, feature_ids: list[str]) -> dict:
        """The setup's error in each check (mean miss in runs on that year's test-population innings, and R-squared) and
        the means of the three."""
        idx = [0] + [_COLUMN[f] for f in feature_ids]
        out = []
        for check in self.checks:
            gram, rhs = check.subset(window, training_innings).gram(weighting)
            beta = _solve(gram, rhs, idx)
            predicted = check.Xv[:, idx] @ beta
            out.append({"year": check.spec.year, "mae": float(np.mean(np.abs(check.yv - predicted))),
                        "r2": float(r2_score(check.yv, predicted))})
        return {"checks": out, "mae": float(np.mean([c["mae"] for c in out])), "r2": float(np.mean([c["r2"] for c in out]))}

    # -- what a setup leaves to learn from -------------------------------------------------------------------------

    def training_sizes(self, window: str, training_innings: str) -> list[tuple[int, int]]:
        """(check year, training innings) for each check."""
        return [(c.spec.year, c.subset(window, training_innings).n) for c in self.checks]

    def too_few(self, window: str, training_innings: str) -> list[tuple[int, int]]:
        """The checks that would be left with fewer than the minimum training innings, as (year, innings)."""
        return [(y, n) for y, n in self.training_sizes(window, training_innings) if n < setup_settings.MIN_TRAIN_INNINGS]

    # -- redundancy, judged on the three checks' training rows -----------------------------------------------------

    def repeating(self, window: str, training_innings: str, feature_ids: list[str]) -> list[str]:
        """The features that take part in an exact dependency in any of the three checks' training rows (in the order
        given); empty if the set is independent in all three."""
        if not feature_ids:
            return []
        idx = [0] + [_COLUMN[f] for f in feature_ids]
        found: set[int] = set()
        for check in self.checks:
            gram, _ = check.subset(window, training_innings).gram("none")
            found.update(repeating_columns(gram[np.ix_(idx, idx)]))
        return [feature_ids[i] for i in sorted(found)]

    def redundant(self, window: str, training_innings: str, feature_ids: list[str]) -> bool:
        return bool(self.repeating(window, training_innings, feature_ids))
