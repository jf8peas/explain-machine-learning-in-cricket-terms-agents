from linreg.season_split import split_by_year
from tests.conftest import make_table
import pandas as pd


def test_test_set_is_latest_year_and_no_overlap():
    df = make_table()
    df["match_date"] = pd.to_datetime(df["match_date"])
    train, test, year = split_by_year(df)
    assert year == 2023
    assert set(test["match_date"].dt.year) == {2023}
    assert train["match_date"].dt.year.max() < 2023
    assert not set(train["match_id"]) & set(test["match_id"])
    assert len(train) + len(test) == len(df)


def test_split_is_deterministic_not_random():
    df = make_table()
    df["match_date"] = pd.to_datetime(df["match_date"])
    a = split_by_year(df)[1]["match_id"].tolist()
    b = split_by_year(df.sample(frac=1, random_state=3))[1]["match_id"].sort_values().tolist()
    assert sorted(a) == sorted(b)
