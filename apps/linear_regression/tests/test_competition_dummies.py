"""The one definition of the competition dummy variables, and the every-row check."""
import re

import pandas as pd
import pytest

from linreg.competition_dummies import (DUMMY_COLUMNS, REFERENCE, UnknownCompetition,
                                        add_dummies, check_dummies, dummy_values, manifest_entry)
from linreg.data_loading import DataError


def table(*rows) -> pd.DataFrame:
    """Rows of (competition, is_ipl, is_bbl)."""
    return pd.DataFrame([{"match_id": i, "competition": c, "is_ipl": ipl, "is_bbl": bbl}
                         for i, (c, ipl, bbl) in enumerate(rows)])


def wrong_rows(df) -> int:
    with pytest.raises(DataError) as err:
        check_dummies(df)
    return int(re.match(r"(\d+) ", str(err.value)).group(1))


def test_dummy_values_for_each_competition():
    assert dummy_values("ipl") == {"is_ipl": 1, "is_bbl": 0}
    assert dummy_values("bbl") == {"is_ipl": 0, "is_bbl": 1}
    assert dummy_values("t20i") == {"is_ipl": 0, "is_bbl": 0}
    assert REFERENCE == "t20i"


def test_unknown_competition_raises_naming_the_value():
    with pytest.raises(UnknownCompetition) as err:
        dummy_values("cpl")
    assert "cpl" in str(err.value)
    assert isinstance(err.value, ValueError)


def test_manifest_entry_describes_the_columns_and_the_reference():
    assert manifest_entry() == {"reference": "t20i", "columns": {"is_ipl": "ipl", "is_bbl": "bbl"}}


def test_add_dummies_adds_and_refreshes_in_place():
    df = pd.DataFrame({"match_id": [1, 2, 3], "competition": ["ipl", "bbl", "t20i"], "venue": ["a", "b", "c"]})
    out = add_dummies(df)
    assert list(out.columns) == ["match_id", "competition", "is_ipl", "is_bbl", "venue"]
    assert out[["is_ipl", "is_bbl"]].values.tolist() == [[1, 0], [0, 1], [0, 0]]
    stale = out.assign(is_ipl=[9, 9, 9])  # refreshing replaces wrong values and keeps the order
    assert add_dummies(stale).equals(out)
    assert "is_ipl" not in df.columns  # the input is not changed


def test_add_dummies_rejects_an_unknown_competition():
    with pytest.raises(UnknownCompetition) as err:
        add_dummies(pd.DataFrame({"competition": ["ipl", "xyz"]}))
    assert "xyz" in str(err.value)


def test_a_good_table_passes():
    check_dummies(table(("ipl", 1, 0), ("bbl", 0, 1), ("t20i", 0, 0)))


@pytest.mark.parametrize("rows,count", [
    ([("ipl", 0, 0), ("bbl", 0, 1)], 1),                     # an IPL row with is_ipl 0
    ([("ipl", 1, 1), ("t20i", 0, 0)], 1),                    # both set to 1
    ([("ipl", 2, 0), ("bbl", 0, 1)], 1),                     # a value other than 0 or 1
    ([("ipl", 1, 0), ("bbl", 0, None)], 1),                  # a missing value
    ([("xyz", 0, 0), ("ipl", 1, 0)], 1),                     # an unknown competition
    ([("t20i", 1, 0), ("ipl", 1, 1), ("bbl", 0, 0), ("ipl", 1, 0)], 3),  # several wrong rows, each counted once
])
def test_check_counts_each_wrong_row_once(rows, count):
    assert wrong_rows(table(*rows)) == count


def test_the_message_names_the_columns():
    with pytest.raises(DataError) as err:
        check_dummies(table(("ipl", 0, 0)))
    assert "is_ipl" in str(err.value) and "is_bbl" in str(err.value)
