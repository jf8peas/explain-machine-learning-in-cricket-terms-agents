"""Figures put into plain cricket words, in one place (feature 006)."""
import re

import pytest

from linreg import accuracy_text as t

KN = {"n": 4036, "average_miss": 29.4, "within_10": 22.8, "within_20": 43.1, "miss_percent": 18.9, "bias": 0.0}
TV = {"n": 4036, "average_miss": 21.8, "within_10": 29.4, "within_20": 55.3, "miss_percent": 14.1, "bias": -12.1}


def numbers_in(text):
    return {float(x.replace(",", "")) for x in re.findall(r"\d[\d,]*\.?\d*", text)}


def test_bias_in_words_says_which_way_and_how_far():
    assert t.bias_words(-6.2) == "guesses 6.2 runs too low"
    assert t.bias_words(3.1) == "guesses 3.1 runs too high"
    assert t.bias_words(1.0) == "guesses 1.0 run too high"                  # singular for exactly one


def test_a_bias_that_rounds_to_zero_is_said_to_lean_neither_way():
    for zero in (0.0, 0.04, -0.04):
        assert "neither" in t.bias_words(zero) and "0.0" in t.bias_words(zero)


def test_the_hit_rate_in_words_gives_the_exact_runs_with_the_cricket_phrase():
    text = t.hit_rate_words(TV)
    assert "29.4%" in text and "10 runs" in text and "a boundary or two" in text and "55.3%" in text and "20 runs" in text


def test_the_bar_sentence_names_the_years_and_the_innings():
    text = t.bar_sentence(2005, 2024, 4036)
    assert "2005" in text and "2024" in text and "4,036" in text and "bar" in text


def test_the_gap_sentence_says_what_knowing_the_score_at_ten_overs_is_worth():
    text = t.gap_sentence(KN, TV)
    assert {29.4, 21.8, 7.6, 6.6} <= numbers_in(text)                         # miss each, runs gap, hit-rate gap in points
    assert "10 overs" in text


def test_the_gap_percentage_in_the_sentence_is_worked_from_the_displayed_misses():
    assert str(round(7.6 / 29.4 * 100, 1)) in t.gap_sentence(KN, TV)


@pytest.mark.parametrize("finding,gap,needle", [
    ("clearly_better", 7.6, "clearly better"),
    ("slightly_better", 0.9, "only slightly better"),
    ("no_better", -1.5, "no better"),
    ("no_better", 0.0, "no better"),
])
def test_each_finding_has_its_own_plain_sentence_with_the_gap(finding, gap, needle):
    text = t.finding_sentence(finding, gap, 25.9)
    assert needle in text and "TV projection" in text and "knowing nothing" in text
    assert str(abs(gap)) in text


def test_a_weak_finding_says_that_beating_the_projection_then_means_little():
    assert "means little" in t.finding_sentence("slightly_better", 0.9, 3.0) or "little" in t.finding_sentence("no_better", 0.0, 0.0)


def test_the_projection_bias_sentence_explains_a_low_lean_in_cricket_terms_and_not_a_high_one():
    low = t.projection_bias_sentence(-12.1)
    assert "12.1" in low and "too low" in low and "last 10 overs" in low
    high = t.projection_bias_sentence(4.0)
    assert "4.0" in high and "too high" in high and "last 10 overs" not in high


def test_the_large_bias_sentence_names_the_direction_and_who_it_covers():
    low = t.large_bias_sentence("low")
    assert "too low" in low and "TV projection" in low
    assert "too high" in t.large_bias_sentence("high")


def test_the_sentences_contain_no_markup_and_every_number_comes_from_the_figures():
    texts = [t.bias_words(-6.2), t.hit_rate_words(TV), t.bar_sentence(2005, 2024, 4036), t.gap_sentence(KN, TV),
             t.finding_sentence("clearly_better", 7.6, 25.9), t.projection_bias_sentence(-12.1), t.large_bias_sentence("low")]
    for text in texts:
        assert "<" not in text and ">" not in text and text.strip()
    assert numbers_in(t.hit_rate_words(TV)) <= {29.4, 10.0, 55.3, 20.0}


def test_the_short_bias_for_a_table_cell():
    assert t.bias_short(-12.1) == "12.1 too low"
    assert t.bias_short(3.14) == "3.1 too high"
    assert t.bias_short(0.03) == "0.0" and t.bias_short(-0.03) == "0.0"
