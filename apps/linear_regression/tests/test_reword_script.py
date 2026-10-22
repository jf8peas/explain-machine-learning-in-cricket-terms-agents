"""scripts/reword_recorded_run.py (feature 021, FR-012): it puts a recording in today's words from the facts the file holds,
changing no number, no proposal reason and not the data fingerprint, and it refuses a recording made on other data."""
import copy
import json
from pathlib import Path

import pytest

from reword_recorded_run import RewordError, check_only_wording_changed, dump, reword, reworded

FIXTURE = Path(__file__).resolve().parent.parent / "web" / "tests" / "fixtures" / "recorded-run.fake.json"


@pytest.fixture(scope="module")
def current():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def old_wording(recording: dict) -> dict:
    """The recording as it was before feature 021: the old names put back into the strings the script rebuilds."""
    old = copy.deepcopy(recording)
    for ev in old["events"]:
        ev["summary"] = ev["summary"].replace("brute-force search", "rival").replace("average-total guess", "know-nothing guess")
        final = ev["changes"].get("final")
        if final:
            final["winner_name"] = "forward selection"
            final["winner_reason"] = "forward selection's best candidate model had the lower average validation error"
            for d in final["method_defs"]:
                d["name"] = d["name"].replace("average-total guess", "know-nothing guess")
    old.pop("wording_version", None)
    return old


def test_rewording_a_current_recording_changes_nothing(current):
    assert reworded(current) == current


def test_the_old_wording_is_put_back_in_todays_words_and_only_the_words(current):
    old = old_wording(current)
    new = reworded(old)
    assert new["events"] == current["events"]
    assert new["wording_version"] == current["wording_version"]
    assert new["fingerprint"] == old["fingerprint"]


def test_it_is_idempotent(current):
    old = old_wording(current)
    once = reworded(old)
    assert reworded(once) == once


def test_the_agents_reasoning_and_every_number_are_untouched(current):
    old = old_wording(current)
    for ev in old["events"]:
        for p in ([ev["changes"]["proposal"]] if ev["changes"].get("proposal") else []):
            p["reason"] = "Forward selection is the rival here, in my own words."
    new = reworded(old)
    reasons = [ev["changes"]["proposal"]["reason"] for ev in new["events"] if ev["changes"].get("proposal")]
    assert reasons and all(r == "Forward selection is the rival here, in my own words." for r in reasons)
    check_only_wording_changed(old["events"], new["events"])


def test_it_stops_if_a_number_would_change(current):
    tampered = copy.deepcopy(current)
    tampered["events"][-1]["changes"]["explanation"]["facts"]["tv_test_miss"]["display"] = "99.9"
    with pytest.raises(RewordError):
        reworded(tampered)


def test_it_refuses_a_recording_made_on_other_data(current):
    other = {**current, "fingerprint": "sha256:0"}
    with pytest.raises(RewordError, match="other data"):
        reworded(other)


def test_the_file_is_written_the_way_the_recorder_writes_it(current):
    text = dump(current)
    assert text.endswith("\n") and ", " not in text.split('"events"')[0] and json.loads(text) == current
    assert FIXTURE.read_text(encoding="utf-8") == text


def test_reword_alone_does_not_touch_the_fingerprint_or_the_version_rule(current):
    new = reword(old_wording(current))
    assert new["fingerprint"] == current["fingerprint"] and new["wording_version"].startswith("w1-")
