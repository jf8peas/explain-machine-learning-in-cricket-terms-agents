"""The preparation script adds the competition dummies, writes safely, and can rebuild from the existing file."""
import csv
import io
import json
import zipfile
from pathlib import Path

import pytest

import prepare_data
from linreg.competition_dummies import DUMMY_COLUMNS, PREPARED_COLUMNS, UnknownCompetition, manifest_entry
from tests.fixtures.builders import NORMAL_RUNS, NORMAL_WICKETS, make_innings, make_match


def zip_of(*matches, prefix="m") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for i, m in enumerate(matches):
            zf.writestr(f"{prefix}{i}.json", json.dumps(m))
    return buf.getvalue()


def a_match(**kw):
    return make_match([make_innings(NORMAL_RUNS, NORMAL_WICKETS), make_innings([5] * 20)], **kw)


def fetcher(zips: dict[str, bytes]):
    return lambda url: zips[url]


def read(path: Path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def snapshot(folder: Path) -> dict[str, bytes]:
    return {n: (folder / n).read_bytes() for n in ("innings.csv", "manifest.json")}


SOURCES = {"t20i": "u/t20i", "ipl": "u/ipl", "bbl": "u/bbl"}
ZIPS = {"u/t20i": zip_of(a_match(date="2023-01-01"), a_match(date="2023-01-02"), prefix="t"),
        "u/ipl": zip_of(a_match(date="2023-02-01"), prefix="i"),
        "u/bbl": zip_of(a_match(date="2023-03-01"), a_match(result="no result"), prefix="b")}


def test_rollup_rows_carry_the_dummies():
    expected = {"ipl": (1, 0), "bbl": (0, 1), "t20i": (0, 0)}
    for comp, values in expected.items():
        row, reason = prepare_data.rollup_match(a_match(), comp, "m1")
        assert reason is None
        assert (row["is_ipl"], row["is_bbl"]) == values


def test_unknown_competition_raises_naming_the_value():
    with pytest.raises(UnknownCompetition, match="cpl"):
        prepare_data.rollup_match(a_match(), "cpl", "m1")


def test_columns_follow_the_shared_definition():
    assert prepare_data.COLUMNS == PREPARED_COLUMNS
    i = prepare_data.COLUMNS.index("competition")
    assert prepare_data.COLUMNS[i + 1:i + 3] == DUMMY_COLUMNS


def test_download_run_writes_the_dummies_and_the_manifest_entry(tmp_path):
    prepare_data.run_download(tmp_path, SOURCES, fetcher(ZIPS), today="2026-10-03")
    rows = read(tmp_path / "innings.csv")
    assert list(rows[0]) == PREPARED_COLUMNS
    assert len(rows) == 4
    for r in rows:
        want = {"t20i": ("0", "0"), "ipl": ("1", "0"), "bbl": ("0", "1")}[r["competition"]]
        assert (r["is_ipl"], r["is_bbl"]) == want
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert manifest["dummies"] == manifest_entry()
    assert manifest["download_date"] == "2026-10-03"
    assert manifest["counts"]["total_innings"] == 4
    assert not list(tmp_path.glob("*.tmp"))


def test_unknown_competition_in_a_download_leaves_existing_files_unchanged(tmp_path):
    prepare_data.run_download(tmp_path, SOURCES, fetcher(ZIPS), today="2026-10-03")
    before = snapshot(tmp_path)
    bad_sources = {**SOURCES, "cpl": "u/cpl"}
    with pytest.raises(UnknownCompetition, match="cpl"):
        prepare_data.run_download(tmp_path, bad_sources, fetcher({**ZIPS, "u/cpl": zip_of(a_match(), prefix="c")}),
                                  today="2030-01-01")
    assert snapshot(tmp_path) == before
    assert not list(tmp_path.glob("*.tmp"))


def test_a_failed_write_leaves_existing_files_unchanged_and_no_temp_files(tmp_path, monkeypatch):
    prepare_data.run_download(tmp_path, SOURCES, fetcher(ZIPS), today="2026-10-03")
    before = snapshot(tmp_path)

    def boom(*a, **k):
        raise OSError("disk full")
    monkeypatch.setattr(prepare_data.json, "dumps", boom)
    with pytest.raises(OSError):
        prepare_data.run_download(tmp_path, SOURCES, fetcher(ZIPS), today="2030-01-01")
    assert snapshot(tmp_path) == before
    assert not list(tmp_path.glob("*.tmp"))


def old_style_files(folder: Path, competitions=("t20i", "ipl", "bbl", "ipl")):
    """An innings.csv and manifest.json as they were before the dummies existed."""
    cols = [c for c in PREPARED_COLUMNS if c not in DUMMY_COLUMNS]
    with open(folder / "innings.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for i, comp in enumerate(competitions):
            w.writerow({"match_id": f"id{i}", "match_date": f"2023-0{i + 1}-01", "season": "2023", "competition": comp,
                        "venue": 'Ground, "North"', "runs_at_10": 70 + i, "wickets_at_10": i, "powerplay_runs": 50,
                        "final_total": 170 + i})
    manifest = {"download_date": "2026-10-01", "sources": [{"competition": "ipl", "url": "x"}],
                "counts": {"ipl": {"matches_read": 5, "excluded": {"dls": 1}, "innings_kept": 2},
                           "total_innings": len(competitions)}, "attribution": "Cricsheet"}
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def test_from_existing_adds_the_dummies_and_changes_nothing_else(tmp_path):
    old_style_files(tmp_path)
    before_rows = read(tmp_path / "innings.csv")
    before_manifest = json.loads((tmp_path / "manifest.json").read_text())
    prepare_data.run_from_existing(tmp_path)
    rows = read(tmp_path / "innings.csv")
    assert list(rows[0]) == PREPARED_COLUMNS
    assert [{k: v for k, v in r.items() if k not in DUMMY_COLUMNS} for r in rows] == before_rows  # same values and order
    assert [(r["is_ipl"], r["is_bbl"]) for r in rows] == [("0", "0"), ("1", "0"), ("0", "1"), ("1", "0")]
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert manifest.pop("dummies") == manifest_entry()
    assert manifest == before_manifest  # download date, sources, counts, attribution all kept
    assert not list(tmp_path.glob("*.tmp"))


def test_from_existing_twice_gives_identical_files(tmp_path):
    old_style_files(tmp_path)
    prepare_data.run_from_existing(tmp_path)
    once = snapshot(tmp_path)
    prepare_data.run_from_existing(tmp_path)
    assert snapshot(tmp_path) == once


def test_from_existing_refreshes_wrong_dummies(tmp_path):
    old_style_files(tmp_path)
    prepare_data.run_from_existing(tmp_path)
    rows = read(tmp_path / "innings.csv")
    rows[0]["is_ipl"] = "1"  # someone edited by hand
    with open(tmp_path / "innings.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=PREPARED_COLUMNS)
        w.writeheader()
        w.writerows(rows)
    prepare_data.run_from_existing(tmp_path)
    assert read(tmp_path / "innings.csv")[0]["is_ipl"] == "0"


def test_from_existing_with_an_unknown_competition_leaves_files_unchanged(tmp_path):
    old_style_files(tmp_path, competitions=("t20i", "cpl"))
    before = snapshot(tmp_path)
    with pytest.raises(UnknownCompetition, match="cpl"):
        prepare_data.run_from_existing(tmp_path)
    assert snapshot(tmp_path) == before
    assert not list(tmp_path.glob("*.tmp"))


def test_main_flag_runs_the_rebuild_without_downloading(tmp_path, monkeypatch):
    old_style_files(tmp_path)
    monkeypatch.setattr(prepare_data, "DATA_DIR", tmp_path)
    monkeypatch.setattr(prepare_data, "fetch_zip", lambda url: pytest.fail("must not download"))
    prepare_data.main(["--from-existing"])
    assert list(read(tmp_path / "innings.csv")[0]) == PREPARED_COLUMNS
