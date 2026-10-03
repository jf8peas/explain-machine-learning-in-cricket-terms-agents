"""GET /api/data: the innings table, column definitions and manifest summary."""
import json
from pathlib import Path

import pandas as pd
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.index import app
from linreg.data_api import create_router
from linreg.data_loading import DEFAULT_PATH, DataError, load_innings
from linreg.data_table import COLUMN_KEYS, build_table
from linreg.season_split import split_by_year

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


def test_used_for_agrees_with_season_split():
    body = get_data()
    df = load_innings()
    train, test, _ = split_by_year(df)
    used = {r[0]: r[-1] for r in body["rows"]}
    assert all(used[int(m)] == "test" for m in test["match_id"])
    assert all(used[int(m)] == "training" for m in train["match_id"])
    counts = [r[-1] for r in body["rows"]]
    assert counts.count("test") == len(test) and counts.count("training") == len(train)


def test_latest_calendar_year_is_test_and_earlier_is_training():
    body = get_data()
    i = COLUMN_KEYS.index("match_date")
    latest = max(r[i][:4] for r in body["rows"])
    for r in body["rows"]:
        assert r[-1] == ("test" if r[i][:4] == latest else "training")


def test_columns_have_labels_and_filters():
    cols = {c["key"]: c for c in get_data()["columns"]}
    assert all(c["label"] and c["description"] and c["type"] for c in cols.values())
    assert cols["competition"]["labels"] == {"t20i": "T20 International", "ipl": "IPL", "bbl": "BBL"}
    assert cols["competition"]["filter"] == "select"
    assert cols["match_date"]["filter"] == "year" and cols["match_date"]["type"] == "date"
    assert cols["used_for"]["labels"] == {"training": "Training", "test": "Test"}
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
    assert load_data({})["data_summary"]["innings"] == total
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
    pd.DataFrame([
        {"match_id": 1, "match_date": "2023-04-01", "season": "2023", "competition": "ipl",
         "venue": 'Ground, "North" End', "runs_at_10": 70, "wickets_at_10": 1, "powerplay_runs": 50, "final_total": 170},
        {"match_id": 2, "match_date": "2024-04-01", "season": "2024", "competition": "ipl",
         "venue": "Köln Ground", "runs_at_10": 80, "wickets_at_10": 2, "powerplay_runs": 55, "final_total": 180},
    ]).to_csv(csv, index=False)
    manifest.write_text(json.dumps({**MANIFEST, "counts": {**MANIFEST["counts"], "total_innings": 2}}), encoding="utf-8")
    test_app = FastAPI()
    test_app.include_router(create_router(lambda: build_table(csv, manifest)), prefix="/api")
    body = TestClient(test_app).get("/api/data").json()
    venues = [r[COLUMN_KEYS.index("venue")] for r in body["rows"]]
    assert venues == ['Ground, "North" End', "Köln Ground"]


def test_missing_data_file_returns_500_with_message(tmp_path):
    test_app = FastAPI()
    test_app.include_router(create_router(lambda: build_table(tmp_path / "nope.csv")), prefix="/api")
    r = TestClient(test_app).get("/api/data")
    assert r.status_code == 500
    assert "not found" in r.json()["detail"]


def test_data_error_type_is_reused():
    assert issubclass(DataError, Exception) and Path(DEFAULT_PATH).exists()
