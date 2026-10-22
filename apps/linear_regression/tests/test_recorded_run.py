"""The recording the page plays (web/public/recorded-run.json) must match the data and the headline wording now in the code
(feature 020, FR-019): a rebuilt data set or a reworded headline fails here until the run is recorded again."""
import json
from pathlib import Path

import pytest

from linreg import headlines
from linreg.fingerprint import DATA_FILES, data_fingerprint

WEB = Path(__file__).resolve().parent.parent / "web"
SHIPPED = WEB / "public" / "recorded-run.json"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def folded_state(events: list[dict], upto: str) -> dict:
    """The run state after the step for `upto`, folding the streamed changes the way the page does."""
    state: dict = {}
    for event in events:
        state.update(event["changes"])
        if event["node"] == upto:
            break
    return state


def test_the_fingerprint_changes_with_the_manifest_and_with_each_data_file(tmp_path):
    for name, text in (("manifest.json", "{}"), ("innings.csv", "a"), ("overs.csv", "b")):
        (tmp_path / name).write_text(text, encoding="utf-8")
    base = data_fingerprint(tmp_path)
    assert base == data_fingerprint(tmp_path) and base.startswith("sha256:")
    (tmp_path / "manifest.json").write_text('{"x": 1}', encoding="utf-8")
    assert data_fingerprint(tmp_path) != base
    (tmp_path / "manifest.json").write_text("{}", encoding="utf-8")
    for name in DATA_FILES:
        (tmp_path / name).write_text("longer", encoding="utf-8")
        assert data_fingerprint(tmp_path) != base
        (tmp_path / name).write_text("a" if name == "innings.csv" else "b", encoding="utf-8")
    assert data_fingerprint(tmp_path) == base


@pytest.mark.parametrize("path", [SHIPPED, WEB / "tests" / "fixtures" / "recorded-run.fake.json"], ids=["shipped", "fake fixture"])
def test_the_recording_was_made_against_the_current_data(path):
    assert load(path)["fingerprint"] == data_fingerprint(), f"{path.name} is stale: record the run again (scripts/record_run.py)"


@pytest.mark.parametrize("path", [SHIPPED, WEB / "tests" / "fixtures" / "recorded-run.fake.json"], ids=["shipped", "fake fixture"])
def test_the_recorded_headlines_are_what_the_code_builds_from_the_recorded_figures(path):
    events = load(path)["events"]
    state = folded_state(events, "final_test")
    shown = state["final"]["accuracy"]
    rebuilt = headlines.build(
        agent_miss=shown["llm"]["average_miss"] if "llm" in shown else None,
        search_miss=shown["forward"]["average_miss"] if "forward" in shown else None,
        tv_miss=shown["broadcaster"]["average_miss"], tries=state["rounds_used"])
    assert state["final"]["headlines"] == rebuilt, f"{path.name} has old headline wording: record the run again"


@pytest.mark.release
def test_shipped_run_is_real():
    """The recording that ships is a real run, not the scripted stand-in (run with `pytest -m release` before releasing)."""
    assert not load(SHIPPED).get("scripted"), "web/public/recorded-run.json is the scripted stand-in: record the real run"
