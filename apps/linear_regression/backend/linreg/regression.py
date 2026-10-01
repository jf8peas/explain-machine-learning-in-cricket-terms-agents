"""Linear regression fit/predict (app-specific)."""
from __future__ import annotations

import pandas as pd
from sklearn.linear_model import LinearRegression


def fit(train: pd.DataFrame, features: list[str], target: str = "final_total") -> dict:
    model = LinearRegression().fit(train[features], train[target])
    iqr = {f: float(train[f].quantile(0.75) - train[f].quantile(0.25)) for f in features}
    return {
        "coefficients": {f: float(c) for f, c in zip(features, model.coef_)},
        "intercept": float(model.intercept_),
        "feature_iqr": iqr,
    }


def predict(df: pd.DataFrame, coefficients: dict[str, float], intercept: float) -> pd.Series:
    out = pd.Series(intercept, index=df.index, dtype=float)
    for f, c in coefficients.items():
        out = out + df[f].astype(float) * c
    return out
