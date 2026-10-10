"""The facts take the winner's comparison with all three references from the final state (feature 006, as read by 012)."""
import pytest

from linreg.goal import compare
from linreg.llm_fake import FakeLlm
from tests.conftest import make_table, merged_state
from tests.test_explanation_numbers import blocks_for, check_section_numbers, facts_for, state_for
from tests.test_final_test import SCRIPT


def test_compare_gives_the_gap_in_runs_and_percent_from_the_displayed_misses():
    assert compare(40.5, 18.9) == {"reference_miss": 40.5, "winner_miss": 18.9, "improvement_runs": 21.6,
                                   "improvement_percent": 53.3, "beat": True}
    assert compare(20.0, 22.0)["beat"] is False and compare(20.0, 22.0)["improvement_runs"] == -2.0
    assert compare(0.0, 1.0)["improvement_percent"] is None


def test_the_facts_say_how_far_the_winner_beat_the_know_nothing_guess_and_the_projection():
    facts = facts_for(state_for(llm_mae=19.3, forward_mae=18.9, tv=20.9, know_nothing=40.5))
    assert facts["beat_know_nothing_by"]["display"] == "21.6" and facts["beat_know_nothing"]["value"] is True
    assert facts["beat_tv_by"]["display"] == "2.0" and facts["goal_reached"]["value"] is False
    assert facts["short_of_goal_by"]["display"] == "1.0" and facts["goal_margin"]["display"] == "3"


def test_the_share_within_ten_runs_is_the_winners_and_the_threshold_is_a_fact():
    facts = facts_for(state_for(within_10=32.8))
    assert facts["share_within_10"]["display"] == "32.8" and facts["within_runs_threshold"]["display"] == "10"


def test_a_winner_that_does_not_beat_the_know_nothing_guess_is_told_so_in_the_facts():
    facts = facts_for(state_for(llm_mae=45.0, forward_mae=44.0, tv=46.0, know_nothing=40.5))
    assert facts["beat_know_nothing"]["value"] is False and facts["beat_know_nothing_by"]["display"] == "3.5"


def test_the_verdict_block_is_stated_honestly_in_the_three_cases():
    def verdict(**kw):
        return next(b for b in blocks_for(state_for(**kw))[1] if b["id"] == "verdict")
    reached = verdict(forward_mae=17.0, tv=21.0)
    assert "Goal reached" in reached["title"] and "4.0" in reached["title"] and reached["visual"]["badge"] == "Goal reached"
    short = verdict(forward_mae=17.0, tv=19.0)
    assert "goal missed" in short["title"] and "2.0" in short["title"] and short["visual"]["badge"] == "Goal missed"
    assert "1.0 runs short of the 3-run goal" in " ".join(short["sentences"])
    worse = verdict(llm_mae=20.0, forward_mae=19.0, tv=18.0)
    assert "Did not beat" in worse["title"] and worse["visual"]["badge"] == "Goal missed"
    assert "1.0 runs more" in " ".join(worse["sentences"])


def test_the_comparison_figures_are_not_repeated_as_sentences():
    _, blocks = blocks_for(state_for(llm_mae=19.3, forward_mae=18.9, tv=20.9))
    text = " ".join(s for b in blocks for s in b["sentences"]).lower()
    assert "know-nothing" not in text and "within 10 runs" not in text            # they stay in the accuracy table and chart


def test_the_sections_text_in_a_real_run_is_only_facts(run_graph, write_csv):
    state = merged_state(run_graph({"data_path": write_csv(make_table())}, llm=FakeLlm({"fake/steady": list(SCRIPT)})))
    check_section_numbers(state["explanation"])
