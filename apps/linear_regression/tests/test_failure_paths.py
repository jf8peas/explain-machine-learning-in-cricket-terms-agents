"""When the language model misbehaves the run still completes, with forward selection, and says so plainly."""
import logging

import pytest

from linreg.llm_client import LlmTimeout, LlmUnavailable
from linreg.llm_fake import FakeLlm, reply
from tests.conftest import make_table, merged_state, nodes_of

KEY = "sk-or-FAILURETEST-9999"
DOWN = LlmUnavailable("The language model's provider answered with an error (500).")


@pytest.fixture
def path(write_csv):
    return write_csv(make_table())


def run(run_graph, path, *script):
    llm = FakeLlm({"fake/steady": list(script)})
    return run_graph({"data_path": path}, llm=llm), llm


def assert_completes_without_the_model(events, state):
    names = nodes_of(events)
    assert names[-2:] == ["final_test", "explain_in_cricket_terms"]
    assert "forward_selection" in names and "fit_model" not in names
    assert state["final"]["llm_took_part"] is False and state["final"]["winner"] == "forward"
    assert state["final"]["test_mae"]["llm"] is None
    assert "did not take part" in " ".join(state["explanation"]["sentences"])


@pytest.mark.parametrize("script,kind", [
    ([DOWN, DOWN], "unavailable"),
    ([LlmTimeout("The language model did not reply in time."), LlmTimeout("The language model did not reply in time.")], "timeout"),
    (["this is not json at all"], "unusable"),
    (["{\"features\": \"runs_at_10\"}"], "unusable"),
    ([reply(["runs_at_10"], "Done already.", finished=True)], "finished before any fit"),
])
def test_a_failure_on_the_first_round_sends_the_run_on_with_forward_selection_only(run_graph, path, script, kind):
    events, _ = run(run_graph, path, *script)
    state = merged_state(events)
    assert state["llm_status"] == "failed" and state["llm_failure"]
    propose = [u for n, u in events if n == "propose_features"][0]
    assert propose["summary"].startswith("The language model could not take part") or kind.startswith("finished")
    assert_completes_without_the_model(events, state)


def test_the_failure_is_a_clear_step_with_a_plain_reason(run_graph, path):
    events, _ = run(run_graph, path, DOWN, DOWN)
    update = [u for n, u in events if n == "propose_features"][0]
    assert update["proposal"] is None and "provider answered with an error" in update["llm_failure"]
    assert "forward selection only" in update["summary"]
    check = [u for n, u in events if n == "check_proposal"][0]
    assert check["decision"]["branch"] == "failed"


def test_an_unusable_reply_is_not_retried_but_a_transient_failure_is_retried_once(run_graph, path):
    _, llm = run(run_graph, path, "garbage")
    assert len(llm.requests) == 1
    events, llm = run(run_graph, path, DOWN, reply(["runs_at_10"], "second time lucky"), reply(["runs_at_10"], "done", True))
    assert len(llm.requests) == 3                                      # one retry on the first round, then two normal rounds
    assert merged_state(events)["llm_status"] == "ok"


def test_at_most_one_retry(run_graph, path):
    _, llm = run(run_graph, path, DOWN, DOWN, DOWN, DOWN)
    assert len(llm.requests) == 2


def test_a_host_that_rejects_structured_output_gets_one_retry_without_it(run_graph, path):
    unsupported = LlmUnavailable("provider error (400)", unsupported_format=True)
    events, llm = run(run_graph, path, unsupported, reply(["runs_at_10"], "ok"), reply(["runs_at_10"], "done", True))
    assert llm.requests[0].json_schema is not None and llm.requests[1].json_schema is None
    assert merged_state(events)["llm_status"] == "ok"


def test_a_failure_after_some_rounds_keeps_the_best_set_so_far_and_shows_the_failure(run_graph, path):
    events, _ = run(run_graph, path, reply(["runs_at_10"], "start"), reply(["runs_at_10", "wickets_in_hand"], "next"), DOWN, DOWN)
    state = merged_state(events)
    assert state["llm_status"] == "failed" and "provider answered" in state["llm_failure"]
    assert state["llm_best"] is not None and state["final"]["llm_took_part"] is True
    assert state["final"]["test_mae"]["llm"] is not None
    assert nodes_of(events)[-2:] == ["final_test", "explain_in_cricket_terms"]
    text = " ".join(state["explanation"]["sentences"])
    assert "stopped early" in text and "did not take part" not in text


def test_a_failure_is_logged_on_the_server_with_the_model_and_the_time_never_the_key(run_graph, path, caplog):
    leaky = LlmUnavailable(f"The language model's provider answered with an error (500). {KEY}".replace(KEY, "[redacted]"))
    with caplog.at_level(logging.WARNING, logger="linreg.llm"):
        run(run_graph, path, leaky, leaky)
    records = [r.getMessage() for r in caplog.records if r.name == "linreg.llm"]
    assert records and all("model=fake/steady" in m and "kind=unavailable" in m and "elapsed=" in m for m in records)
    assert all(KEY not in m for m in records)


def test_the_run_never_raises_whatever_the_model_does(run_graph, path):
    for script in ([DOWN], ["", ""], [reply([], "empty")] * 3, [reply(["x"] * 20, "too many")] * 8):
        events, _ = run(run_graph, path, *script, *(script * 2))
        assert nodes_of(events)[-1] == "explain_in_cricket_terms"
