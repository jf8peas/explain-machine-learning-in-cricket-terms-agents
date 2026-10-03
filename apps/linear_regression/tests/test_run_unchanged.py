"""FR-017 / SC-003: the agent's run on the committed data is identical to the run recorded before the dummies existed.

tests/fixtures/golden_run.json was recorded from the pre-feature code (see tests/fixtures/record_golden_run.py).
Same steps, same features, same errors and same explanation means every event, in order, is equal.
"""
import json
from pathlib import Path

from linreg.graph_api import to_jsonable

GOLDEN = json.loads((Path(__file__).parent / "fixtures" / "golden_run.json").read_text(encoding="utf-8"))


def test_the_run_matches_the_recorded_run_step_for_step(run_graph):
    events = [{"node": node, "update": to_jsonable(update)} for node, update in run_graph({})]
    assert [e["node"] for e in events] == [e["node"] for e in GOLDEN["events"]]  # same steps
    assert events == GOLDEN["events"]  # same features, errors, numbers and explanation


def test_the_dummies_are_not_model_inputs(run_graph):
    from linreg.state import FEATURE_ORDER
    assert not any(f.startswith("is_") for f in FEATURE_ORDER)
    for _, update in run_graph({}):
        assert not any("is_ipl" in str(v) or "is_bbl" in str(v) for v in update.values())
