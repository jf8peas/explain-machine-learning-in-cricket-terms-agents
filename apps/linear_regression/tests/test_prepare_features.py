"""The preparation script computes the candidate features from the ball-by-ball data, and only up to over 10."""
import csv
import json

import pytest

import prepare_data
from linreg import features
from linreg.recipes import evaluate
from tests.fixtures.builders import delivery as d
from tests.fixtures.builders import innings_from_deliveries, make_innings, make_match, six_dot_overs

# Overs by index (0 to 5 are the powerplay). The expected values below are worked out by hand from this list.
OVERS = [
    [d(4), d(), d(), d(), d(), d()],                                    # 0: a four, 5 dots
    [d(6), d(extras=1, kind="wides"), d(), d(), d(), d(), d()],         # 1: a six, a wide, 5 dots
    [d(), d(), d(wicket=True), d(), d(), d()],                          # 2: a wicket (the powerplay's only one)
    [d(1), d(1), d(1), d(1), d(1), d(1)],                               # 3: six singles
    [d(extras=2, kind="byes"), d(), d(), d(), d(), d()],                # 4: two byes, 5 dots
    [d(), d(), d(), d(), d(), d()],                                     # 5: six dots
    [d(4), d(4), d(wicket=True), d(), d(), d()],                        # 6: two fours, then a wicket
    [d(2), d(1), d(), d(), d(), d()],                                   # 7: 3 runs, 4 dots
    [d(wicket="retired hurt"), d(1), d(), d(), d(), d()],               # 8: retired hurt is NOT a dismissal
    [d(6), d(), d(), d(), d(), d(1)],                                   # 9: a six, a single, 4 dots
]
# Wild overs AFTER the 10th: sixes and wickets that must change nothing about the candidates.
WILD_AFTER = [[d(6, wicket=True) for _ in range(6)], [d(4, extras=1, kind="wides") for _ in range(6)]]

EXPECTED = {
    "runs_at_10": 38, "wickets_at_10": 2, "powerplay_runs": 19, "powerplay_wickets": 1,
    "runs_overs_7_10": 19, "wickets_overs_7_10": 1, "fours_at_10": 3, "sixes_at_10": 2,
    "dot_balls_at_10": 44, "extras_at_10": 3, "partnership_runs": 11, "balls_since_last_wicket": 21,
}


def row_for(overs, competition="ipl"):
    match = make_match([innings_from_deliveries(overs), make_innings([5] * 20)])
    row, reason = prepare_data.rollup_match(match, competition, "m1")
    assert reason is None
    return row


def test_each_measured_column_on_a_hand_built_innings():
    row = row_for(OVERS + [[d()] * 6] * 10)  # padded to 20 overs of dots after over 10
    for column, value in EXPECTED.items():
        assert row[column] == value, column


def test_nothing_after_the_tenth_over_is_used():
    quiet = row_for(OVERS + [[d()] * 6] * 10)
    wild = row_for(OVERS + WILD_AFTER + [[d()] * 6] * 8)
    for column in features.IDS:
        assert wild[column] == quiet[column], column
    assert wild["final_total"] != quiet["final_total"]  # the target does use the whole innings


def test_with_no_dismissal_the_partnership_is_the_whole_innings_so_far():
    row = row_for([[d(1)] * 6 for _ in range(10)] + [[d()] * 6] * 10)
    assert row["wickets_at_10"] == 0
    assert row["partnership_runs"] == row["runs_at_10"] == 60
    assert row["balls_since_last_wicket"] == 60


def test_a_wide_or_no_ball_is_not_a_legal_ball():
    overs = [[d(extras=1, kind="noballs"), d(extras=1, kind="wides")] + [d()] * 6] + six_dot_overs(9) + [[d()] * 6] * 10
    assert row_for(overs)["balls_since_last_wicket"] == 60  # 6 legal balls in the first over, not 8


def test_derived_columns_equal_their_recipes():
    row = row_for(OVERS + [[d()] * 6] * 10, competition="bbl")
    assert row["wickets_in_hand"] == 8
    assert row["runs_x_wickets_in_hand"] == 38 * 8
    assert (row["is_ipl"], row["is_bbl"]) == (0, 1)
    for f in features.CATALOGUE:
        recipe = f["source"].get("recipe")
        if recipe:
            assert row[f["id"]] == evaluate(recipe, row), f["id"]


def test_the_row_has_the_catalogue_columns_in_order():
    row = row_for(OVERS + [[d()] * 6] * 10)
    assert list(row) == [c for c in features.PREPARED_COLUMNS if c in row] and set(row) == set(features.PREPARED_COLUMNS)


def test_the_manifest_records_how_each_feature_is_made(tmp_path):
    from tests.test_prepare_dummies import SOURCES, ZIPS, fetcher
    prepare_data.run_download(tmp_path, SOURCES, fetcher(ZIPS), today="2026-10-04")
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert manifest["features"] == features.manifest_entry()
    assert manifest["features"]["runs_at_10"] == {"measured": True}
    assert manifest["features"]["wickets_in_hand"] == {"difference": {"from": 10, "of": "wickets_at_10"}}
    with open(tmp_path / "innings.csv", newline="", encoding="utf-8") as f:
        assert list(next(csv.reader(f))) == features.PREPARED_COLUMNS


def test_from_existing_refuses_a_file_without_the_ball_by_ball_columns(tmp_path):
    from tests.test_prepare_dummies import old_style_files, snapshot
    old_style_files(tmp_path, with_measured=False)
    before = snapshot(tmp_path)
    with pytest.raises(prepare_data.PrepareError) as err:
        prepare_data.run_from_existing(tmp_path)
    message = str(err.value)
    assert "ball-by-ball" in message and "powerplay_wickets" in message and "prepare_data.py" in message
    assert snapshot(tmp_path) == before
    assert not list(tmp_path.glob("*.tmp"))


def test_from_existing_refreshes_derived_columns_when_the_measured_ones_are_there(tmp_path):
    from tests.test_prepare_dummies import old_style_files
    old_style_files(tmp_path)
    prepare_data.run_from_existing(tmp_path)
    with open(tmp_path / "innings.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert list(rows[0]) == features.PREPARED_COLUMNS
    for r in rows:
        assert int(r["wickets_in_hand"]) == 10 - int(r["wickets_at_10"])
        assert int(r["runs_x_wickets_in_hand"]) == int(r["runs_at_10"]) * int(r["wickets_in_hand"])
