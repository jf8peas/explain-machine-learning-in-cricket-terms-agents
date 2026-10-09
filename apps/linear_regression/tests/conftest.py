"""Shared test helpers: synthetic innings tables written to temp CSV files."""
from __future__ import annotations

import os

# Tests never reach the network: the app under test uses the scripted fake model, and an in-process limit store.
os.environ["LLM_PROVIDER"] = "fake"
os.environ.setdefault("RATE_LIMIT_STORE", "memory")

import numpy as np
import pandas as pd
import pytest

from linreg.features import add_derived
from linreg.graph import build_graph
from linreg.state import RECURSION_LIMIT


def make_table(years=(2019, 2020, 2021, 2022, 2023, 2024, 2025), per_year=150, mode="noisy", seed=1) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    n = 0
    for y in years:
        for _ in range(per_year):
            n += 1
            runs = int(rng.normal(75, 15))
            wk = int(min(9, rng.poisson(2.5)))
            pp = int(min(runs, max(0, runs * 0.55 + rng.normal(0, 4))))
            if mode == "exact_double":      # TV projection is perfect
                final = runs * 2
            elif mode == "offset":          # model is perfect, TV projection is poor
                final = runs + 80
            else:
                final = int(runs * 1.6 + 30 - 6 * wk + rng.normal(0, 18))
            rows.append({"match_id": str(n), "match_date": f"{y}-06-{1 + n % 27:02d}",
                         "season": str(y), "competition": ["ipl", "bbl", "t20i"][n % 3],
                         "venue": "Ground", "runs_at_10": runs, "wickets_at_10": wk,
                         "powerplay_runs": pp, "final_total": final})
    df = pd.DataFrame(rows)
    # The extra candidate columns come from their own random stream, so the original columns (and every test that
    # depends on them) are unchanged. They are plausible and consistent: the parts add up to the totals.
    extra = np.random.default_rng(seed + 1000)
    n = len(df)
    pp_wickets = np.minimum(df["wickets_at_10"], extra.poisson(1.0, n))
    df["powerplay_wickets"] = pp_wickets
    df["runs_overs_7_10"] = df["runs_at_10"] - df["powerplay_runs"]
    df["wickets_overs_7_10"] = df["wickets_at_10"] - pp_wickets
    df["fours_at_10"] = extra.poisson(6, n)
    df["sixes_at_10"] = extra.poisson(2, n)
    df["dot_balls_at_10"] = extra.poisson(22, n)
    df["extras_at_10"] = extra.poisson(3, n)
    df["partnership_runs"] = np.minimum(df["runs_at_10"], extra.poisson(25, n))
    df["balls_since_last_wicket"] = np.minimum(60, extra.poisson(20, n))
    # Teams and population: league sides are franchises (flags 0); the internationals are between two full members, so
    # every innings is in the test population unless a test says otherwise.
    international = df["competition"] == "t20i"
    df["batting_team"] = np.where(international, "India", "Franchise A")
    df["bowling_team"] = np.where(international, "Australia", "Franchise B")
    df["batting_full_member"] = international.astype(int)
    df["bowling_full_member"] = international.astype(int)
    df["in_test_population"] = 1
    return add_derived(df)  # wickets in hand, runs x wickets in hand and the competition dummies, from the recipes


@pytest.fixture
def write_csv(tmp_path):
    def _write(df: pd.DataFrame, name="innings.csv") -> str:
        p = tmp_path / name
        df.to_csv(p, index=False)
        return str(p)
    return _write


def make_config(model_id: str = "fake/steady", model_name: str = "Fast", **extra) -> dict:
    """A run config for tests: a generous budget and a model id the fake knows. Extra keys override."""
    from linreg.run_budget import RunBudget
    cfg = {"model_id": model_id, "model_name": model_name, "llm_allowed": True,
           "budget": RunBudget(deadline=float("inf") / 2, max_calls=100, call_timeout=25.0, reserve=0.0)}
    cfg.update(extra)
    return cfg


@pytest.fixture
def run_graph():
    """Run the compiled graph with a scripted fake model; returns the list of (node, update) events.

    run_graph(initial, llm=None, **config_overrides): `llm` defaults to the end-to-end fake (model ids fake/steady,
    fake/quick, fake/broken and so on); keyword arguments override the run config (model_id, llm_allowed, budget...).
    """
    from linreg.llm_fake import default_fake

    def _run(initial, llm=None, **config):
        client = llm or default_fake()
        events = []
        for chunk in build_graph(client).stream(
                initial, stream_mode="updates",
                config={"recursion_limit": RECURSION_LIMIT, "configurable": make_config(**config)}):
            (node, update), = chunk.items()
            events.append((node, update))
        return events
    return _run


LIST_KEYS = ("attempts", "rounds", "rejections")


def merged_state(events) -> dict:
    """Fold the (node, update) events into the final run state (the list keys accumulate, as in the graph)."""
    state: dict = {}
    for _, update in events:
        for key, value in update.items():
            if key in LIST_KEYS:
                state[key] = list(state.get(key, [])) + list(value)
            else:
                state[key] = value
    return state


def nodes_of(events) -> list[str]:
    return [n for n, _ in events]
