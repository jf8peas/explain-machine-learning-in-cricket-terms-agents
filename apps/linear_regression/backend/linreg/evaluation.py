"""Error measures in runs. Shared-library candidate."""
from __future__ import annotations

import numpy as np


def mae(actual, predicted) -> float:
    return float(np.mean(np.abs(np.asarray(actual, dtype=float) - np.asarray(predicted, dtype=float))))


def r2(actual, predicted) -> float:
    a = np.asarray(actual, dtype=float)
    p = np.asarray(predicted, dtype=float)
    ss_res = float(np.sum((a - p) ** 2))
    ss_tot = float(np.sum((a - a.mean()) ** 2))
    return 1.0 - ss_res / ss_tot if ss_tot else 0.0


def broadcaster_projection(runs_at_10):
    """The TV projected score: current run rate x 20 overs = (runs / 10) x 20.

    Works for a single number or a pandas Series.
    """
    return runs_at_10 / 10 * 20


def know_nothing_guess(train_totals, n: int):
    """The floor any useful prediction must beat: every item is predicted to be the average of the training totals, whatever
    its own state. `train_totals` are the training years' final totals and nothing else is read; `n` is how many to predict."""
    return np.full(int(n), float(np.mean(np.asarray(train_totals, dtype=float))))
