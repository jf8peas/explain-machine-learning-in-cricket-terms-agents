"""Builds the scripted fake-model run that tests use as a fixture (feature 022): the `step` events a run streams, the model's display
name and the closing `done`. It runs the real graph on the committed data with the scripted fake model, in process: no model, no
network, nothing shipped. Rebuild the fixture with `uv run python tests/make_fake_run.py` after a change to the agent's wording or to
the fake model; tests/test_fake_run_fixture.py fails while it is stale."""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("LLM_PROVIDER", "fake")

from linreg.graph import build_graph  # noqa: E402
from linreg.graph_api import run_events  # noqa: E402
from linreg.llm_fake import FAKE_MODEL_OPTIONS, default_fake  # noqa: E402
from linreg.model_options import ModelOptions  # noqa: E402
from linreg.run_budget import RunBudget  # noqa: E402
from linreg.state import RECURSION_LIMIT  # noqa: E402

FIXTURE = ROOT / "web" / "tests" / "fixtures" / "fake-run.json"


def build() -> dict[str, Any]:
    """The events of one scripted fake-model run, as the page receives them (without the `start` events)."""
    env = {"MODEL_OPTIONS": json.dumps(FAKE_MODEL_OPTIONS)}
    model = ModelOptions.from_env(env).default
    configurable = {"model_id": model.id, "model_name": model.name, "llm_allowed": True,
                    "budget": RunBudget.from_env(time.monotonic(), env)}
    steps: list[dict[str, Any]] = []
    done: dict[str, Any] | None = None
    for block in run_events(build_graph(default_fake()), {}, RECURSION_LIMIT, configurable):
        lines = block.strip().split("\n")
        event, data = lines[0].removeprefix("event: "), json.loads(lines[1].removeprefix("data: "))
        if event == "error":
            raise RuntimeError(data.get("message", "the run failed"))
        if event == "step":
            steps.append(data)
        elif event == "done":
            done = data
    if done is None:
        raise RuntimeError("the run did not finish")
    return {"model_name": model.name, "events": steps, "done": done}


def dump(run: dict[str, Any]) -> str:
    return json.dumps(run, ensure_ascii=False, separators=(",", ":")) + "\n"


if __name__ == "__main__":
    FIXTURE.write_text(dump(build()), encoding="utf-8")
    print(f"Wrote {FIXTURE}")
