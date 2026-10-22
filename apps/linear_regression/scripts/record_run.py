"""Owner tool: record one run of the agent, to be played back by the page instead of a live run (needs OPENROUTER_API_KEY).

    uv run python scripts/record_run.py [--out PATH] [--env-file PATH]
    uv run python scripts/record_run.py --fake --out web/tests/fixtures/recorded-run.fake.json

It runs the real graph on the real data with the default model on the owner's list, exactly as /api/run does, and writes the
events that route streams, with the day, the model's display name (never its id) and a fingerprint of the data. By default
it writes web/public/recorded-run.json. `--fake` uses the scripted stand-in model (no key, no network) and marks the file
`"scripted": true`; the page's tests use that file and the release check refuses to ship it.

Record again whenever the data is rebuilt (a change of wording alone only needs scripts/reword_recorded_run.py): tests/test_recorded_run.py fails until you do.
A run that failed, or that has no headlines, is never written. The key is read from the environment only and never printed.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any, Mapping

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from linreg.fingerprint import data_fingerprint  # noqa: E402
from linreg.graph import build_graph  # noqa: E402
from linreg.graph_api import run_events  # noqa: E402
from linreg.llm_client import OpenRouterClient  # noqa: E402
from linreg.methods import terms_version  # noqa: E402
from linreg.llm_fake import FAKE_MODEL_OPTIONS, default_fake  # noqa: E402
from linreg.model_options import ModelOptions  # noqa: E402
from linreg.run_budget import RunBudget  # noqa: E402
from linreg.state import RECURSION_LIMIT  # noqa: E402

DEFAULT_OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "recorded-run.json"


class RecordingError(Exception):
    """The run did not finish cleanly, so there is nothing worth recording."""


def parse_stream(chunks) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """The `step` events and the closing `done` payload from the SSE blocks run_events yields; an `error` event is fatal."""
    steps: list[dict[str, Any]] = []
    done: dict[str, Any] | None = None
    for block in chunks:
        lines = block.strip().split("\n")
        event, data = lines[0].removeprefix("event: "), json.loads(lines[1].removeprefix("data: "))
        if event == "error":
            raise RecordingError(data.get("message", "the run failed"))
        if event == "step":
            steps.append(data)
        elif event == "done":
            done = data
    if done is None:
        raise RecordingError("the run did not finish")
    return steps, done


def record(*, fake: bool, environ: Mapping[str, str] | None = None, today: date | None = None) -> dict[str, Any]:
    """Run the graph once and return the recording."""
    env = dict(os.environ if environ is None else environ)
    if fake:
        env["MODEL_OPTIONS"] = json.dumps(FAKE_MODEL_OPTIONS)
    options = ModelOptions.from_env(env)
    model = options.default
    llm = default_fake() if fake else OpenRouterClient()
    if not fake and not env.get("OPENROUTER_API_KEY"):
        raise RecordingError("OPENROUTER_API_KEY is not set")
    configurable = {"model_id": model.id, "model_name": model.name, "llm_allowed": True,
                    "budget": RunBudget.from_env(time.monotonic(), env)}
    steps, done = parse_stream(run_events(build_graph(llm), {}, RECURSION_LIMIT, configurable))
    final_step = next((s for s in steps if s["node"] == "final_test"), None)
    headlines = ((final_step or {}).get("changes", {}).get("final") or {}).get("headlines")
    if not headlines:
        raise RecordingError("the run has no final test with headlines, so it is not recorded")
    first = steps[0]["changes"]
    if first.get("data_error"):
        raise RecordingError(f"the data could not be loaded: {first['data_error']}")
    out: dict[str, Any] = {"recorded_on": (today or date.today()).isoformat(), "model_name": model.name,
                           "fingerprint": data_fingerprint(), "events": steps, "done": done,
                           "wording_version": terms_version()}
    if fake:
        out["scripted"] = True
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="where to write the recording")
    parser.add_argument("--fake", action="store_true", help="use the scripted stand-in model (for tests; not shippable)")
    parser.add_argument("--env-file", help="read KEY=VALUE lines from this file first; values already set win")
    args = parser.parse_args(argv)
    if args.env_file:
        for line in Path(args.env_file).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                name, value = line.split("=", 1)
                os.environ.setdefault(name.strip(), value.strip())
    try:
        recording = record(fake=args.fake)
    except RecordingError as exc:
        print(f"Not recorded: {exc}", file=sys.stderr)
        return 1
    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(recording, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    size = path.stat().st_size
    print(f"Recorded {len(recording['events'])} steps with {recording['model_name']} on {recording['recorded_on']}: "
          f"{path} ({size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
