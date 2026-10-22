"""The blocks and their template wording (features 012 and 015): placeholders, variants, limits, and the number rule."""
import re

import pytest

from linreg import cricket_blocks, features
from linreg.cricket_blocks import BLOCK_IDS, CODE_ONLY, MAX_SENTENCE, MAX_TITLE, MOVABLE, UnknownFact, fill, max_sentences
from linreg.writing_reply import DIRECTION_WORDS
from tests.test_explanation_numbers import blocks_for, check_section_numbers, facts_for, state_for

WICKET_COST = dict(features_=("runs_at_10", "wickets_at_10"), coefs={"runs_at_10": 1.2, "wickets_at_10": -7.0})
WICKET_GAIN = dict(features_=("runs_at_10", "wickets_at_10"), coefs={"runs_at_10": 1.2, "wickets_at_10": 3.0})
WICKET_HAND = {}                                                     # the default state has wickets_in_hand
WICKET_HAND_LESS = dict(features_=("runs_at_10", "wickets_in_hand"), coefs={"runs_at_10": 1.2, "wickets_in_hand": -2.0})
NO_WICKET = dict(features_=("runs_at_10", "fours_at_10"), coefs={"runs_at_10": 1.2, "fours_at_10": 0.4})

# the broadcaster against the average-total guess, and which way it leans (its average miss is `tv`)
CLEARLY = dict(tv=21.0, know_nothing=34.0)
BARELY = dict(tv=21.0, know_nothing=22.0)
NO_BETTER = dict(tv=21.0, know_nothing=20.0)
TV_LOW = dict(tv_bias=-12.0)
TV_HIGH = dict(tv_bias=15.0)
TV_SMALL = dict(tv_bias=-2.0)
TV_SMALL_HIGH = dict(tv_bias=2.0)
TV_ZERO = dict(tv_bias=0.0)

REACHED = dict(forward_mae=17.0, tv=21.0)
MISSED_BEAT = dict(forward_mae=17.0, tv=19.0)
MISSED_WORSE = dict(llm_mae=20.0, forward_mae=19.0, tv=18.0)
RIVAL_SHORTER = dict(winner="llm", llm_mae=18.0, forward_mae=16.0, tv=21.0)         # chosen the AI's model; the rival has the shorter bar
TV_SHORTEST = dict(winner="llm", llm_mae=18.0, forward_mae=19.0, tv=15.0, know_nothing=34.0)
TIE_FOR_SHORTEST = dict(winner="llm", llm_mae=17.0, forward_mae=17.0, tv=21.0)
NO_AI = dict(llm_mae=None, forward_mae=17.0, tv=21.0, took_part=False)


def block(blocks, bid):
    return next((b for b in blocks if b["id"] == bid), None)


def text(b):
    return " ".join([b["title"], *b["sentences"]])


def test_fill_replaces_every_placeholder_with_the_facts_display():
    facts = facts_for(state_for())
    assert fill("Beat by {beat_tv_by} runs in {test_year}", facts) == "Beat by 4.0 runs in 2026"


def test_fill_raises_on_an_unknown_fact_and_never_leaves_a_placeholder():
    with pytest.raises(UnknownFact):
        fill("About {nonsense} runs", facts_for(state_for()))
    assert "{" not in fill("{chosen_label} {test_year}", facts_for(state_for()))


def test_the_blocks_are_the_verdict_three_takeaways_and_the_rule_of_thumb_in_a_fixed_order():
    _, blocks = blocks_for(state_for())
    ids = ["verdict", "takeaway_run_rate", "takeaway_drivers", "takeaway_tv", "rule_of_thumb"]
    assert [b["id"] for b in blocks] == ids == list(BLOCK_IDS)
    assert MOVABLE == () and CODE_ONLY == ("verdict", "rule_of_thumb")
    assert all(b["from_model"] == [] for b in blocks)


@pytest.mark.parametrize("kw", [{}, WICKET_COST, NO_WICKET, NO_AI, RIVAL_SHORTER])
def test_the_old_blocks_are_gone(kw):
    _, blocks = blocks_for(state_for(**kw))
    assert not {"drivers", "wicket", "how_chosen", "closing"} & {b["id"] for b in blocks}


# ---- the verdict -----------------------------------------------------------------------------------------------

@pytest.mark.parametrize("kw, variant, shape, title", [
    (REACHED, "reached", "tick", "Goal reached"),
    (MISSED_BEAT, "missed_beat", "dash", "Goal missed"),
    (MISSED_WORSE, "missed_worse", "cross", "Goal missed"),
    (dict(forward_mae=17.0, tv=20.0), "reached", "tick", "Goal reached"),          # exactly the margin counts
])
def test_the_verdict_variant_shape_and_title(kw, variant, shape, title):
    b = block(blocks_for(state_for(**kw))[1], "verdict")
    assert (b["visual"]["variant"], b["visual"]["shape"], b["title"]) == (variant, shape, title)


def test_each_verdict_variant_says_what_it_should_with_its_numbers():
    reached = text(block(blocks_for(state_for(**REACHED))[1], "verdict"))
    assert "beat the broadcaster's projection by 4.0 runs on average" in reached and "at least 3 runs" in reached
    beat = text(block(blocks_for(state_for(**MISSED_BEAT))[1], "verdict"))
    assert "but only by 2.0 runs" in beat and "at least 3 runs" in beat
    worse = text(block(blocks_for(state_for(**MISSED_WORSE))[1], "verdict"))
    assert "The broadcaster's projection was 1.0 runs more accurate than the brute-force search's model" in worse
    same = text(block(blocks_for(state_for(forward_mae=17.0, tv=17.0))[1], "verdict"))
    assert "exactly as accurate" in same and "0.0" not in same


def test_the_verdict_names_the_rivals_model_when_the_language_model_did_not_take_part():
    b = block(blocks_for(state_for(**NO_AI))[1], "verdict")
    assert "brute-force search's model" in text(b) and "AI agent's model" not in text(b)


def test_the_verdict_names_the_ai_agents_model_when_it_was_chosen():
    b = block(blocks_for(state_for(llm_mae=15.0, forward_mae=17.0, tv=21.0))[1], "verdict")
    assert "The AI agent's model beat the broadcaster's projection" in text(b)


@pytest.mark.parametrize("kw", [REACHED, MISSED_BEAT, MISSED_WORSE, RIVAL_SHORTER, TV_SHORTEST, TIE_FOR_SHORTEST, NO_AI])
def test_the_verdict_is_one_sentence_whoever_had_the_shortest_bar(kw):
    b = block(blocks_for(state_for(**kw))[1], "verdict")
    assert len(b["sentences"]) == 1 and "shortest bar" not in text(b)
    assert "race_leader_differs" not in b["visual"]


# ---- takeaway 1: the run rate alone ----------------------------------------------------------------------------

@pytest.mark.parametrize("kw, title, phrase", [
    (CLEARLY, "The run rate alone is a real help", "13.0 fewer than the average-total guess (34.0)"),
    (BARELY, "The run rate alone barely helps", "only 1.0 fewer than the average-total guess (22.0)"),
    (NO_BETTER, "The run rate alone does not help", "no better than the average-total guess (20.0)"),
])
def test_takeaway_one_follows_whether_the_tv_beats_the_know_nothing_guess(kw, title, phrase):
    b = block(blocks_for(state_for(**kw))[1], "takeaway_run_rate")
    assert b["title"] == title and phrase in b["sentences"][0] and "21.0 runs" in b["sentences"][0]


def test_the_barely_helps_threshold_is_the_heros():
    # exactly 10% of the know-nothing miss is "barely" (the hero says the same); just past it is "clearly"
    assert facts_for(state_for(tv=18.0, know_nothing=20.0))["run_rate_state"]["value"] == "barely"
    assert facts_for(state_for(tv=17.9, know_nothing=20.0))["run_rate_state"]["value"] == "clearly"


# a average-total guess that is far off (bias at least half its miss) and guesses too low: totals have risen
RISING = dict(know_nothing=34.0, know_nothing_bias=-20.0)
RISING_BARELY = dict(tv=21.0, know_nothing=22.0, know_nothing_bias=-15.0)    # far off and too low, but the broadcaster only barely helps
FAR_OFF_HIGH = dict(know_nothing=34.0, know_nothing_bias=20.0)
NOT_FAR_OFF = dict(know_nothing=34.0, know_nothing_bias=-10.0)


@pytest.mark.parametrize("kw", [RISING, dict(know_nothing=40.0, know_nothing_bias=-25.0, tv=18.0)])
def test_takeaway_one_says_scores_keep_climbing_when_the_know_nothing_guess_is_far_off_and_too_low(kw):
    b = block(blocks_for(state_for(**kw))[1], "takeaway_run_rate")
    assert b["title"] == "Scores keep climbing"
    facts = facts_for(state_for(**kw))
    assert facts["know_nothing_rising"]["value"] is True and facts["know_nothing_bias_direction"]["display"] == "too low"
    assert f"{facts['know_nothing_bias_runs']['display']} too low" in b["sentences"][0]
    assert f"The broadcaster misses by {facts['tv_test_miss']['display']} runs, against {facts['know_nothing_miss']['display']}" in b["sentences"][1]


@pytest.mark.parametrize("kw, title", [
    (RISING_BARELY, "The run rate alone barely helps"),             # far off and too low, but only "clearly" gets the climbing wording
    (FAR_OFF_HIGH, "The run rate alone is a real help"),            # far off but too high: totals have not risen
    (NOT_FAR_OFF, "The run rate alone is a real help"),             # too low but not far off
    (dict(tv=21.0, know_nothing=20.0, know_nothing_bias=-15.0), "The run rate alone does not help"),   # the broadcaster is no better: feature 015's wording
    (dict(know_nothing=34.0, know_nothing_bias=0.0), "The run rate alone is a real help"),
])
def test_takeaway_one_keeps_feature_015_wording_when_totals_have_not_visibly_risen(kw, title):
    b = block(blocks_for(state_for(**kw))[1], "takeaway_run_rate")
    assert b["title"] == title
    assert "keep" not in text(b).lower() or "keep climbing" not in text(b).lower()
    assert facts_for(state_for(**kw))["know_nothing_rising"]["value"] is (kw.get("know_nothing_bias", 0) < 0 and abs(kw.get("know_nothing_bias", 0)) >= 0.5 * kw["know_nothing"])


def test_the_rising_variant_takes_its_direction_word_only_through_a_placeholder_and_fits_the_limits():
    raw = cricket_blocks._takeaway_run_rate(facts_for(state_for(**RISING)))
    assert "{know_nothing_bias_direction}" in raw["sentences"][0]
    assert "too low" not in raw["sentences"][0] and len(raw["title"]) <= MAX_TITLE
    assert all(len(sentence) <= MAX_SENTENCE for sentence in raw["sentences"])
    facts, blocks = blocks_for(state_for(**RISING))
    check_section_numbers({"facts": facts, "blocks": blocks})


# ---- takeaway 2: what drives the total ---------------------------------------------------------------------------

def test_takeaway_two_leads_with_the_wicket_cost_when_there_is_one():
    b = block(blocks_for(state_for(**WICKET_COST))[1], "takeaway_drivers")
    assert b["title"] == "A lost wicket costs about 7.0 runs" and "costs about 7.0 runs" in b["sentences"][0]
    assert b["visual"]["wicket"] == {"fact_id": "wicket_cost", "figure": "7.0", "direction": "cost"}


def test_takeaway_two_is_cautious_when_a_wicket_oddly_did_not_cost_runs():
    b = block(blocks_for(state_for(**WICKET_GAIN))[1], "takeaway_drivers")
    assert "did not cost runs" in text(b) and "cautious" in text(b) and b["visual"]["wicket"]["direction"] == "gain"


def test_takeaway_two_handles_wickets_in_hand_both_ways():
    hand = block(blocks_for(state_for(**WICKET_HAND))[1], "takeaway_drivers")
    assert hand["title"] == "Wicket in hand: about 6.5 runs" and hand["visual"]["wicket"]["direction"] == "hand"
    less = block(blocks_for(state_for(**WICKET_HAND_LESS))[1], "takeaway_drivers")
    assert "did not add runs" in less["title"] and less["visual"]["wicket"]["direction"] == "less"


def test_takeaway_two_leads_with_the_biggest_factor_when_there_is_no_wicket_feature():
    b = block(blocks_for(state_for(**NO_WICKET))[1], "takeaway_drivers")
    assert b["title"].startswith("What drives the total: ") and "no wicket feature" in b["sentences"][1]
    assert b["visual"]["wicket"] is None and "wicket" not in b["title"].lower()


def test_the_drivers_rows_are_sorted_and_keep_their_signs():
    _, blocks = blocks_for(state_for(features_=("runs_at_10", "wickets_overs_7_10", "sixes_at_10"),
                                     coefs={"runs_at_10": 1.2, "wickets_overs_7_10": -3.0, "sixes_at_10": 0.5}, iqr=20.0))
    rows = block(blocks, "takeaway_drivers")["visual"]["rows"]
    assert [r["feature"] for r in rows] == ["wickets_overs_7_10", "runs_at_10", "sixes_at_10"]
    signed = {r["feature"]: r["effect_runs"] for r in rows}
    assert signed == {"runs_at_10": 24.0, "wickets_overs_7_10": -60.0, "sixes_at_10": 10.0}
    assert [abs(r["effect_runs"]) for r in rows] == sorted((abs(r["effect_runs"]) for r in rows), reverse=True)
    assert rows[0]["label"] == features.label("wickets_overs_7_10")


def test_one_feature_gives_one_bar_and_unequal_effects_keep_every_bar():
    one = block(blocks_for(state_for(features_=("runs_at_10",), coefs={"runs_at_10": 1.2}))[1], "takeaway_drivers")
    assert len(one["visual"]["rows"]) == 1
    wide = block(blocks_for(state_for(features_=("runs_at_10", "sixes_at_10"), coefs={"runs_at_10": 5.0, "sixes_at_10": 0.01}))[1],
                 "takeaway_drivers")
    assert len(wide["visual"]["rows"]) == 2 and wide["visual"]["rows"][1]["display"] == "0.2"


# ---- takeaway 3: why the broadcaster gets it wrong ---------------------------------------------------------------------------

def test_takeaway_three_follows_the_direction_of_the_tv_bias():
    low = block(blocks_for(state_for(**TV_LOW))[1], "takeaway_tv")
    assert low["title"] == "Sides speed up, and the broadcaster forgets it" and "12.0 runs too low" in low["sentences"][0]
    high = block(blocks_for(state_for(**TV_HIGH))[1], "takeaway_tv")
    assert "too low" not in text(high) and "15.0 runs too high" in high["sentences"][0] and "speed up" not in text(high)
    none = block(blocks_for(state_for(**TV_ZERO))[1], "takeaway_tv")
    assert "about right" in none["sentences"][0] and "too low" not in text(none) and "too high" not in text(none)


def test_a_small_bias_that_still_leans_is_still_described_truthfully():
    small = block(blocks_for(state_for(**TV_SMALL))[1], "takeaway_tv")
    assert "2.0 runs too low" in small["sentences"][0]
    high = block(blocks_for(state_for(**TV_SMALL_HIGH))[1], "takeaway_tv")
    assert "2.0 runs too high" in high["sentences"][0]


# ---- the rule of thumb ------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("bias, verb", [(-12.0, "add"), (15.0, "take off")])
def test_the_rule_of_thumb_verb_follows_the_bias(bias, verb):
    b = block(blocks_for(state_for(tv_bias=bias))[1], "rule_of_thumb")
    assert f"{verb} about {abs(bias):.1f} runs" in b["sentences"][0]
    other = "take off" if verb == "add" else "add"
    assert other not in text(b)


def test_the_rule_of_thumb_adds_the_wicket_adjustment_when_the_model_has_a_wicket_feature():
    cost = block(blocks_for(state_for(**WICKET_COST))[1], "rule_of_thumb")
    assert "a bit more if few have fallen, a bit less if many have" in cost["sentences"][1]
    hand = block(blocks_for(state_for(**WICKET_HAND))[1], "rule_of_thumb")
    assert "a bit more if wickets are in hand, a bit less if not" in hand["sentences"][1]
    none = block(blocks_for(state_for(**NO_WICKET))[1], "rule_of_thumb")
    assert len(none["sentences"]) == 1
    gain = block(blocks_for(state_for(**WICKET_GAIN))[1], "rule_of_thumb")
    assert len(gain["sentences"]) == 1                                  # an odd-signed wicket effect is not turned into advice


def test_with_a_small_bias_the_rule_of_thumb_is_about_wickets_alone():
    cost = block(blocks_for(state_for(**TV_SMALL, **WICKET_COST))[1], "rule_of_thumb")
    assert "add" not in text(cost) and "take off" not in text(cost)
    assert "about right on average" in cost["sentences"][0] and "costs about 7.0 runs" in cost["sentences"][1]
    hand = block(blocks_for(state_for(**TV_SMALL, **WICKET_HAND))[1], "rule_of_thumb")
    assert "worth about 6.5 runs" in hand["sentences"][1]
    none = block(blocks_for(state_for(**TV_SMALL, **NO_WICKET))[1], "rule_of_thumb")
    assert len(none["sentences"]) == 1 and "21.0 runs" in none["sentences"][0]


def test_the_rule_of_thumb_and_the_verdict_never_contain_a_placeholder():
    for kw in ({}, TV_HIGH, TV_SMALL, WICKET_COST, NO_AI):
        for b in blocks_for(state_for(**kw))[1]:
            assert "{" not in text(b)


# ---- all blocks -----------------------------------------------------------------------------------------------------------

ALL_CASES = [RISING, RISING_BARELY, FAR_OFF_HIGH, NOT_FAR_OFF, {}, WICKET_COST, WICKET_GAIN, WICKET_HAND_LESS, NO_WICKET, CLEARLY, BARELY, NO_BETTER, TV_LOW, TV_HIGH, TV_SMALL, TV_ZERO,
             REACHED, MISSED_BEAT, MISSED_WORSE, RIVAL_SHORTER, TV_SHORTEST, NO_AI,
             {"features_": ("runs_at_10",), "coefs": {"runs_at_10": 1.2}}]


@pytest.mark.parametrize("kw", ALL_CASES)
def test_every_number_in_every_template_text_is_a_fact_and_within_the_limits(kw):
    facts, blocks = blocks_for(state_for(**kw))
    check_section_numbers({"facts": facts, "blocks": blocks})
    for b in blocks:
        assert len(b["title"]) <= MAX_TITLE + 20 and 1 <= len(b["sentences"]) <= max_sentences(b["id"]), b["id"]
        assert all(len(s) <= MAX_SENTENCE + 40 for s in b["sentences"]), b["id"]
        assert not any("{" in s for s in [b["title"], *b["sentences"]])


@pytest.mark.parametrize("kw", ALL_CASES)
def test_the_takeaway_templates_are_within_the_limits_the_model_is_given(kw):
    state = state_for(**kw)
    facts = facts_for(state)
    labels = features.labels()
    for fn in (cricket_blocks._takeaway_run_rate, cricket_blocks._takeaway_tv):
        raw = fn(facts)
        assert len(raw["title"]) <= MAX_TITLE and all(len(s) <= MAX_SENTENCE for s in raw["sentences"]), fn.__name__
    raw = cricket_blocks._takeaway_drivers(facts, labels, list(state["features"]))
    assert len(raw["title"]) <= MAX_TITLE and all(len(s) <= MAX_SENTENCE for s in raw["sentences"])


@pytest.mark.parametrize("kw, absent", [(TV_LOW, ["too high", "take off"]), (TV_HIGH, ["too low", "speed up"]),
                                        (TV_SMALL, ["take off"]), (TV_ZERO, ["too low", "too high", "take off"])])
def test_direction_words_in_the_section_match_the_bias(kw, absent):
    _, blocks = blocks_for(state_for(**kw, **WICKET_COST))
    whole = " ".join(text(b) for b in blocks).lower()
    for phrase in absent:
        assert phrase not in whole
    if kw is TV_HIGH:
        assert "add about" not in whole


def test_a_direction_word_in_the_section_is_only_ever_one_the_templates_wrote_for_it():
    """The code-only blocks and templates may use direction words; check they are the ones the facts allow."""
    for kw in (TV_LOW, TV_HIGH, TV_ZERO):
        _, blocks = blocks_for(state_for(**kw))
        facts = facts_for(state_for(**kw))
        for b in blocks:
            for word in DIRECTION_WORDS.findall(text(b)):
                assert word.lower() in {"add", "take off", "over", "under", "too low", "too high"}
        assert facts["tv_bias_direction"]["display"] in {"too low", "too high", "about right"}


@pytest.mark.parametrize("kw", ALL_CASES)
def test_no_block_text_says_winner(kw):
    _, blocks = blocks_for(state_for(**kw))
    assert "winner" not in " ".join(text(b) for b in blocks).lower()
