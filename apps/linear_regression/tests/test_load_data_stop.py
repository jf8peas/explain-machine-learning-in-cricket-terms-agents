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


def years_table(counts: dict[int, int], seed=5):
    """One synthetic table with the given number of innings in each year."""
    return pd.concat([make_table(years=(y,), per_year=n, seed=seed + i) for i, (y, n) in enumerate(counts.items())],
                     ignore_index=True)


FULL = {y: 150 for y in (2019, 2020, 2021, 2022, 2023, 2024)}                    # 2019 to 2024, so a test year of 2025 gives checks 2022 to 2024


def test_too_few_test_innings_stops(run_graph, write_csv):
    df = years_table({**FULL, 2025: 99})
    events = run_graph({"data_path": write_csv(df)})
    assert_stopped(events, "2025")
    assert "fewer than" in events[0][1]["data_error"] and "test the model" in events[0][1]["data_error"]


def test_single_year_stops(run_graph, write_csv):
    df = make_table(years=(2022,), per_year=200)
    assert_stopped(run_graph({"data_path": write_csv(df)}), "one calendar year")


def test_exactly_100_test_innings_is_ok(run_graph, write_csv):
    df = years_table({**FULL, 2025: 100})
    events = run_graph({"data_path": write_csv(df)})
    assert events[0][1]["decision"]["branch"] == "ok"
    assert events[-1][0] == "write_in_cricket_terms"


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


# --- three slices and the candidate columns (feature 004) ---

def test_too_few_innings_in_a_check_year_stops_and_names_the_year(run_graph, write_csv):
    for thin_year in (2022, 2023, 2024):
        df = years_table({**FULL, thin_year: 99, 2025: 150})
        events = run_graph({"data_path": write_csv(df)})
        assert_stopped(events, str(thin_year))
        assert "fewer than" in events[0][1]["data_error"] and "validate" in events[0][1]["data_error"]


def test_associate_innings_do_not_count_towards_a_check_years_minimum(run_graph, write_csv):
    df = years_table({**FULL, 2025: 150})
    in_2024 = pd.to_datetime(df["match_date"]).dt.year == 2024
    df.loc[df.index[in_2024][:80], "in_test_population"] = 0          # 70 population innings left in 2024
    df.loc[df.index[in_2024][:80], ["batting_full_member", "bowling_full_member", "both_full_members"]] = 0
    df.loc[df.index[in_2024][:80], "competition"] = "t20i"
    df.loc[df.index[in_2024][:80], ["is_ipl", "is_bbl"]] = 0
    assert_stopped(run_graph({"data_path": write_csv(df)}), "2024")


def test_too_little_to_learn_from_before_the_first_check_stops(run_graph, write_csv):
    df = years_table({2021: 20, 2022: 150, 2023: 150, 2024: 150, 2025: 150})
    events = run_graph({"data_path": write_csv(df)})
    assert_stopped(events, "before 2022")
    assert "learn from" in events[0][1]["data_error"]


def test_a_population_column_that_disagrees_with_the_flags_stops(run_graph, write_csv):
    df = make_table()
    df.loc[0, "in_test_population"] = 0
    assert_stopped(run_graph({"data_path": write_csv(df)}), "in_test_population")


def test_two_calendar_years_are_not_enough(run_graph, write_csv):
    assert_stopped(run_graph({"data_path": write_csv(make_table(years=(2022, 2023), per_year=200))}), "two calendar years")


def test_a_file_missing_a_new_column_stops(run_graph, write_csv):
    df = make_table().drop(columns=["powerplay_wickets", "fours_at_10"])
    events = run_graph({"data_path": write_csv(df)})
    assert_stopped(events, "missing columns")
    assert "powerplay_wickets" in events[0][1]["data_error"] and "fours_at_10" in events[0][1]["data_error"]


def test_a_wrong_derived_column_stops_with_the_count(run_graph, write_csv):
    df = make_table()
    df.loc[[0, 1], "wickets_in_hand"] = 99
    assert_stopped(run_graph({"data_path": write_csv(df)}), "2 rows have a wickets_in_hand value")


def test_a_blank_candidate_value_stops_naming_the_column_and_the_count(run_graph, write_csv):
    df = make_table()
    df["fours_at_10"] = df["fours_at_10"].astype(float)
    df.loc[[3, 4, 5], "fours_at_10"] = None
    assert_stopped(run_graph({"data_path": write_csv(df)}), "3 rows have a blank or non-numeric value in fours_at_10")
