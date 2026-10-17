"""The committed per-over totals (data/overs.csv) agree with the innings table, and stay off the Data tab (feature 013)."""
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from api.index import app
from linreg.data_loading import DEFAULT_PATH, load_innings
from linreg.overs_loading import DEFAULT_OVERS_PATH, load_overs

client = TestClient(app)


@pytest.fixture(scope="module")
def tables():
    return load_innings(), load_overs()


def test_every_overs_row_belongs_to_a_known_innings(tables):
    innings, overs = tables
    assert set(overs["match_id"]) <= set(innings["match_id"].astype(str))
    assert set(innings["match_id"].astype(str)) <= set(overs["match_id"])    # and every innings has its overs


def test_cumulative_values_never_decrease_and_overs_run_from_one(tables):
    _, overs = tables
    for match_id, g in overs.groupby("match_id", sort=False):
        assert list(g["over"]) == list(range(1, len(g) + 1)), match_id
        assert g["runs"].is_monotonic_increasing and g["wickets"].is_monotonic_increasing, match_id
        assert len(g) <= 20


def test_over_10_equals_runs_and_wickets_at_10_and_over_20_equals_the_final_total(tables):
    innings, overs = tables
    ten = overs[overs["over"] == 10].set_index("match_id")
    last = overs.sort_values("over").groupby("match_id").tail(1).set_index("match_id")
    full = innings.assign(match_id=innings["match_id"].astype(str)).set_index("match_id")
    assert (ten.loc[full.index, "runs"] == full["runs_at_10"]).all()
    assert (ten.loc[full.index, "wickets"] == full["wickets_at_10"]).all()
    assert (last.loc[full.index, "runs"] == full["final_total"]).all()
    twenty = full.index.isin(overs[overs["over"] == 20]["match_id"])
    assert twenty.sum() > 0.9 * len(full)                        # most innings last the full 20 overs


def test_the_manifest_records_the_file_and_its_row_count(tables):
    import json
    _, overs = tables
    manifest = json.loads(DEFAULT_PATH.with_name("manifest.json").read_text(encoding="utf-8"))
    assert manifest["overs"] == {"file": "overs.csv", "rows": len(overs)}
    assert DEFAULT_OVERS_PATH.exists()


def test_the_data_tab_and_the_download_do_not_carry_over_level_data():
    """The Data tab (and the CSV download, which is built in the browser from the same table) is one row per innings, with
    the innings columns only: overs.csv is for the hero and later apps."""
    body = client.get("/api/data").json()
    innings = load_innings()
    assert len(body["rows"]) == len(innings)
    keys = [c["key"] for c in body["columns"]]
    assert set(keys) - {"used_for"} == set(innings.columns)
    assert not set(keys) & {"over", "runs", "wickets"}
