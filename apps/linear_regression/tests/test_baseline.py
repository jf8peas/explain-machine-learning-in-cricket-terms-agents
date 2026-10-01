import pandas as pd
import pytest

from linreg.evaluation import broadcaster_projection, mae, r2
from linreg import nodes
from tests.conftest import make_table


def test_projection_is_run_rate_times_twenty_overs():
    assert broadcaster_projection(70) == 140
    assert broadcaster_projection(0) == 0
    assert list(broadcaster_projection(pd.Series([50, 80]))) == [100, 160]


def test_mae_and_r2():
    assert mae([100, 120], [110, 110]) == 10
    assert r2([1, 2, 3], [1, 2, 3]) == 1.0


def test_baseline_node_uses_test_year_only(write_csv):
    df = make_table(mode="exact_double")
    out = nodes.baseline({"data_path": write_csv(df)})
    assert out["baseline_mae"] == 0

    df2 = make_table(mode="offset")
    test = df2[df2["match_date"].str.startswith("2023")]
    expected = (test["final_total"] - test["runs_at_10"] * 2).abs().mean()
    out2 = nodes.baseline({"data_path": write_csv(df2, "b.csv")})
    assert out2["baseline_mae"] == pytest.approx(expected, abs=0.01)
