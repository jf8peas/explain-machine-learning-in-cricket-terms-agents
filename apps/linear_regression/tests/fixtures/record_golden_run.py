"""Records the agent's run on the committed data as tests/fixtures/golden_run.json.

Run ONCE, from the code and data as they were before the competition-dummies feature:
    uv run python tests/fixtures/record_golden_run.py
tests/test_run_unchanged.py then proves the run is identical afterwards. Do not re-record it
unless the agent is changed on purpose.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(APP / "backend"))

from linreg.graph import build_graph  # noqa: E402
from linreg.graph_api import to_jsonable  # noqa: E402
from linreg.state import RECURSION_LIMIT  # noqa: E402

ORIGINAL_COLUMNS = ["match_id", "match_date", "season", "competition", "venue",
                    "runs_at_10", "wickets_at_10", "powerplay_runs", "final_total"]


def original_columns_sha256(csv_path: Path) -> str:
    """Hash of the header and rows of the original nine columns, read as text (line endings do not matter)."""
    digest = hashlib.sha256()
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            digest.update(json.dumps([row[c] for c in ORIGINAL_COLUMNS]).encode("utf-8"))
            digest.update(b"\n")
    digest.update(json.dumps(ORIGINAL_COLUMNS).encode("utf-8"))
    return digest.hexdigest()


def record_events() -> list[dict]:
    events = []
    for chunk in build_graph().stream({}, stream_mode="updates", config={"recursion_limit": RECURSION_LIMIT}):
        (node, update), = chunk.items()
        events.append({"node": node, "update": to_jsonable(update)})
    return events


if __name__ == "__main__":
    out = Path(__file__).with_name("golden_run.json")
    golden = {"innings_sha256": original_columns_sha256(APP / "data" / "innings.csv"), "events": record_events()}
    out.write_text(json.dumps(golden, indent=1), encoding="utf-8")
    print(f"Recorded {len(golden['events'])} steps to {out.name}")
