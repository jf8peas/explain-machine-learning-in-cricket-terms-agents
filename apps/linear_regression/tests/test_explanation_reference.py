"""The explanation compares the winner with all three references, and every number in it is in the final state (feature 006)."""
import pytest

from linreg import accuracy_text, cricket_explanation, features
from linreg.goal import compare, verdict, verdict_sentence
from linreg.llm_fake import FakeLlm
from linreg.state import MARGIN_RUNS
from tests.conftest import make_table, merged_state
from tests.test_explanation_numbers import check_numbers, explain, state_for
from tests.test_final_test import SCRIPT


def figures(miss, w10, w20, pct, bias, n=515):
    return {"n": n, "average_miss": miss, "within_10": w10, "within_20": w20, "miss_percent": pct, "bias": bias}


def with_references(state, kn=(40.5, 17.3, 30.9, 25.2, -5.5), tv=(20.9, 31.1, 57.1, 13.0, -6.9),
                    win=(18.9, 32.8, 62.1, 11.7, -1.1), took_part=True):
    """The final state's new keys, worked out the way final_test does, around a state_for() state."""
    f = state["final"]
    winner = f["winner"]
    acc = {"know_nothing": figures(*kn), "broadcaster": figures(*tv), winner: figures(*win)}
    if took_part and winner == "forward":
        acc["llm"] = figures(19.3, 32.8, 61.0, 12.0, 0.3)
    f["accuracy"] = acc
    f["methods"] = [m for m in ("know_nothing", "broadcaster", "llm", "forward") if m in acc]
    f["bias_words"] = {m: accuracy_text.bias_words(a["bias"]) for m, a in acc.items()}
    f["bias_sentence"] = None
    f["tolerances"] = [10, 20]
    f["versus_know_nothing"] = compare(acc["know_nothing"]["average_miss"], acc[winner]["average_miss"])
    f["verdict"] = verdict(acc["broadcaster"]["average_miss"], acc[winner]["average_miss"], winner)
    f["verdict_sentence"] = verdict_sentence(f["verdict"])
    return state


def explain_with(state):
    f = state["final"]
    return cricket_explanation.build_explanation(
        state, features.labels(), MARGIN_RUNS,
        comparison_sentences=accuracy_text.comparison_sentences(f), verdict_sentence=f["verdict_sentence"])


def text(expl):
    return " ".join(expl["sentences"])


def test_compare_gives_the_gap_in_runs_and_percent_from_the_displayed_misses():
    assert compare(40.5, 18.9) == {"reference_miss": 40.5, "winner_miss": 18.9, "improvement_runs": 21.6,
                                   "improvement_percent": 53.3, "beat": True}
    assert compare(20.0, 22.0)["beat"] is False and compare(20.0, 22.0)["improvement_runs"] == -2.0
    assert compare(0.0, 1.0)["improvement_percent"] is None


def test_the_explanation_says_how_far_the_winner_beat_the_know_nothing_guess_and_the_projection():
    state = with_references(state_for(llm_mae=19.3, forward_mae=18.9, tv=20.9))
    t = text(explain_with(state))
    assert "know-nothing guess" in t and "21.6 runs (53.3%) lower" in t                         # 40.5 against 18.9
    assert "beat the TV projection by 2.0 runs (9.6%)" in t and "short of the goal of at least 3 runs" in t


def test_it_says_how_often_the_winner_lands_within_ten_runs_beside_the_two_references():
    t = text(explain_with(with_references(state_for(llm_mae=19.3, forward_mae=18.9, tv=20.9))))
    assert "32.8% of innings" in t and "31.1% for the TV projection" in t and "17.3% for the know-nothing guess" in t
    assert "within 10 runs" in t and "a boundary or two" in t


def test_it_gives_the_winners_bias_in_words():
    t = text(explain_with(with_references(state_for(llm_mae=19.3, forward_mae=18.9, tv=20.9))))
    assert "guesses 1.1 runs too low" in t


def test_every_number_in_the_explanation_is_in_the_final_state():
    for kwargs in ({}, {"win": (35.0, 20.0, 40.0, 22.0, 8.0)}, {"kn": (18.0, 35.0, 60.0, 11.0, 0.5)}):
        state = with_references(state_for(llm_mae=19.3, forward_mae=18.9, tv=20.9), **kwargs)
        state["explanation"] = explain_with(state)
        check_numbers(state)


def test_a_winner_that_does_not_beat_the_know_nothing_guess_is_told_so_plainly():
    state = with_references(state_for(llm_mae=45.0, forward_mae=44.0, tv=46.0), kn=(40.5, 17.3, 30.9, 25.2, 0.0),
                            tv=(46.0, 10.0, 20.0, 29.0, -12.0), win=(44.0, 12.0, 25.0, 28.0, -5.0))
    t = text(explain_with(state))
    assert "did not beat the know-nothing guess" in t and "3.5 runs (8.6%) higher" in t


def test_a_winner_that_does_not_beat_the_projection_is_told_so_plainly():
    state = with_references(state_for(llm_mae=24.0, forward_mae=23.0, tv=20.9), tv=(20.9, 31.1, 57.1, 13.0, -6.9),
                            win=(23.0, 25.0, 50.0, 14.0, 1.0))
    assert "did not beat the TV projection" in text(explain_with(state))


def test_the_same_direction_large_bias_sentence_is_included_when_the_state_has_it():
    state = with_references(state_for(llm_mae=19.3, forward_mae=18.9, tv=20.9))
    state["final"]["bias_sentence"] = accuracy_text.large_bias_sentence("low")
    assert accuracy_text.large_bias_sentence("low") in text(explain_with(state))


def test_without_the_language_model_the_sentences_cover_the_methods_that_remain():
    state = with_references(state_for(llm_mae=None, forward_mae=18.9, tv=20.9, took_part=False, failure="provider error"),
                            took_part=False)
    t = text(explain_with(state))
    assert "language model's model" not in t.lower().replace("the language model did not take part", "")
    assert "know-nothing" in t and "TV projection" in t


def test_the_fixed_expectation_note_is_page_text_and_not_part_of_the_explanation():
    t = text(explain_with(with_references(state_for(llm_mae=19.3, forward_mae=18.9, tv=20.9)))).lower()
    assert "perfectly" not in t and "unpredictable" not in t


def test_states_without_the_new_figures_still_explain_as_before():
    expl = explain(state_for())
    assert expl["sentences"] and "beat the TV projection" in text(expl)


def test_the_sentences_come_from_the_wording_module_and_the_figures_in_the_state(run_graph, write_csv):
    state = merged_state(run_graph({"data_path": write_csv(make_table())}, llm=FakeLlm({"fake/steady": list(SCRIPT)})))
    f = state["final"]
    t = text(state["explanation"])
    assert f["verdict_sentence"] in t
    assert f["bias_words"][f["winner"]] in t
    assert f"{f['versus_know_nothing']['improvement_runs']:.1f}" in t
    check_numbers(state)
