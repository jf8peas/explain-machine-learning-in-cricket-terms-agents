"""The hero's words (feature 013): every clause that depends on the figures must stay true when the figures change."""
import pytest

from linreg import hero_text
from linreg.goal import goal

EXAMPLE = {
    "batting_team": "Australia", "bowling_team": "India", "venue": "Sydney Cricket Ground", "date_label": "December 2020",
    "runs_at_10": 82, "wickets_at_10": 2, "final_total": 186, "tv_projection": 164, "tv_miss": 22,
}
TRAINING = {"first_year": 2005, "last_year": 2022, "innings": 2133}


def figures(know_nothing=23.9, tv=22.5, bias=-14.3):
    return {"know_nothing": {"average_miss": know_nothing, "bias": 0.0},
            "broadcaster": {"average_miss": tv, "bias": bias}}


def hero(example=EXAMPLE, **kw):
    return hero_text.build_hero(figures(**kw), TRAINING, 3, 162, example)


def test_the_thresholds_are_named_constants():
    assert hero_text.BARELY_HELPS_SHARE == 0.10
    assert hero_text.TYPICAL_MISS_SHARE == 0.25


# --- "barely helps" ----------------------------------------------------------------------------------------------

@pytest.mark.parametrize("know_nothing,tv,says", [
    (23.9, 22.5, True),     # 5.9% better
    (25.0, 22.5, True),     # exactly 10% better
    (25.1, 22.5, False),    # just over 10% better
    (40.0, 22.5, False),    # clearly better
    (22.5, 22.5, False),    # no better at all
    (20.0, 22.5, False),    # worse than knowing nothing
])
def test_barely_helps_is_said_only_when_the_tv_is_slightly_better(know_nothing, tv, says):
    text = hero(know_nothing=know_nothing, tv=tv)["panel"]
    assert ("barely helps" in text) is says


def test_a_clearly_better_tv_states_the_improvement_plainly():
    text = hero(know_nothing=40.0, tv=22.5)["panel"]
    assert "17.5 runs lower" in text and "barely" not in text


def test_a_tv_no_better_than_knowing_nothing_says_so():
    same = hero(know_nothing=22.5, tv=22.5)["panel"]
    worse = hero(know_nothing=20.0, tv=22.5)["panel"]
    assert "does not help" in same and "same amount" in same
    assert "does not help" in worse and "2.5 runs higher" in worse


# --- direction ---------------------------------------------------------------------------------------------------

def test_a_low_guessing_tv_is_too_low_and_the_phrase_is_marked_for_bold():
    block = hero(bias=-14.3)
    assert "too low, by 14.3 runs" in block["panel"] and block["panel_emphasis"] == ["too low"]
    assert "too high" not in block["panel"]


def test_a_high_guessing_tv_is_too_high():
    block = hero(bias=6.2)
    assert "too high, by 6.2 runs" in block["panel"] and block["panel_emphasis"] == ["too high"]
    assert "too low" not in block["panel"]


@pytest.mark.parametrize("bias", [0.0, 0.04, -0.04])
def test_a_bias_that_rounds_to_zero_makes_no_direction_claim(bias):
    block = hero(bias=bias)
    assert "too low" not in block["panel"] and "too high" not in block["panel"]
    assert "leans neither way" in block["panel"] and block["panel_emphasis"] == []


# --- the goal margin ---------------------------------------------------------------------------------------------

def test_the_panel_states_the_goals_margin():
    assert f"at least {goal()['margin_runs']:g} runs." in hero()["panel"]


@pytest.mark.parametrize("margin,words", [(3, "at least 3 runs."), (1, "at least 1 run."), (2.5, "at least 2.5 runs.")])
def test_the_margin_comes_from_the_argument(margin, words):
    text, _ = hero_text.panel(23.9, 22.5, -14.3, margin)
    assert words in text


# --- "about its typical miss" ------------------------------------------------------------------------------------

@pytest.mark.parametrize("miss,avg,says", [
    (22, 22.5, True),
    (28.1, 22.5, True),      # exactly 25% over (28.125)
    (28.2, 22.5, False),
    (16.9, 22.5, True),      # just inside 25% under (16.875)
    (16.8, 22.5, False),
    (60, 22.5, False),
    (0, 22.5, False),        # spot on the line is far from a typical miss
])
def test_the_typical_miss_clause_appears_only_when_true(miss, avg, says):
    example = {**EXAMPLE, "tv_miss": miss}
    text = hero_text.caption(example, avg)
    assert ("about its typical miss" in text) is says


def test_the_caption_is_built_from_the_example():
    text = hero_text.caption(EXAMPLE, 22.5)
    assert text == ("A real innings: Australia v India, Sydney Cricket Ground, December 2020. Australia made 82 in the "
                    "first 10 overs and 104 in the last 10. The TV's straight line assumed the same pace, said 164, and "
                    "was 22 runs out: about its typical miss. Open circles mark wickets.")


def test_without_the_clause_the_caption_ends_the_sentence_plainly():
    text = hero_text.caption({**EXAMPLE, "tv_miss": 60}, 22.5)
    assert "was 60 runs out. Open circles mark wickets." in text


# --- footnote and chart text -------------------------------------------------------------------------------------

def test_the_footnote_states_the_population_and_the_numbers():
    assert hero()["footnote"] == "2,133 past innings, 2005 to 2022: IPL, BBL and full-member internationals."


def test_the_chart_text_has_every_number_the_chart_shows_and_says_the_agent_is_unknown():
    text = hero()["chart_text"]
    for part in ("Australia v India", "82 for 2", "164", "162", "186", "22.5", "agent's prediction is not known"):
        assert part in text


def test_without_an_example_there_is_no_caption_or_chart_text_but_the_panel_stays():
    block = hero(example=None)
    assert block["caption"] is None and block["chart_text"] is None
    assert block["panel"] and block["footnote"]


@pytest.mark.parametrize("know_nothing,tv,bias,miss", [(23.9, 22.5, -14.3, 22), (50.0, 12.0, 3.0, 40), (10.0, 12.0, 0.0, 12)])
def test_every_number_in_the_sentences_is_one_of_the_figures(know_nothing, tv, bias, miss):
    import re
    block = hero(know_nothing=know_nothing, tv=tv, bias=bias, example={**EXAMPLE, "tv_miss": miss})
    allowed = {f"{know_nothing - tv:g}", f"{tv - know_nothing:g}", f"{abs(bias):.1f}", "3", "10", "20", "0.0", "2,133", "2005",
               "2022", "2020", "82", "104", "164", f"{miss:g}", "186", "2", "162", f"{tv:g}", f"{know_nothing:g}", "1",
               f"{round(know_nothing - tv, 1):g}", f"{round(tv - know_nothing, 1):g}"}
    for key in ("caption", "panel", "footnote", "chart_text"):
        for number in re.findall(r"\d(?:[\d,]*\d)?(?:\.\d+)?", block[key]):
            assert number in allowed, (key, number)
