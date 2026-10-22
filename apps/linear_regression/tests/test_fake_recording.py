"""The scripted recording the page's tests play (web/tests/fixtures/recorded-run.fake.json) is what the recorder produces now:
the same steps, in the same order, for the same data. Regenerate it with
`uv run python scripts/record_run.py --fake --out web/tests/fixtures/recorded-run.fake.json` when this fails."""
import json
from pathlib import Path

import pytest

from record_run import RecordingError, parse_stream, record

FIXTURE = Path(__file__).resolve().parent.parent / "web" / "tests" / "fixtures" / "recorded-run.fake.json"


@pytest.fixture(scope="module")
def fresh():
    return record(fake=True)


def test_the_fixture_is_what_the_recorder_makes_now(fresh):
    stored = json.loads(FIXTURE.read_text(encoding="utf-8"))
    for key in ("model_name", "fingerprint", "scripted", "done", "events"):
        assert stored[key] == fresh[key], key


def test_the_recording_has_the_shape_the_page_reads(fresh):
    assert set(fresh) == {"recorded_on", "model_name", "fingerprint", "events", "done", "scripted"}
    assert fresh["fingerprint"].startswith("sha256:") and fresh["done"] == {"steps": len(fresh["events"])}
    assert [e["step"] for e in fresh["events"]] == list(range(1, len(fresh["events"]) + 1))
    assert all(set(e) == {"step", "node", "summary", "changes"} for e in fresh["events"])
    assert "fake/" not in json.dumps(fresh)                             # a model id is never recorded


def test_a_run_that_fails_or_has_no_headlines_is_not_recorded():
    with pytest.raises(RecordingError, match="boom"):
        parse_stream(['event: error\ndata: {"message": "boom"}\n\n'])
    with pytest.raises(RecordingError, match="did not finish"):
        parse_stream(['event: step\ndata: {"step": 1, "node": "load_data", "summary": "", "changes": {}}\n\n'])
