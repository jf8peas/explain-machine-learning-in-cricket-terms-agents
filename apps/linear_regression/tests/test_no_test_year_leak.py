"""SC-003: the test year plays no part in choosing features. Change every test-year value and nothing before the final
test changes: no prompt, no proposal check, no attempt, no chosen set."""
import numpy as np
import pandas as pd

from linreg import features
from linreg.llm_fake import FakeLlm, reply
from linreg.season_split import rolling_checks
from tests.conftest import make_table, merged_state, nodes_of

SCRIPT = [reply(["runs_at_10"]), reply(["runs_at_10", "wickets_in_hand"]), reply(["runs_at_10", "wickets_in_hand", "sixes_at_10"]),
          reply(["runs_at_10"], "enough", True)]


def perturbed(df: pd.DataFrame) -> pd.DataFrame:
    """The same table with every measurement and the target changed in the test year only (derived columns recomputed)."""
    rng = np.random.default_rng(99)
    out = df.copy()
    out["match_date"] = pd.to_datetime(out["match_date"])
    test_rows = out["match_date"].dt.year == out["match_date"].dt.year.max()
    flags = {"batting_full_member", "bowling_full_member"}          # who played is not a measurement: the population stays
    for column in [c for c in features.MEASURED if c not in flags] + ["final_total"]:
        out.loc[test_rows, column] = rng.integers(0, 200, int(test_rows.sum()))
    out = features.add_derived(out)
    out["match_date"] = out["match_date"].dt.strftime("%Y-%m-%d")
    return out


def run_with(run_graph, write_csv, table):
    llm = FakeLlm({"fake/steady": list(SCRIPT)})
    events = run_graph({"data_path": write_csv(table)}, llm=llm)
    return events, llm


def test_changing_the_test_year_changes_nothing_that_was_chosen_before_the_final_test(run_graph, write_csv):
    base = make_table()
    a, llm_a = run_with(run_graph, write_csv, base)
    b, llm_b = run_with(run_graph, write_csv, perturbed(base))

    assert [(r.system, r.user) for r in llm_a.requests] == [(r.system, r.user) for r in llm_b.requests]  # every prompt
    sa, sb = merged_state(a), merged_state(b)
    for key in ("split", "explore", "baseline_validation_mae", "reference_validation", "attempts", "rounds", "rejections",
                "llm_best", "forward_best", "forward_set", "rounds_used", "no_improve"):
        assert sa.get(key) == sb.get(key), key
    # every event up to (not including) the final test is identical
    cut = nodes_of(a).index("final_test")
    assert a[:cut] == b[:cut]
    # ...and the final test itself does respond to the test year
    assert sa["final"]["test_mae"] != sb["final"]["test_mae"]


def test_the_test_year_row_count_is_the_only_thing_the_split_step_reports_about_it(run_graph, write_csv):
    split = merged_state(run_with(run_graph, write_csv, make_table())[0])["split"]
    assert set(split) == {"test_year", "test_n", "checks", "first_year"}
    assert all(set(c) == {"year", "n", "earlier_years"} for c in split["checks"])
    assert [c["year"] for c in split["checks"]] == [split["test_year"] - 3, split["test_year"] - 2, split["test_year"] - 1]


def test_no_prompt_mentions_a_test_year_value(run_graph, write_csv):
    table = make_table()
    _, llm = run_with(run_graph, write_csv, table)
    rolling = rolling_checks(table.assign(match_date=pd.to_datetime(table["match_date"])))
    test_totals = {str(int(v)) for v in rolling.test_rows()["final_total"].unique()[:5]}
    for request in llm.requests:
        for line in request.user.splitlines():
            if line.startswith("- Round") or "ATTEMPTS" in line or "CATALOGUE" in line:
                continue
        assert "test" not in request.user.lower().replace("latest", "")
    assert test_totals  # the check above is meaningful: there were values to leak
