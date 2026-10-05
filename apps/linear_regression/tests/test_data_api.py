"""GET /api/data: the innings table, column definitions and manifest summary."""
import json
from pathlib import Path

import pandas as pd
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.index import app
from linreg import features
from linreg.data_api import create_router
from linreg.data_loading import DEFAULT_PATH, DataError, load_innings
from linreg.data_table import COLUMN_KEYS, build_table
from linreg.season_split import split_three_ways
from tests.conftest import make_table

client = TestClient(app)
MANIFEST = json.loads((DEFAULT_PATH.parent / "manifest.json").read_text(encoding="utf-8"))


def get_data() -> dict:
    r = client.get("/api/data")
    assert r.status_code == 200
    return r.json()


def test_rows_equal_innings_csv_plus_used_for():
    body = get_data()
    keys = [c["key"] for c in body["columns"]]
    assert keys == COLUMN_KEYS and keys[-1] == "used_for"
    csv = pd.read_csv(DEFAULT_PATH, dtype=str, keep_default_na=False)
    assert len(body["rows"]) == len(csv)
    for row, (_, src) in zip(body["rows"], csv.iterrows()):
        assert len(row) == len(keys)
        assert [str(v) for v in row[:-1]] == [src[k] for k in keys[:-1]]


def test_used_for_agrees_with_the_three_slices():
    body = get_data()
    s = split_three_ways(load_innings())
    used = {r[0]: r[-1] for r in body["rows"]}
    assert all(used[int(m)] == "test" for m in s.test["match_id"])
    assert all(used[int(m)] == "validation" for m in s.validation["match_id"])
    assert all(used[int(m)] == "training" for m in s.train["match_id"])
    counts = [r[-1] for r in body["rows"]]
    assert (counts.count("training"), counts.count("validation"), counts.count("test")) == (
        len(s.train), len(s.validation), len(s.test))


def test_latest_year_is_test_the_one_before_is_validation_and_earlier_years_are_training():
    body = get_data()
    i = COLUMN_KEYS.index("match_date")
    years = sorted({int(r[i][:4]) for r in body["rows"]})
    test_year, validation_year = years[-1], years[-2]
    for r in body["rows"]:
        year = int(r[i][:4])
        assert r[-1] == ("test" if year == test_year else "validation" if year == validation_year else "training")


def test_slice_counts_in_the_summary_equal_the_rows():
    body = get_data()
    section = next(s for s in body["summary"]["sections"] if s["title"].startswith("Slices"))
    shown = {r["label"].split(" ")[0]: int(r["value"].replace(",", "")) for r in section["rows"]}
    counts = [r[-1] for r in body["rows"]]
    assert shown == {"Training": counts.count("training"), "Validation": counts.count("validation"),
                     "Test": counts.count("test")}
    assert sum(shown.values()) == len(body["rows"])


def test_every_candidate_column_has_the_catalogue_heading_and_description():
    cols = {c["key"]: c for c in get_data()["columns"]}
    for f in features.CATALOGUE:
        assert cols[f["id"]]["label"] == f["heading"] and cols[f["id"]]["description"] == f["description"]
        assert cols[f["id"]]["type"] == "integer"
    assert [c["key"] for c in get_data()["columns"]] == features.PREPARED_COLUMNS + ["used_for"]


def test_columns_have_labels_and_filters():
    cols = {c["key"]: c for c in get_data()["columns"]}
    assert all(c["label"] and c["description"] and c["type"] for c in cols.values())
    assert cols["competition"]["labels"] == {"t20i": "T20 International", "ipl": "IPL", "bbl": "BBL"}
    assert cols["competition"]["filter"] == "select"
    assert cols["match_date"]["filter"] == "year" and cols["match_date"]["type"] == "date"
    assert cols["used_for"]["labels"] == {"training": "Training", "validation": "Validation", "test": "Test"}
    assert cols["used_for"]["filter"] == "select"
    assert cols["runs_at_10"]["label"] == "Runs at 10 overs"


def test_summary_counts_agree_everywhere():
    body = get_data()
    summary = body["summary"]
    total = MANIFEST["counts"]["total_innings"]
    assert len(body["rows"]) == total
    headline = {h["label"]: h["value"] for h in summary["headline"]}
    assert headline["Innings"] == f"{total:,}"
    # the agent's load_data step reports the same count
    from linreg.nodes import load_data
    assert load_data({}, {})["data_summary"]["innings"] == total
    per_comp = next(s for s in summary["sections"] if s["title"] == "Innings per competition")
    assert sum(int(r["value"].replace(",", "")) for r in per_comp["rows"]) == total
    assert {r["label"] for r in per_comp["rows"]} == {"T20 International", "IPL", "BBL"}


def test_exclusions_match_manifest_with_zero_counts_omitted():
    sections = {s["title"]: s["rows"] for s in get_data()["summary"]["sections"]}
    excluded = {r["label"]: int(r["value"].replace(",", "")) for r in sections["Excluded, and why"]}
    summed: dict[str, int] = {}
    for comp in MANIFEST["counts"].values():
        if isinstance(comp, dict):
            for reason, n in comp["excluded"].items():
                summed[reason] = summed.get(reason, 0) + n
    assert sorted(excluded.values()) == sorted(n for n in summed.values() if n)
    assert 0 not in excluded.values()
    assert excluded["No result"] == summed["no_result"]


def test_exclusions_say_they_were_decided_before_the_agent_runs():
    sections = {s["title"]: s for s in get_data()["summary"]["sections"]}
    note = sections["Excluded, and why"]["note"]
    assert "scripts/prepare_data.py" in note and "before the agent runs" in note
    assert (DEFAULT_PATH.parent.parent / "scripts" / "prepare_data.py").exists()  # the script it names is real


def test_summary_dates_and_file_name_parts():
    summary = get_data()["summary"]
    assert summary["file_date"] == MANIFEST["download_date"]
    assert summary["file_stem"] == "t20-first-innings"
    assert summary["attribution"] == MANIFEST["attribution"]
    headline = {h["label"]: h["value"] for h in summary["headline"]}
    assert "Downloaded from Cricsheet" in headline and "Dates" in headline


def test_cache_header_set():
    assert "s-maxage" in client.get("/api/data").headers["cache-control"]


def test_tricky_venue_values_survive_json(tmp_path):
    csv = tmp_path / "innings.csv"
    manifest = tmp_path / "manifest.json"
    table = make_table(years=(2022, 2023, 2024), per_year=1)  # one row a year, every candidate column
    table["venue"] = ['Ground, "North" End', "Köln Ground", "Plain Ground"]
    table["competition"] = "ipl"
    features.add_derived(table).to_csv(csv, index=False)
    manifest.write_text(json.dumps({**MANIFEST, "counts": {**MANIFEST["counts"], "total_innings": 2}}), encoding="utf-8")
    test_app = FastAPI()
    test_app.include_router(create_router(lambda: build_table(csv, manifest)), prefix="/api")
    body = TestClient(test_app).get("/api/data").json()
    venues = [r[COLUMN_KEYS.index("venue")] for r in body["rows"]]
    assert venues == ['Ground, "North" End', "Köln Ground", "Plain Ground"]


def test_missing_data_file_returns_500_with_message(tmp_path):
    test_app = FastAPI()
    test_app.include_router(create_router(lambda: build_table(tmp_path / "nope.csv")), prefix="/api")
    r = TestClient(test_app).get("/api/data")
    assert r.status_code == 500
    assert "not found" in r.json()["detail"]


def test_data_error_type_is_reused():
    assert issubclass(DataError, Exception) and Path(DEFAULT_PATH).exists()


# --- competition dummy columns (feature 003) ---

def test_dummy_columns_follow_competition_in_the_column_list_and_every_row():
    body = get_data()
    keys = [c["key"] for c in body["columns"]]
    i = keys.index("competition")
    assert keys[i + 1:i + 3] == ["is_ipl", "is_bbl"]
    assert keys[i + 3] == "venue"
    for row in body["rows"]:
        assert len(row) == len(keys)


def test_dummy_column_definitions():
    cols = {c["key"]: c for c in get_data()["columns"]}
    for key, label in (("is_ipl", "IPL (0/1)"), ("is_bbl", "BBL (0/1)")):
        assert cols[key]["label"] == label
        assert cols[key]["type"] == "integer"
        assert cols[key]["filter"] == "select"
        assert cols[key]["description"]
    assert cols["is_ipl"]["description"] != cols["is_bbl"]["description"]


def test_every_row_dummies_agree_with_competition_in_the_response():
    body = get_data()
    keys = [c["key"] for c in body["columns"]]
    c, a, b = (keys.index(k) for k in ("competition", "is_ipl", "is_bbl"))
    expected = {"ipl": (1, 0), "bbl": (0, 1), "t20i": (0, 0)}
    assert all((r[a], r[b]) == expected[r[c]] for r in body["rows"])


def test_dummy_counts_equal_the_summary_counts_the_visitor_sees():
    body = get_data()
    keys = [c["key"] for c in body["columns"]]
    a, b = keys.index("is_ipl"), keys.index("is_bbl")
    section = next(s for s in body["summary"]["sections"] if s["title"] == "Innings per competition")
    shown = {r["label"]: int(r["value"].replace(",", "")) for r in section["rows"]}
    assert sum(r[a] for r in body["rows"]) == shown["IPL"]
    assert sum(r[b] for r in body["rows"]) == shown["BBL"]
    assert sum(1 for r in body["rows"] if r[a] == 0 and r[b] == 0) == shown["T20 International"]


def _api_for(csv_path, manifest_path):
    test_app = FastAPI()
    test_app.include_router(create_router(lambda: build_table(csv_path, manifest_path)), prefix="/api")
    return TestClient(test_app)


def test_a_file_with_wrong_dummies_returns_500_with_the_count(tmp_path):
    df = pd.read_csv(DEFAULT_PATH)
    df.loc[df.index[df["competition"] == "ipl"][:2], "is_ipl"] = 0
    path = tmp_path / "innings.csv"
    df.to_csv(path, index=False)
    r = _api_for(path, DEFAULT_PATH.parent / "manifest.json").get("/api/data")
    assert r.status_code == 500
    assert "2 rows have" in r.json()["detail"]


def test_an_older_file_without_the_dummies_returns_500_naming_the_missing_columns(tmp_path):
    df = pd.read_csv(DEFAULT_PATH).drop(columns=["is_ipl", "is_bbl"])
    path = tmp_path / "innings.csv"
    df.to_csv(path, index=False)
    r = _api_for(path, DEFAULT_PATH.parent / "manifest.json").get("/api/data")
    assert r.status_code == 500
    assert "missing columns" in r.json()["detail"] and "is_ipl" in r.json()["detail"]
