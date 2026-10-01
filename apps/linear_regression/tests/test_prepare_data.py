import pytest

from prepare_data import rollup_match
from tests.fixtures.builders import (NORMAL, NORMAL_RUNS, NORMAL_WICKETS, make_innings,
                                     make_match)


def normal_match(**kw):
    return make_match([make_innings(NORMAL_RUNS, NORMAL_WICKETS),
                       make_innings([5] * 20)], **kw)


def test_normal_innings_rolls_up_zero_indexed_overs():
    row, reason = rollup_match(normal_match(), "ipl", "m1")
    assert reason is None
    assert row["runs_at_10"] == NORMAL["runs_at_10"]      # over indexes 0-9
    assert row["powerplay_runs"] == NORMAL["powerplay"]   # over indexes 0-5
    assert row["wickets_at_10"] == NORMAL["wickets_at_10"]  # wickets after index 9 not counted
    assert row["final_total"] == NORMAL["total"]
    assert row["competition"] == "ipl"
    assert row["match_id"] == "m1"
    assert row["match_date"] == "2023-05-01"


def test_only_first_innings_is_used():
    row, _ = rollup_match(normal_match(), "ipl", "m1")
    assert row["final_total"] == NORMAL["total"]  # not the second innings' 100


@pytest.mark.parametrize("kwargs,reason", [
    ({"gender": "female"}, "women"),
    ({"result": "no result"}, "no_result"),
    ({"method": "D/L"}, "dls"),
    ({"method": "DLS"}, "dls"),
    ({"overs": 10}, "reduced_overs"),
])
def test_match_level_exclusions(kwargs, reason):
    row, got = rollup_match(normal_match(**kwargs), "ipl", "m1")
    assert row is None and got == reason


def test_all_out_during_tenth_over_is_excluded():
    inn = make_innings([5] * 10, {9: 10})  # 10 wickets by the end of over index 9
    row, reason = rollup_match(make_match([inn, make_innings([5] * 20)]), "ipl", "m1")
    assert row is None and reason == "ended_before_10_overs"


def test_all_out_in_twelfth_over_is_kept():
    inn = make_innings([5] * 12, {1: 3, 5: 3, 9: 3, 11: 1})  # 9 wickets at index 9, 10th later
    row, reason = rollup_match(make_match([inn, make_innings([5] * 20)]), "ipl", "m1")
    assert reason is None
    assert row["wickets_at_10"] == 9
    assert row["final_total"] == 60


def test_innings_ending_before_ten_overs_is_excluded():
    inn = make_innings([5] * 8)
    row, reason = rollup_match(make_match([inn, make_innings([5] * 20)]), "ipl", "m1")
    assert row is None and reason == "ended_before_10_overs"


def test_super_over_first_innings_is_not_used():
    match = make_match([make_innings([5] * 20, super_over=True)])
    row, reason = rollup_match(match, "ipl", "m1")
    assert row is None and reason == "super_over"


def test_retired_hurt_not_counted_as_wicket():
    inn = make_innings([5] * 20)
    inn["overs"][3]["deliveries"].append({
        "batter": "A", "bowler": "B", "runs": {"batter": 0, "extras": 0, "total": 0},
        "wickets": [{"player_out": "A", "kind": "retired hurt"}]})
    row, _ = rollup_match(make_match([inn, make_innings([5] * 20)]), "ipl", "m1")
    assert row["wickets_at_10"] == 0
