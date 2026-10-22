"""The closing language-model step (features 012 and 015): what it asks, what is shown, and that nothing it does can fail
the run. The model writes only the three takeaways; the verdict and the rule of thumb are code only."""
import time

import pytest

from linreg import cricket_blocks, features
from linreg.llm_client import LlmTimeout, LlmUnavailable
from linreg.llm_fake import FakeLlm, reply, valid_writing, writing_reply
from linreg.prompts import WRITING_MARKER
from linreg.run_budget import RunBudget
from tests.conftest import explanation_text, make_table, merged_state, nodes_of
from tests.test_explanation_numbers import check_section_numbers
from tests.test_final_test import SCRIPT

MODEL = "fake/steady"


@pytest.fixture
def path(write_csv):
    return write_csv(make_table())


def run(run_graph, path, writer=None, **config):
    llm = FakeLlm({MODEL: list(SCRIPT)}, writers={MODEL: writer} if writer is not None else None)
    events = run_graph({"data_path": path}, llm=llm, **config)
    return events, llm, merged_state(events)


def block(title="A title", *sentences):
    return {"title": title, "sentences": list(sentences) or ["The TV missed by {tv_test_miss} runs."]}


def test_a_valid_reply_is_shown_with_every_placeholder_filled_by_a_fact(run_graph, path):
    events, llm, state = run(run_graph, path)
    assert nodes_of(events)[-2:] == ["explain_in_cricket_terms", "write_in_cricket_terms"]
    expl = state["explanation"]
    assert expl["source"] == "language model" and expl["model"] == "Fast" and expl["fallback_reason"] is None
    assert len(llm.writing_requests) == 1
    assert expl["order"] == ["verdict", "takeaway_run_rate", "takeaway_drivers", "takeaway_tv", "rule_of_thumb"]
    text = explanation_text(expl)
    assert "{" not in text and "}" not in text
    check_section_numbers(expl)
    by = {b["id"]: b for b in expl["blocks"]}
    assert by["verdict"]["from_model"] == [] and by["rule_of_thumb"]["from_model"] == []     # code only: never the model's words
    assert all(by[i]["from_model"] for i in ("takeaway_run_rate", "takeaway_drivers", "takeaway_tv"))
    templates = {b["id"]: b for b in cricket_blocks.build_blocks(expl["facts"], features.labels(), list(state["features"]))}
    for code_only in cricket_blocks.CODE_ONLY:
        assert by[code_only]["title"] == templates[code_only]["title"] and by[code_only]["sentences"] == templates[code_only]["sentences"]
    assert f'{abs(state["final"]["improvement"]):.1f}' in by["verdict"]["sentences"][0]


def test_the_model_is_given_the_facts_the_blocks_and_the_rules_and_never_the_final_numbers_as_free_text(run_graph, path):
    _, llm, state = run(run_graph, path)
    req = llm.writing_requests[0]
    assert WRITING_MARKER in req.system and "Never write a number" in req.system and "{wicket_cost}" in req.system
    assert "{tv_bias_direction}" in req.system and "take off" in req.system         # direction words come from placeholders
    for fid in state["explanation"]["facts"]:
        assert f"- {{{fid}}}:" in req.user
    for bid in ("takeaway_run_rate", "takeaway_drivers", "takeaway_tv"):
        assert f"- {bid}:" in req.user
    for bid in ("verdict", "rule_of_thumb", "drivers", "wicket", "how_chosen", "closing"):
        assert f"- {bid}:" not in req.user                                               # code only, or no longer blocks
    assert req.json_schema is not None and req.model == MODEL


@pytest.mark.parametrize("bad", [
    writing_reply({"takeaway_tv": block("Fine", "The TV missed by 18 runs.")}),            # a digit
    writing_reply({"takeaway_tv": block("Fine", "The TV guesses too low.")}),                # a direction word
    writing_reply({"takeaway_run_rate": block("Add a few runs")}),                          # a direction word in a title
    writing_reply({"takeaway_tv": block("Fine", "It cost {made_up} runs.")}),               # an unknown placeholder
    writing_reply({"takeaway_tv": block("x" * 80)}),                                        # a title over its limit
    writing_reply({"takeaway_tv": block("Fine", "y" * 300)}),                               # a sentence over its limit
    "this is not json",
    "",
])
def test_a_rejected_reply_is_never_shown_and_the_template_wording_stays(run_graph, path, bad):
    events, _, state = run(run_graph, path, writer=bad)
    expl = state["explanation"]
    assert expl["source"] == "template" and expl["model"] is None
    assert "templates" in expl["fallback_reason"]
    templates = cricket_blocks.build_blocks(expl["facts"], features.labels(), list(state["features"]))
    assert [b["title"] for b in expl["blocks"]] == [b["title"] for b in templates]
    assert nodes_of(events)[-1] == "write_in_cricket_terms"
    check_section_numbers(expl)


@pytest.mark.parametrize("bad,words", [
    (writing_reply({"takeaway_tv": block("Fine", "The TV missed by 18 runs.")}), ["sentence in takeaway_tv", "number written by the model"]),
    (writing_reply({"takeaway_tv": block("The 10th over")}), ["title of takeaway_tv", "number written by the model"]),
    (writing_reply({"takeaway_tv": block("Fine", "It guesses too high.")}), ["sentence in takeaway_tv", "direction word"]),
    (writing_reply({"takeaway_run_rate": block("Take off a few")}), ["title of takeaway_run_rate", "direction word"]),
    (writing_reply({"takeaway_tv": block("Fine", "It cost {made_up} runs.")}), ["does not exist", "made_up"]),
    (writing_reply({"takeaway_tv": block("x" * 80)}), ["title of takeaway_tv", "over 50 characters"]),
    (writing_reply({"takeaway_tv": block("Fine", "y" * 300)}), ["sentence in takeaway_tv", "over 130 characters"]),
    (writing_reply({"takeaway_tv": block("Fine", "One.", "Two.", "Three.")}), ["takeaway_tv", "more than 2 sentences"]),
    ("this is not json", ["not valid JSON"]),
    ("{}", ["no blocks"]),
])
def test_the_cause_of_a_rejection_is_in_the_line_the_page_shows_and_in_the_log(run_graph, path, caplog, bad, words):
    with caplog.at_level("WARNING", logger="linreg.llm"):
        _, _, state = run(run_graph, path, writer=bad)
    line = state["explanation"]["fallback_reason"]
    assert line.startswith("The AI agent's wording could not be used (") and line.endswith("so the wording is from templates.")
    for word in words:
        assert word in line, (word, line)
    logged = " ".join(r.getMessage() for r in caplog.records if "writing reply unusable" in r.getMessage())
    assert words[0] in logged                                          # the same reason, in the server log


def test_the_reason_never_carries_the_models_own_wording(run_graph, path):
    _, _, state = run(run_graph, path, writer=writing_reply({"takeaway_tv": block("Fine", "It cost {<script>alert_x</script>} runs.")}))
    line = state["explanation"]["fallback_reason"]
    assert "<" not in line and "alert" not in line          # the model's own text is never put in the line
    _, _, state = run(run_graph, path, writer=writing_reply({"takeaway_tv": block("Fine", "It cost {" + "z" * 200 + "} runs.")}))
    assert "z" * 41 not in state["explanation"]["fallback_reason"]          # a long made-up name is cut down


def test_a_reply_that_leaves_out_a_block_keeps_that_blocks_template_and_the_models_wording_elsewhere(run_graph, path):
    events, _, state = run(run_graph, path, writer=writing_reply({"takeaway_tv": block("The model's third takeaway")}))
    expl = state["explanation"]
    by = {b["id"]: b for b in expl["blocks"]}
    templates = {b["id"]: b for b in cricket_blocks.build_blocks(expl["facts"], features.labels(), list(state["features"]))}
    assert expl["source"] == "language model" and by["takeaway_tv"]["title"] == "The model's third takeaway"
    assert by["takeaway_drivers"]["title"] == templates["takeaway_drivers"]["title"]
    assert by["takeaway_run_rate"]["sentences"] == templates["takeaway_run_rate"]["sentences"]


def test_the_verdict_and_rule_of_thumb_are_never_the_models_even_when_it_writes_them(run_graph, path):
    reply_ = writing_reply({"verdict": block("The model's verdict"), "rule_of_thumb": block("The model's rule"),
                            "takeaway_tv": block("Fine")})
    _, _, state = run(run_graph, path, writer=reply_)
    by = {b["id"]: b for b in state["explanation"]["blocks"]}
    assert by["verdict"]["title"] != "The model's verdict" and by["rule_of_thumb"]["title"] != "The model's rule"
    assert by["verdict"]["from_model"] == [] and by["rule_of_thumb"]["from_model"] == []
    assert by["takeaway_tv"]["title"] == "Fine"


def test_a_reply_that_tries_to_add_a_block_cannot_put_one_on_the_page(run_graph, path):
    _, _, state = run(run_graph, path, writer=writing_reply({"takeaway_tv": block(), "bonus": block("An extra block")}))
    assert "bonus" not in [b["id"] for b in state["explanation"]["blocks"]]
    assert "bonus" not in state["explanation"]["order"]


def test_the_order_is_always_the_fixed_one(run_graph, path):
    reply_ = '{"blocks": {"takeaway_tv": {"title": "Fine"}}, "order": ["rule_of_thumb", "bonus"], "closing_lead": "biggest_factor"}'
    _, _, state = run(run_graph, path, writer=reply_)
    assert state["explanation"]["order"] == ["verdict", "takeaway_run_rate", "takeaway_drivers", "takeaway_tv", "rule_of_thumb"]
    assert "closing_lead" not in state["explanation"]


@pytest.mark.parametrize("error", [LlmTimeout("The language model did not reply in time."), LlmUnavailable("It is down."),
                                   RuntimeError("something unexpected")])
def test_a_failing_call_keeps_the_templates_and_the_run_completes(run_graph, path, error):
    events, _, state = run(run_graph, path, writer=[error])
    assert nodes_of(events)[-1] == "write_in_cricket_terms" and state["final"]
    assert state["explanation"]["source"] == "template" and state["explanation"]["fallback_reason"]
    assert [b["id"] for b in state["explanation"]["blocks"]][0] == "verdict"


def test_the_model_not_taking_part_means_no_call_and_a_line_saying_so(run_graph, path):
    llm = FakeLlm({MODEL: [reply(["runs_at_10"], "x", finished=True)]})          # finished before any set: the model fails
    events = run_graph({"data_path": path}, llm=llm)
    state = merged_state(events)
    assert llm.writing_requests == []
    assert state["explanation"]["source"] == "template" and "did not take part" in state["explanation"]["fallback_reason"]


def test_a_model_that_is_not_allowed_is_not_asked(run_graph, path):
    events, llm, state = run(run_graph, path, llm_allowed=False)
    assert llm.writing_requests == [] and state["explanation"]["source"] == "template"


def test_no_budget_means_no_call(run_graph, path):
    spent = RunBudget(deadline=float("inf") / 2, max_calls=100, call_timeout=25.0, reserve=0.0)
    spent.calls = 200
    events, llm, state = run(run_graph, path, budget=spent)
    assert llm.writing_requests == [] and state["explanation"]["source"] == "template"
    assert "budget" in state["explanation"]["fallback_reason"] or "did not take part" in state["explanation"]["fallback_reason"]


def test_markup_in_the_models_wording_is_kept_as_text(run_graph, path):
    _, _, state = run(run_graph, path, writer=lambda request: valid_writing(request, markup=True))
    text = explanation_text(state["explanation"])
    assert "<script>" in text and state["explanation"]["source"] == "language model"


def test_the_writing_call_counts_towards_the_runs_calls_and_the_proposing_cap_is_unchanged(run_graph, path):
    budget = RunBudget(deadline=float("inf") / 2, max_calls=3, call_timeout=25.0, reserve=0.0)
    events, llm, state = run(run_graph, path, budget=budget)
    assert len(llm.requests) == 3 and len(llm.writing_requests) == 1 and budget.calls == 4
    assert state["explanation"]["source"] == "language model"


def test_a_slow_model_cannot_make_the_run_wait_past_its_deadline(run_graph, path):
    def slow(request):
        raise LlmTimeout("The language model did not reply in time.")
    started = time.perf_counter()
    events, _, state = run(run_graph, path, writer=slow)
    assert time.perf_counter() - started < 30 and state["final"]


def test_the_section_with_the_models_words_is_not_longer_than_the_limits_allow(run_graph, path):
    _, _, state = run(run_graph, path)
    for b in state["explanation"]["blocks"]:
        assert len(b["sentences"]) <= cricket_blocks.max_sentences(b["id"])
