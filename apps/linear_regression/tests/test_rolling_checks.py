"""The three rolling validation checks and the test slice (feature 008)."""
import pandas as pd
import pytest

from linreg import setup_settings as cfg
from linreg.data_loading import DEFAULT_PATH, DataError, load_innings
from linreg.season_split import CheckSpec, Rolling, age, rolling_checks, years_for


def table(years, per_year=150, population_share=1.0, competition="ipl"):
    """One row per innings: `per_year` rows a year, the first `population_share` of them in the test population."""
    rows = []
    n = 0
    for y in years:
        for i in range(per_year):
            n += 1
            rows.append({"match_id": str(n), "match_date": pd.Timestamp(f"{y}-06-{1 + i % 27:02d}"),
                         "competition": competition, "final_total": 150 + i % 40, "runs_at_10": 70 + i % 20,
                         "in_test_population": int(i < per_year * population_share), "year_marker": y})
    return pd.DataFrame(rows)


YEARS = range(2018, 2027)                       # test year 2026, checks 2023 to 2025, earlier years 2018 to 2022


def test_the_checks_are_the_three_years_before_the_test_year_each_with_only_earlier_years():
    r = rolling_checks(table(YEARS))
    assert r.test_year == 2026
    assert [c.year for c in r.checks] == [2023, 2024, 2025]
    assert [c.label for c in r.checks] == ["2023", "2024", "2025"]
    for c in r.checks:
        assert c.earlier_years == tuple(y for y in YEARS if y < c.year)
        assert c.year not in c.earlier_years and all(y < c.year for y in c.earlier_years)


@pytest.mark.parametrize("test_year", [2024, 2026, 2031])
def test_the_check_years_follow_the_latest_year_in_the_data(test_year):
    r = rolling_checks(table(range(test_year - 8, test_year + 1)))
    assert r.test_year == test_year
    assert [c.year for c in r.checks] == [test_year - 3, test_year - 2, test_year - 1]


def test_the_test_slice_is_only_the_test_years_population_innings_and_no_check_reads_a_test_row():
    df = table(YEARS, population_share=0.8)
    r = rolling_checks(df)
    test = r.test_rows()
    assert set(test["year_marker"]) == {2026} and set(test["in_test_population"]) == {1} and len(test) == 120
    for c in r.checks:
        rows = r.check_rows(c)
        assert set(rows["year_marker"]) == {c.year} and set(rows["in_test_population"]) == {1}
        for window in cfg.WINDOW_IDS:
            for innings in cfg.TRAINING_INNINGS_IDS:
                assert 2026 not in set(r.training_rows(c, window, innings)["year_marker"])


def test_training_rows_apply_the_window_and_the_training_innings_relative_to_the_check_year():
    df = table(YEARS, per_year=200, population_share=0.5)
    r = rolling_checks(df)
    c = r.checks[2]                                          # check year 2025
    all_years = r.training_rows(c, "all", "all")
    assert set(all_years["year_marker"]) == set(range(2018, 2025))
    assert len(all_years) == 7 * 200
    last3 = r.training_rows(c, "last_3", "all")
    assert set(last3["year_marker"]) == {2022, 2023, 2024}                       # the 3 years before 2025
    last5_population = r.training_rows(c, "last_5", "population")
    assert set(last5_population["year_marker"]) == set(range(2020, 2025))
    assert set(last5_population["in_test_population"]) == {1} and len(last5_population) == 5 * 100
    earliest = r.training_rows(r.checks[0], "last_10", "all")                      # the window reaches past the data
    assert set(earliest["year_marker"]) == set(range(2018, 2023))


def test_years_for_and_age():
    c = CheckSpec(year=2025, label="2025", earlier_years=tuple(range(2018, 2025)))
    assert years_for(c, "all") == tuple(range(2018, 2025))
    assert years_for(c, "last_5") == (2020, 2021, 2022, 2023, 2024)
    assert years_for(c, "last_3") == (2022, 2023, 2024)
    assert years_for(c, "last_10") == tuple(range(2018, 2025))
    assert age(2024, 2025) == 1 and age(2018, 2025) == 7


def test_the_final_spec_uses_every_year_before_the_test_year():
    r = rolling_checks(table(YEARS))
    assert r.final.year == 2026 and r.final.earlier_years == tuple(range(2018, 2026))
    assert set(r.training_rows(r.final, "last_5", "population")["year_marker"]) == set(range(2021, 2026))


def test_the_counts_are_test_population_innings():
    r = rolling_checks(table(YEARS, population_share=0.8))
    assert r.n_test == 120 and r.n_check == {2023: 120, 2024: 120, 2025: 120}


# --- the data errors -----------------------------------------------------------------------------------------------

def test_a_check_year_with_too_few_population_innings_is_a_data_error():
    df = table(YEARS)
    keep = ~((df["year_marker"] == 2024) & (df.index % 150 >= 60))                # 60 innings left in 2024
    with pytest.raises(DataError, match=r"60.*2024.*100"):
        rolling_checks(df[keep].reset_index(drop=True))


def test_the_test_year_with_too_few_population_innings_is_a_data_error():
    df = table(YEARS)
    keep = ~((df["year_marker"] == 2026) & (df.index % 150 >= 60))
    with pytest.raises(DataError, match=r"60.*2026.*100"):
        rolling_checks(df[keep].reset_index(drop=True))


def test_associate_innings_do_not_count_towards_a_checks_minimum():
    with pytest.raises(DataError, match=r"\b75\b"):
        rolling_checks(table(YEARS, population_share=0.5))                          # 75 population innings a year


def test_no_earlier_year_with_enough_innings_is_a_data_error():
    df = table(range(2023, 2027), per_year=150)                                      # check years but nothing before
    with pytest.raises(DataError, match=r"(?i)earlier|before"):
        rolling_checks(df)
    thin = table(YEARS)
    thin = thin[(thin["year_marker"] >= 2023) | (thin.index % 150 < 20)]            # 20 a year before 2023
    with pytest.raises(DataError, match=r"(?i)earlier|before"):
        rolling_checks(thin.reset_index(drop=True))


def test_too_few_calendar_years_is_a_data_error_that_says_how_many_are_needed():
    with pytest.raises(DataError, match=r"(?i)only (two|three|one|four) calendar year"):
        rolling_checks(table(range(2024, 2027)))


def test_a_table_without_the_population_column_is_a_data_error():
    with pytest.raises(DataError, match="in_test_population"):
        rolling_checks(table(YEARS).drop(columns=["in_test_population"]))


def test_the_committed_data_gives_the_documented_years_and_counts():
    r = rolling_checks(load_innings(DEFAULT_PATH))
    assert r.test_year >= 2026 and [c.year for c in r.checks] == [r.test_year - 3, r.test_year - 2, r.test_year - 1]
    assert all(n >= cfg.MIN_CHECK_INNINGS for n in r.n_check.values()) and r.n_test >= cfg.MIN_CHECK_INNINGS


def test_the_returned_object_is_a_rolling():
    assert isinstance(rolling_checks(table(YEARS)), Rolling)
