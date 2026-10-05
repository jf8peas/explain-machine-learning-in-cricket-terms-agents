"""The committed innings.csv and manifest.json carry correct competition dummies (SC-001, SC-002, FR-007)."""
import json

import pandas as pd

from linreg.competition_dummies import DUMMIES, DUMMY_COLUMNS, REFERENCE, manifest_entry
from linreg.data_loading import DEFAULT_PATH
from linreg.features import PREPARED_COLUMNS

MANIFEST = json.loads((DEFAULT_PATH.parent / "manifest.json").read_text(encoding="utf-8"))

df = pd.read_csv(DEFAULT_PATH)


def test_columns_are_in_the_prepared_order():
    assert list(df.columns) == PREPARED_COLUMNS
    i = list(df.columns).index("competition")
    assert list(df.columns[i + 1:i + 3]) == DUMMY_COLUMNS


def test_every_row_agrees_with_its_competition():
    for col, comp in DUMMIES.items():
        assert df[col].isin([0, 1]).all()
        assert (df[col] == (df["competition"] == comp).astype(int)).all()
    ipl = df[df["competition"] == "ipl"][DUMMY_COLUMNS].drop_duplicates().values.tolist()
    bbl = df[df["competition"] == "bbl"][DUMMY_COLUMNS].drop_duplicates().values.tolist()
    reference = df[df["competition"] == REFERENCE][DUMMY_COLUMNS].drop_duplicates().values.tolist()
    assert ipl == [[1, 0]] and bbl == [[0, 1]] and reference == [[0, 0]]


def test_no_row_has_both_dummies_set():
    assert not (df[DUMMY_COLUMNS].sum(axis=1) > 1).any()


def test_dummy_counts_equal_the_manifest_per_competition_counts():
    counts = MANIFEST["counts"]
    assert int(df["is_ipl"].sum()) == counts["ipl"]["innings_kept"]
    assert int(df["is_bbl"].sum()) == counts["bbl"]["innings_kept"]
    assert int(((df["is_ipl"] == 0) & (df["is_bbl"] == 0)).sum()) == counts[REFERENCE]["innings_kept"]
    assert len(df) == counts["total_innings"]


def test_manifest_records_the_dummies_and_the_reference():
    assert MANIFEST["dummies"] == manifest_entry()
    assert MANIFEST["dummies"]["reference"] == "t20i"
    assert MANIFEST["dummies"]["columns"] == {"is_ipl": "ipl", "is_bbl": "bbl"}
