from pathlib import Path

import pandas as pd

from tests.conftest import make_table


def assert_stopped(events, reason_fragment=None):
    assert [n for n, _ in events] == ["load_data"]
    update = events[0][1]
    assert update["data_error"]
    assert update["decision"]["branch"] == "stop"
    if reason_fragment:
        assert reason_fragment in update["data_error"]


def test_missing_file_stops(run_graph, tmp_path):
    events = run_graph({"data_path": str(tmp_path / "nope.csv")})
    assert_stopped(events, "not found")


def test_empty_file_stops(run_graph, tmp_path):
    p = Path(tmp_path / "empty.csv")
    p.write_text("")
    assert_stopped(run_graph({"data_path": str(p)}), "empty")


def test_header_only_file_stops(run_graph, write_csv):
    df = make_table().iloc[0:0]
    assert_stopped(run_graph({"data_path": write_csv(df)}))


def test_too_few_test_innings_stops(run_graph, write_csv):
    older = make_table(years=(2020, 2021), per_year=150)
    tiny = make_table(years=(2022,), per_year=99, seed=5)
    df = pd.concat([older, tiny], ignore_index=True)
    assert_stopped(run_graph({"data_path": write_csv(df)}), "fewer than")


def test_single_year_stops(run_graph, write_csv):
    df = make_table(years=(2022,), per_year=200)
    assert_stopped(run_graph({"data_path": write_csv(df)}), "one calendar year")


def test_exactly_100_test_innings_is_ok(run_graph, write_csv):
    older = make_table(years=(2020, 2021), per_year=150)
    test = make_table(years=(2022,), per_year=100, seed=5)
    events = run_graph({"data_path": write_csv(pd.concat([older, test], ignore_index=True))})
    assert events[0][1]["decision"]["branch"] == "ok"
    assert events[-1][0] == "explain_in_cricket_terms"
