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


def repeating_features_svd(train: pd.DataFrame, columns: list[str]) -> list[str]:
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





# --- the same judgement from a Gram block (feature 008) -------------------------------------------------------------
# The search judges thousands of sets, so it cannot take an SVD of the rows each time. The block is Xt X for the intercept
# and the columns in question (intercept first): from it the columns are standardised to a correlation matrix, and the
# set is redundant when that matrix has a (numerically) zero eigenvalue. One tolerance serves the proposal check and the
# grid search, so they can never disagree.

GRAM_TOLERANCE = 1e-10


def _correlation(block: np.ndarray) -> np.ndarray:
    n = block[0, 0]
    mean = block[0, 1:] / n
    cov = block[1:, 1:] / n - np.outer(mean, mean)
    var = np.diag(cov).copy()
    constant = var <= 1e-12 * (mean ** 2 + 1.0)          # a constant column repeats the intercept
    std = np.sqrt(np.where(constant, 1.0, np.maximum(var, 0.0)))
    cov[constant, :] = 0.0
    cov[:, constant] = 0.0
    return cov / np.outer(std, std)


def _nullity(corr: np.ndarray) -> int:
    if corr.shape[0] == 0:
        return 0
    eig = np.linalg.eigvalsh(corr)
    top = float(eig[-1])
    return int((eig <= GRAM_TOLERANCE * top).sum()) if top > 0 else int(corr.shape[0])


def repeating_columns(block: np.ndarray) -> list[int]:
    """The positions (0-based, among the columns after the intercept) that take part in an exact dependency; empty if the
    set is independent. A column is reported if removing it does not lower the rank."""
    corr = _correlation(block)
    nullity = _nullity(corr)
    if nullity == 0:
        return []
    k = corr.shape[0]
    return [i for i in range(k)
            if _nullity(np.delete(np.delete(corr, i, axis=0), i, axis=1)) == nullity - 1]


def redundant_columns(block: np.ndarray) -> bool:
    return bool(repeating_columns(block))


def gram_block(train: pd.DataFrame, columns: list[str]) -> np.ndarray:
    """Xt X for the intercept and the given columns of a table."""
    design = np.column_stack([np.ones(len(train))] + [train[c].to_numpy(dtype=float) for c in columns])
    return design.T @ design


def repeating_features(train: pd.DataFrame, columns: list[str]) -> list[str]:
    """The features that take part in an exact dependency (in the order given); empty if the set is independent."""
    if not columns:
        return []
    return [columns[i] for i in repeating_columns(gram_block(train, columns))]


def is_redundant(train: pd.DataFrame, columns: list[str]) -> bool:
    return bool(repeating_features(train, columns))
