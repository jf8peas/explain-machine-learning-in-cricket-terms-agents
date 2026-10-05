"""Three slices by calendar year: training, validation (the year before the latest) and test (the latest)."""
import pandas as pd

from linreg.season_split import Slices, split_three_ways
from tests.conftest import make_table


def frame(**kw) -> pd.DataFrame:
    df = make_table(**kw)
    df["match_date"] = pd.to_datetime(df["match_date"])
    return df


def test_the_latest_year_is_test_the_one_before_is_validation_and_earlier_years_train():
    df = frame()  # 2020 to 2023
    s = split_three_ways(df)
    assert isinstance(s, Slices)
    assert (s.test_year, s.validation_year) == (2023, 2022)
    assert set(s.test["match_date"].dt.year) == {2023}
    assert set(s.validation["match_date"].dt.year) == {2022}
    assert set(s.train["match_date"].dt.year) == {2020, 2021}


def test_the_slices_do_not_overlap_and_cover_every_row():
    df = frame()
    s = split_three_ways(df)
    ids = [set(x["match_id"]) for x in (s.train, s.validation, s.test)]
    assert not (ids[0] & ids[1]) and not (ids[0] & ids[2]) and not (ids[1] & ids[2])
    assert len(s.train) + len(s.validation) + len(s.test) == len(df)


def test_the_split_is_by_year_never_random():
    df = frame()
    a = split_three_ways(df)
    b = split_three_ways(df.sample(frac=1, random_state=3))
    for x, y in ((a.train, b.train), (a.validation, b.validation), (a.test, b.test)):
        assert sorted(x["match_id"]) == sorted(y["match_id"])


def test_a_gap_year_uses_the_latest_year_before_the_test_year():
    df = pd.concat([frame(years=(2018, 2019), per_year=10), frame(years=(2021,), per_year=10)], ignore_index=True)
    s = split_three_ways(df)
    assert (s.validation_year, s.test_year) == (2019, 2021)


def test_with_fewer_than_three_years_a_slice_is_empty():
    s = split_three_ways(frame(years=(2022, 2023), per_year=10))
    assert len(s.train) == 0 and len(s.validation) == 10 and len(s.test) == 10
    assert split_three_ways(frame(years=(2023,), per_year=10)).validation_year is None
