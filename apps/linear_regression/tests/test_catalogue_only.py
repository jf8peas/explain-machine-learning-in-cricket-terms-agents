"""SC-002: across many runs, including hostile replies, no fitted set ever contains a name outside the catalogue."""
import json
import random

import pytest

from linreg import features
from linreg.llm_fake import FakeLlm, reply
from linreg.redundancy import repeating_features
from linreg.state import ROUND_CAP, SET_LIMIT
from tests.conftest import make_table, merged_state

NAMES = features.IDS
HOSTILE = ["net_run_rate", "", "RUNS_AT_10", "Runs_at_10", "runs_at_10 ", "runs at 10", "__proto__", "wickets-in-hand",
           "'; DROP TABLE innings; --", "../../etc/passwd", "final_total", "match_id", "venue", "competition", "is_t20i"]


def random_reply(rng: random.Random) -> str:
    kind = rng.random()
    if kind < 0.1:
        return rng.choice(["not json at all", "{}", "[]", "null", '{"features": "runs_at_10"}', ""])
    size = rng.choice([0, 1, 1, 2, 3, 5, 8, 9, 12])
    pool = NAMES + HOSTILE
    chosen = [rng.choice(pool) for _ in range(size)]
    text = reply(chosen, "A reason, with <b>markup</b> and numbers like 99.9.", finished=rng.random() < 0.15)
    wrap = rng.choice(["{}", "```json\n{}\n```", "Here you go:\n{}\nThanks!"])
    return wrap.format(text) if "{}" in wrap and kind > 0.1 else text


@pytest.mark.parametrize("seed", range(20))
def test_no_fitted_set_is_ever_outside_the_catalogue(run_graph, write_csv, seed):
    rng = random.Random(seed)
    llm = FakeLlm({"fake/steady": [random_reply(rng) for _ in range(ROUND_CAP + 2)]})
    state = merged_state(run_graph({"data_path": write_csv(make_table(years=(2020, 2021, 2022, 2023), per_year=110))}, llm=llm))
    assert state["attempts"], "forward selection always produces attempts"
    for a in state["attempts"]:
        assert set(a["features"]) <= set(NAMES)                         # only catalogue names
        assert 1 <= len(a["features"]) <= SET_LIMIT                     # never empty, never above the limit
        assert len(set(a["features"])) == len(a["features"])            # no name twice
    llm_sets = [tuple(sorted(a["features"])) for a in state["attempts"] if a["proposer"] == "llm"]
    assert len(llm_sets) == len(set(llm_sets))                          # no set tried twice
    assert set(state["features"]) <= set(NAMES)


def test_hostile_names_are_rejected_not_fitted(run_graph, write_csv):
    llm = FakeLlm({"fake/steady": [reply([name], "x") for name in HOSTILE[:6]] + [reply(["runs_at_10"], "x", True)]})
    state = merged_state(run_graph({"data_path": write_csv(make_table())}, llm=llm))
    assert [a for a in state["attempts"] if a["proposer"] == "llm"] == []
    assert {r["code"] for r in state["rejections"]} <= {"unknown_feature", "empty"}
    json.dumps(state["rounds"])  # the rejected names are carried as plain data
