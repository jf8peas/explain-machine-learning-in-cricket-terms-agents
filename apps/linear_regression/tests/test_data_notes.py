"""The "What are dummy variables?" note on the Data tab: wording anchors and a worked example built from real rows.

The wording is for a person to judge (SC-004), so these tests check structure and a few anchor phrases only.
"""
import pandas as pd
from fastapi.testclient import TestClient

from api.index import app
from linreg.competition_dummies import add_dummies
from linreg.data_loading import DEFAULT_PATH
from linreg.data_notes import build_notes
from linreg.data_table import COMPETITION_NAMES

client = TestClient(app)


def note_from_api() -> dict:
    notes = client.get("/api/data").json()["notes"]
    assert len(notes) == 1
    return notes[0]


def test_the_payload_has_one_note_with_the_expected_title_and_paragraphs():
    note = note_from_api()
    assert note["title"] == "What are dummy variables?"
    assert len(note["paragraphs"]) >= 4 and all(p.strip() for p in note["paragraphs"])
    text = " ".join(note["paragraphs"])
    assert "yes/no" in text
    assert "T20 International" in text
    assert "does not use these columns yet" in text


def test_the_example_is_three_real_rows_one_per_competition():
    example = note_from_api()["example"]
    assert example["columns"] == ["Competition", "IPL (0/1)", "BBL (0/1)"]
    assert example["rows"] == [["T20 International", "0", "0"], ["IPL", "1", "0"], ["BBL", "0", "1"]]
    assert example["caption"]
    df = pd.read_csv(DEFAULT_PATH)  # each row is the first row of its competition in the data
    for (name, ipl, bbl), comp in zip(example["rows"], ["t20i", "ipl", "bbl"]):
        first = df[df["competition"] == comp].iloc[0]
        assert (name, int(ipl), int(bbl)) == (COMPETITION_NAMES[comp], first["is_ipl"], first["is_bbl"])


def table(rows) -> pd.DataFrame:
    return add_dummies(pd.DataFrame({"competition": [c for c in rows], "venue": [f"v{i}" for i in range(len(rows))]}))


def test_the_example_is_built_from_the_rows_it_is_given_not_typed_in():
    df = table(["bbl", "ipl", "ipl", "t20i", "bbl"])
    df.loc[1, "is_ipl"] = 7  # the first IPL row: whatever it holds is what the example shows
    example = build_notes(df, COMPETITION_NAMES)[0]["example"]
    assert example["rows"] == [["T20 International", "0", "0"], ["IPL", "7", "0"], ["BBL", "0", "1"]]


def test_a_competition_missing_from_the_data_is_left_out_of_the_example():
    example = build_notes(table(["ipl", "t20i"]), COMPETITION_NAMES)[0]["example"]
    assert [r[0] for r in example["rows"]] == ["T20 International", "IPL"]
