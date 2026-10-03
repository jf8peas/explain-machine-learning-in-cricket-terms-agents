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


# --- competition dummy columns (feature 003) ---

def test_older_file_without_the_dummy_columns_stops(run_graph, write_csv):
    older = make_table().drop(columns=["is_ipl", "is_bbl"])
    events = run_graph({"data_path": write_csv(older)})
    assert_stopped(events, "missing columns")
    assert "is_ipl" in events[0][1]["data_error"] and "is_bbl" in events[0][1]["data_error"]
    assert "stops here" in events[0][1]["summary"]


def _ipl_row(df):  # first row whose competition is ipl
    return int(df.index[df["competition"] == "ipl"][0])


def test_a_dummy_that_disagrees_with_competition_stops_with_the_count(run_graph, write_csv):
    df = make_table()
    df.loc[_ipl_row(df), "is_ipl"] = 0
    events = run_graph({"data_path": write_csv(df)})
    assert_stopped(events, "1 row has")


def test_a_row_with_both_dummies_set_stops_with_the_count(run_graph, write_csv):
    df = make_table()
    i = int(df.index[df["competition"] == "bbl"][0])
    df.loc[i, ["is_ipl", "is_bbl"]] = 1
    assert_stopped(run_graph({"data_path": write_csv(df)}), "1 row has")


def test_a_dummy_value_other_than_0_or_1_stops_with_the_count(run_graph, write_csv):
    df = make_table()
    df.loc[_ipl_row(df), "is_ipl"] = 2
    assert_stopped(run_graph({"data_path": write_csv(df)}), "1 row has")


def test_several_wrong_rows_are_counted_once_each(run_graph, write_csv):
    df = make_table()
    ipl = df.index[df["competition"] == "ipl"][:3]
    df.loc[ipl, "is_ipl"] = 0
    df.loc[ipl[0], "is_bbl"] = 5  # a second problem in the same row still counts that row once
    assert_stopped(run_graph({"data_path": write_csv(df)}), "3 rows have")


def test_good_dummies_run_normally(run_graph, write_csv):
    events = run_graph({"data_path": write_csv(make_table())})
    assert events[0][1]["decision"]["branch"] == "ok"
