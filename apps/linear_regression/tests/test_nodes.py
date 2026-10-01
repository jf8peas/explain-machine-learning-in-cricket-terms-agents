import pytest

from linreg import nodes
from linreg.state import FEATURE_ORDER
from tests.conftest import make_table


@pytest.fixture
def path(write_csv):
    return write_csv(make_table())


def test_load_data_reports_counts(path):
    out = nodes.load_data({"data_path": path})
    s = out["data_summary"]
    assert s["innings"] == 600 and s["seasons"] == 4
    assert s["competitions"] == ["bbl", "ipl", "t20i"]
    assert out["data_error"] is None and out["decision"]["branch"] == "ok"
    assert "600" in out["summary"]


def test_explore_reports_relationship_wickets_and_competitions(path):
    out = nodes.explore({"data_path": path})["explore"]
    assert 0.5 < out["corr_runs_final"] <= 1
    assert out["by_wickets"]
    assert set(out["mean_total_by_competition"]) == {"bbl", "ipl", "t20i"}


def test_split_reports_sizes_and_year(path):
    out = nodes.split({"data_path": path})["split"]
    assert out == {"train_n": 450, "test_n": 150, "test_year": 2023, "train_years": [2020, 2022]}


def test_fit_model_uses_only_current_features(path):
    out = nodes.fit_model({"data_path": path, "features": ["runs_at_10", "wickets_at_10"]})
    assert set(out["coefficients"]) == {"runs_at_10", "wickets_at_10"}
    assert out["features"] == ["runs_at_10", "wickets_at_10"]
    assert set(out["coefficients"]) <= set(FEATURE_ORDER)


def test_fit_model_starts_with_runs_only(path):
    out = nodes.fit_model({"data_path": path})
    assert list(out["coefficients"]) == ["runs_at_10"]


def test_evaluate_writes_mae_and_r2_on_test_year(path):
    state = {"data_path": path, "baseline_mae": 20.0}
    state.update(nodes.fit_model(state))
    out = nodes.evaluate(state)
    assert out["model_mae"] > 0 and -1 <= out["r2"] <= 1
    assert len(out["attempts"]) == 1 and out["attempts"][0]["features"] == ["runs_at_10"]


def test_tune_adds_next_feature_in_fixed_order():
    assert nodes.tune({"features": ["runs_at_10"]})["features"] == ["runs_at_10", "wickets_at_10"]
    assert nodes.tune({"features": ["runs_at_10", "wickets_at_10"]})["features"] == FEATURE_ORDER
