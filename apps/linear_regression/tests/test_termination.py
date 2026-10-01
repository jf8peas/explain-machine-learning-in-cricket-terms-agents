import pytest

from linreg.state import FEATURE_ORDER
from tests.conftest import make_table


@pytest.mark.parametrize("mode", ["exact_double", "offset", "noisy"])
def test_every_run_terminates_within_three_fits(run_graph, write_csv, mode):
    events = run_graph({"data_path": write_csv(make_table(mode=mode))})
    nodes_seen = [n for n, _ in events]
    assert nodes_seen[-1] == "explain_in_cricket_terms"
    assert nodes_seen.count("fit_model") <= len(FEATURE_ORDER)
    assert nodes_seen.count("fit_model") == nodes_seen.count("evaluate")
    assert nodes_seen.count("tune") == nodes_seen.count("fit_model") - 1


def test_worst_case_runs_all_three_fits_then_stops(run_graph, write_csv):
    events = run_graph({"data_path": write_csv(make_table(mode="exact_double"))})
    nodes_seen = [n for n, _ in events]
    assert nodes_seen.count("fit_model") == 3
    assert nodes_seen.count("tune") == 2
    final_attempts = [u for n, u in events if n == "evaluate"]
    assert len(final_attempts) == 3


def test_beating_margin_first_time_skips_tune(run_graph, write_csv):
    events = run_graph({"data_path": write_csv(make_table(mode="offset"))})
    assert "tune" not in [n for n, _ in events]
