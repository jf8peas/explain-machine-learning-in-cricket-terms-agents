"""Linear regression fit/predict (app-specific).

Ordinary least squares with an intercept, solved with numpy. This gives the same
coefficients as scikit-learn's LinearRegression (a test checks that) without
shipping scikit-learn and scipy, which would put the deployed function over
Vercel's size limit.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def fit(train: pd.DataFrame, features: list[str], target: str = "final_total") -> dict:
    X = train[features].to_numpy(dtype=float)
    y = train[target].to_numpy(dtype=float)
    design = np.column_stack([np.ones(len(X)), X])
    beta, *_ = np.linalg.lstsq(design, y, rcond=None)
    iqr = {f: float(train[f].quantile(0.75) - train[f].quantile(0.25)) for f in features}
    return {
        "coefficients": {f: float(c) for f, c in zip(features, beta[1:])},
        "intercept": float(beta[0]),
        "feature_iqr": iqr,
    }


def predict(df: pd.DataFrame, coefficients: dict[str, float], intercept: float) -> pd.Series:
    out = pd.Series(intercept, index=df.index, dtype=float)
    for f, c in coefficients.items():
        out = out + df[f].astype(float) * c
    return out
