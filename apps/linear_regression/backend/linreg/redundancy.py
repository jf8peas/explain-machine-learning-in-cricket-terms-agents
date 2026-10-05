"""Numerical redundancy check for a feature set. App-specific.

A set is redundant if its columns plus the intercept are not linearly independent on the training data: some
column can be built exactly from the others, so a straight-line fit has no single answer (the coefficients are
arbitrary). This is detected from the numbers, not from a hand-written list.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

RELATIVE_TOLERANCE = 1e-9


def _design(train: pd.DataFrame, columns: list[str]) -> np.ndarray:
    """The intercept column plus each feature, standardised so the tolerance does not depend on units."""
    n = len(train)
    parts = [np.ones(n)]
    for c in columns:
        x = train[c].to_numpy(dtype=float)
        spread = x.std()
        parts.append((x - x.mean()) / spread if spread > 0 else np.zeros(n))  # a constant column becomes all zeros
    return np.column_stack(parts)


def _rank(matrix: np.ndarray) -> int:
    if matrix.shape[1] == 0:
        return 0
    s = np.linalg.svd(matrix, compute_uv=False)
    return int((s > RELATIVE_TOLERANCE * s[0]).sum())


def repeating_features(train: pd.DataFrame, columns: list[str]) -> list[str]:
    """The features that take part in an exact dependency (in the order given); empty if the set is independent.

    A feature is reported if removing it does not lower the rank, which holds exactly for the features that can be
    built from the others (and for a constant column, which repeats the intercept).
    """
    if not columns:
        return []
    full = _design(train, columns)
    rank = _rank(full)
    if rank == full.shape[1]:
        return []
    return [c for i, c in enumerate(columns) if _rank(np.delete(full, i + 1, axis=1)) == rank]


def is_redundant(train: pd.DataFrame, columns: list[str]) -> bool:
    return bool(repeating_features(train, columns))
