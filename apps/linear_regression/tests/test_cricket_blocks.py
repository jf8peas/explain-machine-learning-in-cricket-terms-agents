"""The blocks and their template wording (feature 012): placeholders, variants, limits, and the number rule."""
import pytest

from linreg import cricket_blocks, features
from linreg.cricket_blocks import MAX_SENTENCE, MAX_TITLE, UnknownFact, fill, max_sentences
from tests.test_explanation_numbers import blocks_for, check_section_numbers, facts_for, state_for

WICKET_COST = dict(features_=("runs_at_10", "wickets_at_10"), coefs={"runs_at_10": 1.2, "wickets_at_10": -7.0})
WICKET_GAIN = dict(features_=("runs_at_10", "wickets_at_10"), coefs={"runs_at_10": 1.2, "wickets_at_10": 3.0})
NO_WICKET = dict(features_=("runs_at_10", "fours_at_10"), coefs={"runs_at_10": 1.2, "fours_at_10": 0.4})


def block(blocks, bid):
    return next((b for b in blocks if b["id"] == bid), None)


def test_fill_replaces_every_placeholder_with_the_facts_display():
    facts = facts_for(state_for())
    assert fill("Beat by {beat_tv_by} runs in {test_year}", facts) == "Beat by 4.0 runs in 2026"


def test_fill_raises_on_an_unknown_fact_and_never_leaves_a_placeholder():
    with pytest.raises(UnknownFact):
        fill("About {nonsense} runs", facts_for(state_for()))
    assert "{" not in fill("{winner_name} {test_year}", facts_for(state_for()))


def test_the_blocks_are_in_the_default_order():
    _, blocks = blocks_for(state_for())
    assert [b["id"] for b in blocks] == ["verdict", "drivers", "wicket", "how_chosen", "closing"]


def test_the_wicket_block_has_four_cases_and_can_be_left_out():
    cost = block(blocks_for(state_for(**WICKET_COST))[1], "wicket")
    assert cost["title"] == "What a wicket costs" and "costs about 7.0 runs" in cost["sentences"][0]
    assert cost["visual"] == {"fact_id": "wicket_cost", "direction": "cost", "figure": "7.0", "unit": "runs"}
    gain = block(blocks_for(state_for(**WICKET_GAIN))[1], "wicket")
    assert "did not cost runs" in gain["sentences"][0] and "cautious" in gain["sentences"][0]
    hand = block(blocks_for(state_for())[1], "wicket")
    assert hand["title"] == "What a wicket is worth" and "worth about 6.5 runs" in hand["sentences"][0]
    assert block(blocks_for(state_for(**NO_WICKET))[1], "wicket") is None


def test_the_drivers_rows_are_sorted_and_keep_their_signs():
    _, blocks = blocks_for(state_for(features_=("runs_at_10", "wickets_overs_7_10", "sixes_at_10"),
                                     coefs={"runs_at_10": 1.2, "wickets_overs_7_10": -3.0, "sixes_at_10": 0.5}, iqr=20.0))
    rows = block(blocks, "drivers")["visual"]["rows"]
    assert [r["feature"] for r in rows] == ["wickets_overs_7_10", "runs_at_10", "sixes_at_10"]
    signed = {r["feature"]: r["effect_runs"] for r in rows}
    assert signed == {"runs_at_10": 24.0, "wickets_overs_7_10": -60.0, "sixes_at_10": 10.0}
    assert [abs(r["effect_runs"]) for r in rows] == sorted((abs(r["effect_runs"]) for r in rows), reverse=True)
    assert rows[0]["label"] == features.label("wickets_overs_7_10")


def test_one_feature_gives_one_bar_and_unequal_effects_keep_every_bar():
    one = block(blocks_for(state_for(features_=("runs_at_10",), coefs={"runs_at_10": 1.2}))[1], "drivers")
    assert len(one["visual"]["rows"]) == 1
    wide = block(blocks_for(state_for(features_=("runs_at_10", "sixes_at_10"), coefs={"runs_at_10": 5.0, "sixes_at_10": 0.01}))[1],
                 "drivers")
    assert len(wide["visual"]["rows"]) == 2 and wide["visual"]["rows"][1]["display"] == "0.2"


def test_the_year_strip_has_training_three_checks_and_the_test_year():
    segments = block(blocks_for(state_for())[1], "how_chosen")["visual"]["segments"]
    assert [(s["kind"], s["from"], s["to"]) for s in segments] == [
        ("training", 2005, 2022), ("check", 2023, 2023), ("check", 2024, 2024), ("check", 2025, 2025), ("test", 2026, 2026)]


def test_the_verdict_badge_and_variants():
    for kw, badge in (({"forward_mae": 17.0, "tv": 21.0}, "Goal reached"), ({"forward_mae": 17.0, "tv": 19.0}, "Goal missed"),
                      ({"llm_mae": 20.0, "forward_mae": 19.0, "tv": 18.0}, "Goal missed")):
        assert block(blocks_for(state_for(**kw))[1], "verdict")["visual"]["badge"] == badge


@pytest.mark.parametrize("kw", [{}, WICKET_COST, WICKET_GAIN, NO_WICKET, {"tv": 19.0}, {"llm_mae": 20.0, "forward_mae": 19.0, "tv": 18.0},
                                {"features_": ("runs_at_10",), "coefs": {"runs_at_10": 1.2}}])
def test_every_number_in_every_template_text_is_a_fact_and_within_the_limits(kw):
    facts, blocks = blocks_for(state_for(**kw))
    check_section_numbers({"facts": facts, "blocks": blocks})
    for b in blocks:
        assert len(b["title"]) <= MAX_TITLE + 20 and 1 <= len(b["sentences"]) <= max_sentences(b["id"]), b["id"]
        assert all(len(s) <= MAX_SENTENCE + 40 for s in b["sentences"]), b["id"]
        assert not any("{" in s for s in [b["title"], *b["sentences"]])


def test_the_raw_templates_are_within_the_limits_the_model_is_given():
    for bid, raw in cricket_blocks_templates().items():
        assert len(raw["title"]) <= MAX_TITLE, bid
        assert all(len(s) <= MAX_SENTENCE for s in raw["sentences"]), bid


def cricket_blocks_templates():
    """The unfilled template text of each block, found by building the blocks with every placeholder kept."""
    out = {}
    for kw in ({}, WICKET_COST, WICKET_GAIN, {"tv": 19.0}, {"llm_mae": 20.0, "forward_mae": 19.0, "tv": 18.0}):
        facts = facts_for(state_for(**kw))
        for name in ("_verdict", "_wicket", "_how_chosen", "_closing"):
            fn = getattr(cricket_blocks, name)
            b = fn(facts)
            if b:
                out[f"{name}:{sorted(kw)}"] = b
    return out
