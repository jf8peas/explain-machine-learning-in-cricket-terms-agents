"""The feature catalogue: the 19 candidates, their descriptions and recipes, and the prepared column order."""
import pandas as pd
import pytest

from linreg import features
from linreg.competition_dummies import DUMMIES
from linreg.data_loading import DataError
from linreg.recipes import evaluate
from linreg.state import SET_LIMIT

EXPECTED_IDS = ["runs_at_10", "wickets_at_10", "powerplay_runs", "powerplay_wickets", "runs_overs_7_10",
                "wickets_overs_7_10", "fours_at_10", "sixes_at_10", "dot_balls_at_10", "extras_at_10",
                "partnership_runs", "balls_since_last_wicket", "wickets_in_hand", "runs_x_wickets_in_hand",
                "batting_full_member", "bowling_full_member", "both_full_members", "is_ipl", "is_bbl"]


def test_the_catalogue_has_the_19_candidates_in_order():
    assert features.IDS == EXPECTED_IDS
    assert len(features.CATALOGUE) == 19


def test_the_team_candidates_and_the_clash_with_the_league_columns():
    assert features.BY_ID["batting_full_member"]["source"] == {"measured": True}
    assert features.BY_ID["both_full_members"]["source"]["recipe"] == {
        "product": ["batting_full_member", "bowling_full_member"]}
    assert "'not an IPL or BBL innings'" in features.BY_ID["both_full_members"]["description"]
    assert features.measured_inputs("both_full_members") == ["batting_full_member", "bowling_full_member"]


def test_every_candidate_has_wording_a_unit_and_bounds():
    for f in features.CATALOGUE:
        assert f["label"] and f["description"] and f["unit"], f["id"]
        assert len(f["description"]) > 20
        assert "min" in f["bounds"], f["id"]


def test_the_set_size_limit_is_eight():
    assert SET_LIMIT == 8


def test_recipes_only_read_earlier_entries_or_competition():
    seen = set()
    for f in features.CATALOGUE:
        recipe = f["source"].get("recipe")
        if recipe is not None:
            from linreg.recipes import inputs
            for col in inputs(recipe):
                assert col in seen or col == "competition", (f["id"], col)
        seen.add(f["id"])


def test_the_dummies_come_from_the_one_mapping():
    for column, competition in DUMMIES.items():
        recipe = features.BY_ID[column]["source"]["recipe"]
        assert recipe == {"indicator": {"column": "competition", "equals": competition}}


def test_inputs_follow_recipes_down_to_measured_columns():
    assert features.measured_inputs("runs_at_10") == ["runs_at_10"]
    assert features.measured_inputs("wickets_in_hand") == ["wickets_at_10"]
    assert features.measured_inputs("runs_x_wickets_in_hand") == ["runs_at_10", "wickets_at_10"]
    assert features.measured_inputs("is_ipl") == ["competition"]
    assert features.measured_inputs_for(["wickets_in_hand", "runs_x_wickets_in_hand", "fours_at_10"]) == [
        "wickets_at_10", "runs_at_10", "fours_at_10"]


def test_the_prepared_columns_order():
    cols = features.PREPARED_COLUMNS
    assert cols[:9] == ["match_id", "match_date", "season", "competition", "is_ipl", "is_bbl", "venue",
                        "batting_team", "bowling_team"]
    assert cols[-2:] == ["in_test_population", "final_total"]
    assert cols[9:-2] == [i for i in EXPECTED_IDS if i not in DUMMIES]
    assert len(set(cols)) == len(cols)


def good_frame(n=5) -> pd.DataFrame:
    df = pd.DataFrame({"runs_at_10": [80, 70, 55, 90, 60], "wickets_at_10": [0, 3, 9, 2, 4]})
    df["wickets_in_hand"] = 10 - df["wickets_at_10"]
    df["runs_x_wickets_in_hand"] = df["runs_at_10"] * df["wickets_in_hand"]
    return df


def test_add_candidates_computes_every_derived_column_from_its_recipe():
    base = pd.DataFrame({"competition": ["ipl", "bbl", "t20i"], "runs_at_10": [80, 70, 55], "wickets_at_10": [0, 3, 9],
                         "batting_full_member": [0, 0, 1], "bowling_full_member": [0, 0, 1]})
    out = features.add_derived(base)
    assert out["both_full_members"].tolist() == [0, 0, 1]
    assert out["wickets_in_hand"].tolist() == [10, 7, 1]
    assert out["runs_x_wickets_in_hand"].tolist() == [800, 490, 55]
    assert out[["is_ipl", "is_bbl"]].values.tolist() == [[1, 0], [0, 1], [0, 0]]
    for f in features.CATALOGUE:
        recipe = f["source"].get("recipe")
        if recipe:
            assert out[f["id"]].tolist() == evaluate(recipe, out).tolist()


def full_table() -> pd.DataFrame:
    n = 6
    df = pd.DataFrame({"competition": ["ipl", "bbl", "t20i"] * 2})
    for f in features.CATALOGUE:
        if f["source"].get("measured"):
            df[f["id"]] = range(1, n + 1)
    return features.add_derived(df)


def test_check_features_accepts_a_consistent_table():
    features.check_features(full_table())


def test_check_features_counts_rows_whose_derived_value_is_wrong():
    df = full_table()
    df.loc[[0, 3], "wickets_in_hand"] = 99
    with pytest.raises(DataError, match=r"2 rows .*wickets_in_hand"):
        features.check_features(df)


def test_check_features_names_a_blank_candidate_value_and_the_row_count():
    df = full_table()
    df["fours_at_10"] = df["fours_at_10"].astype("float")
    df.loc[[1, 2, 5], "fours_at_10"] = None
    with pytest.raises(DataError, match=r"fours_at_10.*3 rows|3 rows.*fours_at_10"):
        features.check_features(df)


def test_public_catalogue_has_what_the_page_needs():
    pub = features.public_catalogue()
    assert pub["limit"] == 8
    by_id = {f["id"]: f for f in pub["features"]}
    assert set(by_id) == set(EXPECTED_IDS)
    wih = by_id["wickets_in_hand"]
    assert wih["inputs"] == ["wickets_at_10"] and wih["source"] == {"difference": {"from": 10, "of": "wickets_at_10"}}
    assert by_id["runs_at_10"]["source"] == {"measured": True}
    assert by_id["wickets_at_10"]["bounds"] == {"min": 0, "max": 9}


def test_label_and_unit_helpers_still_work_for_the_explanation():
    assert features.label("runs_at_10") == "runs scored at the halfway mark"
    assert features.unit("wickets_at_10") == "wickets"
    assert set(features.labels()) >= {"runs_at_10", "wickets_at_10", "powerplay_runs"}
