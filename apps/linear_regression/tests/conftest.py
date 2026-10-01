"""Shared test helpers: synthetic innings tables written to temp CSV files."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from linreg.graph import build_graph
from linreg.state import RECURSION_LIMIT


def make_table(years=(2020, 2021, 2022, 2023), per_year=150, mode="noisy", seed=1) -> pd.DataFrame:
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
    return pd.DataFrame(rows)


@pytest.fixture
def write_csv(tmp_path):
    def _write(df: pd.DataFrame, name="innings.csv") -> str:
        p = tmp_path / name
        df.to_csv(p, index=False)
        return str(p)
    return _write


@pytest.fixture
def run_graph():
    """Run the compiled graph, returning the list of (node, update) events."""
    def _run(initial):
        events = []
        for chunk in build_graph().stream(initial, stream_mode="updates",
                                          config={"recursion_limit": RECURSION_LIMIT}):
            (node, update), = chunk.items()
            events.append((node, update))
        return events
    return _run
