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
from linreg.population import population_counts
from linreg.season_split import rolling_checks
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


def year_of(row):
    return int(row[COLUMN_KEYS.index("match_date")][:4])


def test_used_for_agrees_with_the_rolling_checks():
    body = get_data()
    rolling = rolling_checks(load_innings())
    check_years = {c.year for c in rolling.checks}
    used = {r[0]: r[-1] for r in body["rows"]}
    df = load_innings()
    years = df["match_date"].dt.year
    for match_id, year in zip(df["match_id"], years):
        want = "test" if year == rolling.test_year else "training_validation" if year in check_years else "training"
        assert used[int(match_id)] == want, (match_id, year)


def test_the_latest_year_is_test_the_three_before_it_are_training_and_validation_and_earlier_years_are_training():
    body = get_data()
    years = sorted({year_of(r) for r in body["rows"]})
    test_year = years[-1]
    for r in body["rows"]:
        year = year_of(r)
        assert r[-1] == ("test" if year == test_year else "training_validation" if test_year - 3 <= year < test_year else "training")


def test_the_years_summary_counts_equal_the_rows():
    body = get_data()
    section = next(s for s in body["summary"]["sections"] if s["title"] == "How the years are used")
    shown = [int(r["value"].replace(",", "")) for r in section["rows"]]
    counts = [r[-1] for r in body["rows"]]
    assert shown == [counts.count("training"), counts.count("training_validation"), counts.count("test")]
    assert sum(shown) == len(body["rows"])
    labels = " ".join(r["label"] for r in section["rows"])
    rolling = rolling_checks(load_innings())
    assert f"Test ({rolling.test_year})" in labels
    assert f"{rolling.checks[0].year}, {rolling.checks[1].year} and {rolling.checks[2].year}" in labels


def test_the_population_section_equals_the_data_and_the_manifest():
    body = get_data()
    section = next(s for s in body["summary"]["sections"] if s["title"] == "Test population")
    counts = population_counts(load_innings())
    values = {r["label"]: int(r["value"].replace(",", "")) for r in section["rows"][:2]}
    per_competition = {r["label"]: r["value"] for r in section["rows"][2:]}
    assert per_competition["T20 International: in the population"] == (
        f"{counts['by_competition']['t20i']['in']:,} of "
        f"{counts['by_competition']['t20i']['in'] + counts['by_competition']['t20i']['out']:,}")
    assert values["In the test population"] == counts["in"] == MANIFEST["population"]["in"]
    assert values["Outside it"] == counts["out"] == MANIFEST["population"]["out"]
    in_rows = sum(1 for r in body["rows"] if r[COLUMN_KEYS.index("in_test_population")] == 1)
    assert in_rows == counts["in"]
    assert "ICC full members" in section["note"]


def test_the_new_columns_are_there_with_descriptions_and_filters():
    cols = {c["key"]: c for c in get_data()["columns"]}
    for key in ("batting_team", "bowling_team", "batting_full_member", "bowling_full_member", "both_full_members",
                "in_test_population"):
        assert cols[key]["label"] and len(cols[key]["description"]) > 20, key
    assert cols["in_test_population"]["filter"] == "select" and cols["in_test_population"]["labels"] == {"1": "In", "0": "Out"}
    assert cols["batting_full_member"]["filter"] == "select"
    order = [c["key"] for c in get_data()["columns"]]
    assert order.index("in_test_population") == len(order) - 3 and order[-1] == "used_for" and order[-2] == "final_total"


def test_every_row_has_its_teams_and_flags_and_the_flags_agree_with_the_population():
    body = get_data()
    k = {key: i for i, key in enumerate(COLUMN_KEYS)}
    for r in body["rows"]:
        assert r[k["batting_team"]] and r[k["bowling_team"]]
        both = r[k["batting_full_member"]] * r[k["bowling_full_member"]]
        assert r[k["both_full_members"]] == both
        assert r[k["in_test_population"]] == int(r[k["competition"]] != "t20i" or both == 1)


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
    assert cols["used_for"]["labels"] == {"training": "Training", "training_validation": "Training and validation",
                                          "test": "Test"}
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
    table = make_table()                                       # enough innings in every year for the rolling checks
    table["venue"] = "Plain Ground"
    table.loc[0, "venue"], table.loc[1, "venue"] = 'Ground, "North" End', "Köln Ground"
    table.to_csv(csv, index=False)
    manifest.write_text(json.dumps({**MANIFEST, "counts": {**MANIFEST["counts"], "total_innings": 2}}), encoding="utf-8")
    test_app = FastAPI()
    test_app.include_router(create_router(lambda: build_table(csv, manifest)), prefix="/api")
    body = TestClient(test_app).get("/api/data").json()
    venues = [r[COLUMN_KEYS.index("venue")] for r in body["rows"]]
    assert venues[:3] == ['Ground, "North" End', "Köln Ground", "Plain Ground"]


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
