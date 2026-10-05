"""The numpy least-squares fit must match scikit-learn's LinearRegression (a test-only dependency)."""
import numpy as np
import pytest
from sklearn.linear_model import LinearRegression

from linreg import regression

FEATURE_ORDER = ["runs_at_10", "wickets_at_10", "powerplay_runs"]  # three independent measurements, in a fixed order
from tests.conftest import make_table


@pytest.mark.parametrize("n_features", [1, 2, 3])
def test_matches_scikit_learn(n_features):
    df = make_table(seed=7)
    feats = FEATURE_ORDER[:n_features]
    ours = regression.fit(df, feats)
    ref = LinearRegression().fit(df[feats], df["final_total"])
    assert ours["intercept"] == pytest.approx(ref.intercept_, rel=1e-6, abs=1e-6)
    for f, c in zip(feats, ref.coef_):
        assert ours["coefficients"][f] == pytest.approx(c, rel=1e-6, abs=1e-6)


def test_predictions_match_scikit_learn():
    df = make_table(seed=3)
    feats = FEATURE_ORDER
    ours = regression.fit(df, feats)
    ref = LinearRegression().fit(df[feats], df["final_total"])
    got = regression.predict(df, ours["coefficients"], ours["intercept"])
    assert np.allclose(got, ref.predict(df[feats]))


def test_recovers_an_exact_line():
    df = make_table(mode="offset")  # final = runs + 80
    out = regression.fit(df, ["runs_at_10"])
    assert out["coefficients"]["runs_at_10"] == pytest.approx(1.0)
    assert out["intercept"] == pytest.approx(80.0)
