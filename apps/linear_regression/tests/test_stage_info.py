"""The notes, the loop explanation and the done-beforehand item this app sends with its structure (feature 005)."""
import pytest

from linreg.graph import NODE_STAGES
from linreg.stage_info import stage_notes, structure_extras
from linreg.stages import CHOOSE_STAGE, FIT_STAGE, STAGES


# ---- notes for stages ----

def test_the_choose_note_says_it_is_feature_selection_only_in_this_app():
    note = structure_extras()["notes"]["stages"]["choose"].lower()
    assert "feature selection only" in note
    assert "no hyperparameters" in note
    assert "later apps" in note


def test_every_stage_has_a_node_in_this_app_so_no_stage_needs_a_reason():
    assert {s.id for s in STAGES} == set(NODE_STAGES.values())
    notes = structure_extras()["notes"]["stages"]
    assert set(notes) == {"choose"}                      # only the stage that has something to say


def test_a_stage_with_no_node_gets_its_reason_as_its_note():
    mapping = {k: v for k, v in NODE_STAGES.items() if v != "understand"}
    notes = stage_notes(mapping, {"understand": "This agent does not explore the data."})
    assert notes["understand"] == "This agent does not explore the data."
    assert "choose" in notes


def test_a_stage_with_no_node_and_no_reason_is_an_error_so_it_cannot_ship_silently():
    mapping = {k: v for k, v in NODE_STAGES.items() if v != "understand"}
    with pytest.raises(ValueError, match="understand"):
        stage_notes(mapping, {})


def test_notes_are_plain_text():
    for text in structure_extras()["notes"]["stages"].values():
        assert "<" not in text and ">" not in text and text.strip()


def test_the_extras_carry_the_stage_set_and_the_loop():
    extras = structure_extras()
    assert [s["id"] for s in extras["stages"]] == [s.id for s in STAGES]
    assert extras["loop"] == {"fit": FIT_STAGE, "choose": CHOOSE_STAGE}


# ---- the done-beforehand item ----

import json  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from api.index import app  # noqa: E402
from linreg import competition_dummies, features  # noqa: E402
from linreg.data_table import DEFAULT_MANIFEST, exclusion_rows  # noqa: E402

client = TestClient(app)
MANIFEST = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))


def item():
    items = client.get("/api/structure").json()["items"]
    assert len(items) == 1
    return items[0]


def test_one_item_sits_before_load_data_in_prepare_the_data():
    it = item()
    assert (it["id"], it["stage"], it["before"]) == ("prepare_data", "prepare", "load_data")
    assert it["label"]


def test_the_summary_says_who_did_the_work_and_when():
    text = item()["summary"]["text"]
    assert "scripts/prepare_data.py" in text and "before the agent runs" in text.lower()


def test_exclusion_rows_equal_the_manifest_and_the_data_tab():
    rows = item()["summary"]["rows"]
    excluded = [r for r in rows if r["label"].startswith("Excluded: ")]
    expected = [{"label": f"Excluded: {r['label']}", "value": r["value"]} for r in exclusion_rows(MANIFEST)]
    assert excluded == expected and excluded                               # something was excluded, and it adds up
    tab = client.get("/api/data").json()["summary"]["sections"]
    tab_rows = next(s for s in tab if s["title"] == "Excluded, and why")["rows"]
    assert exclusion_rows(MANIFEST) == tab_rows                            # the Data tab shows the very same rows
    totals = {}
    for comp in MANIFEST["counts"].values():
        if isinstance(comp, dict):
            for reason, n in comp["excluded"].items():
                totals[reason] = totals.get(reason, 0) + n
    assert sum(int(r["value"].replace(",", "")) for r in tab_rows) == sum(totals.values())


def test_the_columns_created_are_counted_from_the_catalogue_and_the_dummies():
    rows = {r["label"]: r["value"] for r in item()["summary"]["rows"]}
    measured = sum(1 for f in features.CATALOGUE if "measured" in f["source"])
    derived = len(features.CATALOGUE) - measured
    assert rows["Columns measured from the ball-by-ball data"] == str(measured)
    assert rows["Columns worked out from those"] == str(derived)
    assert rows["Competition columns"] == " and ".join(competition_dummies.DUMMIES)


def test_the_link_goes_to_the_data_tab():
    assert item()["summary"]["link"] == {"label": "See the Data tab", "href": "#data"}


def test_with_the_manifest_unreadable_the_item_is_still_sent_with_the_link(tmp_path):
    bad = tmp_path / "manifest.json"
    bad.write_text("{ not json", encoding="utf-8")
    it = structure_extras(manifest_path=bad)["items"][0]
    assert it["summary"]["text"] == "Details could not be loaded."
    assert "rows" not in it["summary"] and it["summary"]["link"]["href"] == "#data"
    missing = structure_extras(manifest_path=tmp_path / "nope.json")["items"][0]
    assert missing["summary"]["text"] == "Details could not be loaded."


def test_the_item_is_plain_text():
    it = item()
    for text in [it["label"], it["summary"]["text"], *[v for r in it["summary"]["rows"] for v in r.values()]]:
        assert "<" not in text and ">" not in text


# ---- the loop explanation ----

from linreg.data_loading import load_innings  # noqa: E402
from linreg.season_split import split_three_ways  # noqa: E402


def general_note():
    return client.get("/api/structure").json()["notes"]["general"]


def test_the_loop_note_names_the_real_years_from_the_three_way_split():
    slices = split_three_ways(load_innings())
    years = sorted(int(y) for y in slices.train["match_date"].dt.year.unique())
    note = general_note()
    assert f"({years[0]} to {years[-1]})" in note                       # the training years
    assert f"validation year ({slices.validation_year})" in note
    assert f"test year ({slices.test_year})" in note


def test_the_loop_note_explains_the_two_loops_in_plain_words():
    note = general_note().lower()
    assert "new setup (stage 6)" in note and "fits the model again (stage 5)" in note
    assert "parameters are learned from the training years" in note
    assert "the setup is chosen using the validation year" in note
    assert "used once" in note and "at the end" in note
    assert "<" not in note and ">" not in note


def test_with_the_data_unreadable_the_note_is_sent_without_any_year(tmp_path):
    bad = tmp_path / "innings.csv"
    bad.write_text("not,a,table\n1,2,3\n", encoding="utf-8")
    note = structure_extras(data_path=bad)["notes"]["general"]
    assert "training years" in note and "validation year" in note and "test year" in note
    assert not any(ch.isdigit() for ch in note.replace("stage 6", "").replace("stage 5", ""))
    missing = structure_extras(data_path=tmp_path / "nope.csv")["notes"]["general"]
    assert missing == note
