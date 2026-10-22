"""The scripted fake-model run the page's tests use (web/tests/fixtures/fake-run.json) is what the fake model streams now.
Rebuild it with `uv run python tests/make_fake_run.py` when this fails."""
import json

from tests.make_fake_run import FIXTURE, build


def test_the_fixture_is_what_a_fake_run_streams_now():
    assert json.loads(FIXTURE.read_text(encoding="utf-8")) == build()


def test_the_fixture_has_the_shape_the_tests_read():
    run = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert set(run) == {"model_name", "events", "done"}
    assert run["done"] == {"steps": len(run["events"])}
    assert [e["step"] for e in run["events"]] == list(range(1, len(run["events"]) + 1))
    assert all(set(e) == {"step", "node", "summary", "changes"} for e in run["events"])
    assert "fake/" not in json.dumps(run)                       # a model id is never in a run's events
    assert "final" in run["events"][-3]["changes"]               # it reaches the final test
