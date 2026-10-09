"""The test population and the team columns the preparation script records (feature 008)."""
import csv
import io
import json
import zipfile

import pandas as pd
import pytest

import prepare_data
from linreg import features, setup_settings
from linreg.data_loading import DataError
from linreg.population import check_population, in_population, population_counts
from tests.fixtures.builders import NORMAL_RUNS, NORMAL_WICKETS, make_innings, make_match


def match(teams=("India", "Australia"), **kw):
    return make_match([make_innings(NORMAL_RUNS, NORMAL_WICKETS), make_innings([5] * 20)], teams=teams, **kw)


def row(competition, teams, aliases=None):
    r, reason = prepare_data.rollup_match(match(teams), competition, "m1", aliases=aliases)
    assert reason is None
    return r


def test_a_t20i_between_two_full_members_is_in_the_population():
    r = row("t20i", ("India", "Australia"))
    assert (r["batting_team"], r["bowling_team"]) == ("India", "Australia")
    assert (r["batting_full_member"], r["bowling_full_member"], r["both_full_members"], r["in_test_population"]) == (1, 1, 1, 1)


def test_a_t20i_with_an_associate_is_out_of_the_population():
    r = row("t20i", ("India", "Scotland"))
    assert (r["batting_full_member"], r["bowling_full_member"], r["both_full_members"], r["in_test_population"]) == (1, 0, 0, 0)
    r = row("t20i", ("Scotland", "Nepal"))
    assert (r["batting_full_member"], r["bowling_full_member"], r["in_test_population"]) == (0, 0, 0)


@pytest.mark.parametrize("competition", ["ipl", "bbl"])
def test_every_league_innings_is_in_the_population_and_both_flags_are_zero(competition):
    # even a franchise named like a national team: franchises are not national teams
    for teams in (("Mumbai Indians", "Chennai Super Kings"), ("India", "Australia")):
        r = row(competition, teams)
        assert (r["batting_full_member"], r["bowling_full_member"], r["both_full_members"]) == (0, 0, 0)
        assert r["in_test_population"] == 1


def test_the_batting_team_is_the_first_innings_team_and_the_bowling_team_the_other():
    m = match(("Australia", "India"))
    m["info"]["teams"] = ["India", "Australia"]          # the order of info.teams does not decide it
    r, _ = prepare_data.rollup_match(m, "t20i", "m1")
    assert (r["batting_team"], r["bowling_team"]) == ("Australia", "India")


def test_an_alias_is_applied_before_membership_is_decided():
    m = match(("Bharat", "Australia"))
    r, _ = prepare_data.rollup_match(m, "t20i", "m1", aliases={"Bharat": "India"})
    assert r["batting_team"] == "India" and r["batting_full_member"] == 1 and r["in_test_population"] == 1
    r, _ = prepare_data.rollup_match(m, "t20i", "m1")      # without the alias it is an unknown team
    assert r["batting_team"] == "Bharat" and r["batting_full_member"] == 0 and r["in_test_population"] == 0


# --- the download run: manifest, counts and the printed report ------------------------------------------------------

def zip_of(*matches, prefix="m"):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for i, m in enumerate(matches):
            zf.writestr(f"{prefix}{i}.json", json.dumps(m))
    return buf.getvalue()


SOURCES = {"t20i": "u/t20i", "ipl": "u/ipl", "bbl": "u/bbl"}
ZIPS = {
    "u/t20i": zip_of(match(("India", "Australia"), date="2023-01-01"), match(("India", "Scotland"), date="2023-01-02"),
                     match(("Nepal", "Oman"), date="2023-01-03"), match(("Nepal", "Scotland"), date="2023-01-04"),
                     prefix="t"),
    "u/ipl": zip_of(match(("Mumbai Indians", "Chennai Super Kings"), date="2023-02-01"), prefix="i"),
    "u/bbl": zip_of(match(("Sydney Sixers", "Perth Scorchers"), date="2023-03-01"), prefix="b"),
}


def run(tmp_path, capsys, zips=ZIPS):
    prepare_data.run_download(tmp_path, SOURCES, lambda url: zips[url], today="2026-10-09")
    return capsys.readouterr().out, json.loads((tmp_path / "manifest.json").read_text())


def test_the_manifest_records_the_list_the_aliases_the_absent_members_and_the_counts(tmp_path, capsys):
    _, manifest = run(tmp_path, capsys)
    assert manifest["full_members"] == list(setup_settings.FULL_MEMBERS)
    assert manifest["team_aliases"] == setup_settings.TEAM_ALIASES
    # the fixtures contain only India and Australia of the twelve, so every other member is absent from this "source"
    assert set(manifest["absent_full_members"]) == set(setup_settings.FULL_MEMBERS) - {"India", "Australia"}
    with open(tmp_path / "innings.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    inside = sum(r["in_test_population"] == "1" for r in rows)
    assert manifest["population"]["in"] == inside == 3 and manifest["population"]["out"] == len(rows) - inside == 3
    assert manifest["population"]["in"] + manifest["population"]["out"] == manifest["counts"]["total_innings"]
    assert manifest["population"]["by_competition"] == {"t20i": {"in": 1, "out": 3}, "ipl": {"in": 1, "out": 0},
                                                         "bbl": {"in": 1, "out": 0}}


def test_the_csv_columns_follow_the_shared_order_and_the_flags_are_consistent(tmp_path, capsys):
    run(tmp_path, capsys)
    with open(tmp_path / "innings.csv", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        assert reader.fieldnames == features.PREPARED_COLUMNS
        rows = list(reader)
    i = features.PREPARED_COLUMNS.index("venue")
    assert features.PREPARED_COLUMNS[i + 1:i + 3] == ["batting_team", "bowling_team"]
    assert features.PREPARED_COLUMNS[-2:] == ["in_test_population", "final_total"]
    for r in rows:
        both = int(r["batting_full_member"]) * int(r["bowling_full_member"])
        assert int(r["both_full_members"]) == both
        assert int(r["in_test_population"]) == int(r["competition"] != "t20i" or both == 1)


def test_the_report_lists_non_member_t20i_teams_most_frequent_first_and_warns_about_absent_members(tmp_path, capsys):
    out, _ = run(tmp_path, capsys)
    assert "Not full members" in out
    section = out.split("Not full members")[1]
    assert section.index("Nepal") < section.index("Oman")                 # Nepal 2 innings, Oman 1
    assert "Scotland" in section and "Nepal: 2" in section
    assert "Afghanistan" in out and "never appear" in out.lower()
    assert "India" not in section.split("Warning")[0]                    # a full member is not listed as a non-member


def test_from_existing_names_the_team_columns_in_its_refusal(tmp_path):
    from tests.test_prepare_dummies import old_style_files
    old_style_files(tmp_path, with_measured=False)
    with pytest.raises(prepare_data.PrepareError) as err:
        prepare_data.run_from_existing(tmp_path)
    assert "batting_team" in str(err.value) and "in_test_population" in str(err.value)


# --- the population helpers over a table -------------------------------------------------------------------------

def table():
    return pd.DataFrame({
        "competition": ["ipl", "bbl", "t20i", "t20i"],
        "batting_full_member": [0, 0, 1, 1], "bowling_full_member": [0, 0, 1, 0],
        "in_test_population": [1, 1, 1, 0],
    })


def test_in_population_and_the_counts():
    df = table()
    assert in_population(df).tolist() == [True, True, True, False]
    assert population_counts(df) == {"in": 3, "out": 1, "by_competition": {
        "ipl": {"in": 1, "out": 0}, "bbl": {"in": 1, "out": 0}, "t20i": {"in": 1, "out": 1}}}


def test_check_population_accepts_a_consistent_table_and_names_an_inconsistent_one():
    check_population(table())
    wrong = table()
    wrong.loc[3, "in_test_population"] = 1               # an innings with an associate marked as in the population
    with pytest.raises(DataError, match="in_test_population"):
        check_population(wrong)
    wrong = table()
    wrong.loc[0, "batting_full_member"] = 1              # a franchise marked as a full member
    with pytest.raises(DataError, match="league"):
        check_population(wrong)
