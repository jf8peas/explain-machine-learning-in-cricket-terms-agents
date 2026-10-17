"""The example innings in /api/reference (feature 013): from the data, for the configured id, or None with the rest intact."""
import logging

import pandas as pd
import pytest

from linreg import reference_api, settings
from linreg.data_loading import DEFAULT_PATH, load_innings
from linreg.overs_loading import example_innings, load_overs

OVERS_PATH = DEFAULT_PATH.with_name("overs.csv")


@pytest.fixture(scope="module")
def innings():
    return load_innings()


@pytest.fixture(scope="module")
def overs():
    return load_overs()


def training_rows(innings):
    year = innings["match_date"].dt.year
    return innings[(year < year.max() - 3) & (innings["in_test_population"] == 1)]


def variant(tmp_path, innings_df=None, overs_df=None):
    """A copy of the data in tmp_path with the tables replaced; returns the innings path."""
    (innings_df if innings_df is not None else pd.read_csv(DEFAULT_PATH)).to_csv(tmp_path / "innings.csv", index=False)
    (overs_df if overs_df is not None else pd.read_csv(OVERS_PATH, dtype={"match_id": str})).to_csv(
        tmp_path / "overs.csv", index=False)
    return tmp_path / "innings.csv"


# --- the block ----------------------------------------------------------------------------------------------------

def test_the_configured_example_is_australia_v_india_at_the_scg():
    assert settings.EXAMPLE_MATCH_ID == 1223954


def test_the_example_block_matches_the_data_for_the_configured_id(innings, overs):
    block = reference_api.build_reference()["example"]
    row = innings[innings["match_id"] == settings.EXAMPLE_MATCH_ID].iloc[0]
    mine = overs[overs["match_id"] == str(settings.EXAMPLE_MATCH_ID)].sort_values("over")
    assert block["match_id"] == str(settings.EXAMPLE_MATCH_ID)
    assert (block["batting_team"], block["bowling_team"], block["venue"]) == (
        row["batting_team"], row["bowling_team"], row["venue"])
    assert (block["batting_team"], block["bowling_team"]) == ("Australia", "India")
    assert block["date"] == "2020-12-08" and block["date_label"] == "December 2020"
    assert block["runs"] == list(mine["runs"]) and block["wickets"] == list(mine["wickets"])
    assert len(block["runs"]) == 20
    assert (block["runs_at_10"], block["wickets_at_10"], block["final_total"]) == (
        row["runs_at_10"], row["wickets_at_10"], row["final_total"])
    assert block["runs"][9] == block["runs_at_10"] and block["runs"][19] == block["final_total"]
    assert block["tv_projection"] == row["runs_at_10"] * 2
    assert block["tv_miss"] == abs(row["final_total"] - row["runs_at_10"] * 2)


def test_wicket_overs_lists_each_over_with_a_wicket_once(innings, overs):
    block = reference_api.build_reference()["example"]
    wickets = block["wickets"]
    expected = [i + 1 for i in range(20) if wickets[i] > (wickets[i - 1] if i else 0)]
    assert block["wicket_overs"] == expected
    assert len(set(expected)) == len(expected)


def test_changing_the_id_changes_the_innings(monkeypatch, innings):
    other = int(training_rows(innings).iloc[5]["match_id"])
    monkeypatch.setattr(settings, "EXAMPLE_MATCH_ID", other)
    block = reference_api.build_reference()["example"]
    assert block["match_id"] == str(other) and block["match_id"] != "1223954"
    assert block["runs"][19] == int(innings[innings["match_id"] == other].iloc[0]["final_total"])


def test_the_example_is_one_of_the_introductions_training_innings(innings):
    year = innings["match_date"].dt.year
    row = innings[innings["match_id"] == settings.EXAMPLE_MATCH_ID].iloc[0]
    assert row["match_date"].year < year.max() - 3 and row["in_test_population"] == 1


# --- faults: example None, warning logged, the rest of the response intact -----------------------------------------

def checked(path, caplog, monkeypatch=None, match_id=None):
    if match_id is not None:
        monkeypatch.setattr(settings, "EXAMPLE_MATCH_ID", match_id)
    with caplog.at_level(logging.WARNING, logger="linreg.overs"):
        body = reference_api.build_reference(path)
    assert body["example"] is None
    assert body["hero"]["caption"] is None and body["hero"]["chart_text"] is None
    assert body["figures"] and body["hero"]["panel"] and body["hero"]["footnote"] and body["average_total"]
    assert body["training"] and body["sentences"] and body["meter"]
    assert "example innings" in caplog.text
    return body


def test_an_id_that_is_not_in_the_innings_table(tmp_path, caplog, monkeypatch):
    checked(variant(tmp_path), caplog, monkeypatch, match_id=999999999)


@pytest.mark.parametrize("which", ["check_year", "test_year", "outside_population"])
def test_an_id_outside_the_introductions_years_or_population(tmp_path, caplog, monkeypatch, innings, which):
    year = innings["match_date"].dt.year
    if which == "check_year":
        pick = innings[(year == year.max() - 2) & (innings["in_test_population"] == 1)]
    elif which == "test_year":
        pick = innings[(year == year.max()) & (innings["in_test_population"] == 1)]
    else:
        pick = innings[(year < year.max() - 3) & (innings["in_test_population"] == 0)]
    match_id = int(pick.iloc[0]["match_id"])
    checked(variant(tmp_path), caplog, monkeypatch, match_id=match_id)


def test_an_id_missing_from_the_overs_file(tmp_path, caplog):
    overs = pd.read_csv(OVERS_PATH, dtype={"match_id": str})
    path = variant(tmp_path, overs_df=overs[overs["match_id"] != str(settings.EXAMPLE_MATCH_ID)])
    checked(path, caplog)


def test_no_overs_file_at_all(tmp_path, caplog):
    path = variant(tmp_path)
    (tmp_path / "overs.csv").unlink()
    checked(path, caplog)


def test_an_innings_with_fewer_than_20_overs(tmp_path, caplog):
    overs = pd.read_csv(OVERS_PATH, dtype={"match_id": str})
    short = overs[~((overs["match_id"] == str(settings.EXAMPLE_MATCH_ID)) & (overs["over"] > 18))]
    checked(variant(tmp_path, overs_df=short), caplog)


def test_totals_that_disagree_with_the_innings_table(tmp_path, caplog):
    overs = pd.read_csv(OVERS_PATH, dtype={"match_id": str})
    mine = (overs["match_id"] == str(settings.EXAMPLE_MATCH_ID)) & (overs["over"] == 10)
    overs.loc[mine, "runs"] += 1
    checked(variant(tmp_path, overs_df=overs), caplog)


def test_totals_that_go_down(tmp_path, caplog):
    overs = pd.read_csv(OVERS_PATH, dtype={"match_id": str})
    mine = (overs["match_id"] == str(settings.EXAMPLE_MATCH_ID)) & (overs["over"] == 5)
    overs.loc[mine, "runs"] = 100
    checked(variant(tmp_path, overs_df=overs), caplog)


def test_example_innings_is_pure_on_the_tables_it_is_given(innings, overs):
    train = training_rows(innings)
    first = example_innings(train, overs, 1223954)
    assert first == example_innings(train, overs, "1223954")           # the id may be text or a number
    assert example_innings(train, overs, 1) is None
