"""The notes, the loop explanation and the done-beforehand item this app sends with its structure (feature 005)."""
import pytest

from linreg.graph import NODE_STAGES
from linreg.stage_info import stage_notes, structure_extras
from linreg.stages import CHOOSE_STAGE, FIT_STAGE, STAGES


# ---- notes for stages ----

EXPECTED = {
    "prepare": "Reads the prepared CSV into a pandas DataFrame and validates it.",
    "split": "Split by calendar year, never at random. Expanding-window cross-validation: each of the three years before the latest is scored by a model trained only on earlier years, and the three mean absolute errors (MAE, the average miss in runs) are averaged. That average chooses the features, hyperparameters and winning method, while the coefficients are fitted only on each fold's training years. The latest year is the held-out test set, read once. Only IPL, BBL and full-member T20Is are scored.",
    "understand": "Computes summary statistics to brief the LLM before it proposes: each feature's correlation with the final total, runs added by wickets down, and mean totals by competition and year. They guide the LLM's proposals only; no model is fitted on them.",
    "frame": "Regression on the final total, scored by MAE. Before any fitting, two baselines are scored on the validation folds: the TV projection (run rate × 20) and a naive mean. The goal is to beat the TV projection by 3 runs of MAE on the test year.",
    "choose": "Model selection. A candidate is a feature subset (up to 8) plus three hyperparameters, set before fitting rather than learned: training window, recency weighting and training innings. The LLM proposes candidates; code rejects any that are invalid, already tried, too small to train on or perfectly collinear, then fits and cross-validates the rest. The loop runs up to 6 rounds and stops after 2 without improvement. As a benchmark, a grid search tries all 24 hyperparameter combinations, with forward feature selection inside each. Whichever method's best candidate has the lower cross-validated MAE wins, before the test year is read.",
    "fit": "Fits the candidate in closed form (least squares via the normal equations, not gradient descent): an intercept plus one coefficient per feature, weighted when recency weighting is on. A separate fit is made for each validation fold, on only the years before it, and the loop repeats this for every new candidate. Solved directly in NumPy rather than scikit-learn (a test confirms identical coefficients) to stay within Vercel's size limit.",
    "assess": "The winning candidate and the benchmark's best are refitted on every year before the test year, then scored once on the held-out test year alongside the TV projection and the naive mean. Selection was already settled on cross-validated MAE, so this is an unbiased estimate of performance on a new season. Reports MAE, R², share within 10 and 20 runs, error as a % of a typical total, and bias, and whether the 3-run goal was met.",
    "interpret": "Turns the results into cricket sentences from code templates. Every number is read from the run state, so the LLM cannot invent a figure. Feature importance is coefficient × interquartile range: how many runs a typical difference in that feature moves the prediction. Also states the winning window and half-life, and the test-year MAE against the TV projection and the goal.",
}


def test_every_stage_has_the_agreed_note_word_for_word():
    notes = structure_extras()["notes"]["stages"]
    assert notes == EXPECTED


def test_every_stage_has_a_node_in_this_app_so_no_stage_needs_a_reason():
    assert {s.id for s in STAGES} == set(NODE_STAGES.values())
    notes = structure_extras()["notes"]["stages"]
    assert set(notes) == {s.id for s in STAGES}          # and every stage has a note


def test_a_stage_with_no_node_gets_its_reason_as_its_note():
    mapping = {k: v for k, v in NODE_STAGES.items() if v != "understand"}
    notes = stage_notes(mapping, {"understand": "This agent does not explore the data."})
    assert notes["understand"] == "This agent does not explore the data."
    assert "choose" in notes and "split" in notes


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
from linreg.season_split import rolling_checks  # noqa: E402


def general_note():
    return client.get("/api/structure").json()["notes"]["general"]


def test_the_general_note_is_one_sentence_with_the_real_years_from_the_rolling_checks():
    rolling = rolling_checks(load_innings())
    checks = [str(c.year) for c in rolling.checks]
    assert general_note() == f"Validation years: {checks[0]}, {checks[1]} and {checks[2]}; test year: {rolling.test_year}, used once."


def test_with_the_data_unreadable_there_is_no_general_note_at_all(tmp_path):
    bad = tmp_path / "innings.csv"
    bad.write_text("not,a,table\n1,2,3\n", encoding="utf-8")
    assert "general" not in structure_extras(data_path=bad)["notes"]
    assert "general" not in structure_extras(data_path=tmp_path / "nope.csv")["notes"]
    assert "stages" in structure_extras(data_path=bad)["notes"]            # the stage notes do not depend on the data
