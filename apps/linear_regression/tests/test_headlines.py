"""The page's headline words (feature 020): worked out on the server from the displayed final-test figures, judging the AGENT's
own model against the goal, and never claiming more than those figures show. The cases are shared with the page's tests."""
import json
from pathlib import Path

import pytest

from linreg import goal, headlines
from linreg.state import MARGIN_RUNS

CASES = json.loads((Path(__file__).parent.parent / "web" / "tests" / "fixtures" / "headline_cases.json").read_text(encoding="utf-8"))


def test_the_cases_assume_the_margin_the_goal_defines():
    assert MARGIN_RUNS == 3
    assert goal.goal()["margin_runs"] == MARGIN_RUNS


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_the_words_match_the_shared_cases(case):
    assert headlines.build(**case["inputs"]) == case["expected"]


def test_every_case_name_is_covered_by_the_fixture():
    assert {c["expected"]["case"] for c in CASES} == set(headlines.CASES)


def test_the_agent_verdict_uses_the_one_goal_definition():
    v = goal.agent_verdict(20.5, 17.5)
    assert v["reached"] and v["beat"] and v["winner"] == "llm" and v["improvement_runs"] == 3.0
    assert not goal.agent_verdict(20.5, 17.6)["reached"]
    assert goal.agent_verdict(20.5, 18.5)["beat"] and not goal.agent_verdict(20.5, 18.5)["reached"]


def test_the_case_never_says_beat_unless_the_goal_was_reached():
    for agent in [x / 10 for x in range(150, 260)]:
        case = headlines.case_for(agent, 20.5)
        reached = round(20.5 - agent, 1) >= MARGIN_RUNS
        beat = round(20.5 - agent, 1) > 0
        assert (case == "beat") == reached and (case == "edged") == (beat and not reached)


def test_the_hero_does_not_depend_on_the_pick():
    """Same figures for the agent and the TV, different search: the h1, h2 and card are unchanged; only vs_search moves."""
    a = headlines.build(agent_miss=19.0, search_miss=16.0, tv_miss=20.5, tries=5)
    b = headlines.build(agent_miss=19.0, search_miss=25.0, tv_miss=20.5, tries=5)
    assert (a["hero_h1"], a["verdict_h2"], a["scoreboard"]) == (b["hero_h1"], b["verdict_h2"], b["scoreboard"])
    assert a["vs_search"] != b["vs_search"]


def test_the_result_strip_gives_the_case_and_the_two_misses_from_the_same_figures_as_the_verdict():
    assert headlines.build(agent_miss=17.9, search_miss=17.7, tv_miss=21.4, tries=7)["result_strip"] == {
        "label": "goal reached", "text": "The agent was 17.9 runs out, the TV 21.4."}
    assert headlines.build(agent_miss=19.2, search_miss=18.0, tv_miss=21.4, tries=7)["result_strip"]["label"] == "short of the goal"
    assert headlines.build(agent_miss=22.0, search_miss=18.0, tv_miss=21.4, tries=7)["result_strip"] == {
        "label": "goal missed", "text": "The agent was 22 runs out, the TV 21.4."}
    assert headlines.build(agent_miss=None, search_miss=17.7, tv_miss=21.4, tries=0)["result_strip"] == {
        "label": "search only", "text": "The brute-force search was 17.7 runs out, the TV 21.4."}
    assert headlines.build(agent_miss=None, search_miss=None, tv_miss=21.4, tries=0)["result_strip"]["text"] == "The TV was 21.4 runs out."
