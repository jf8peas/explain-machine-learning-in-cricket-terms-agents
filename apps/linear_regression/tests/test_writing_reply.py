"""What of the model's wording may be shown (feature 012): no digit, only known placeholders, within the limits."""
import json

import pytest

from linreg.cricket_blocks import MAX_SENTENCE, MAX_TITLE
from linreg.llm_fake import writing_reply
from linreg.llm_reply import UnusableReply
from linreg.writing_reply import parse_writing_reply
from tests.test_explanation_numbers import blocks_for, facts_for, state_for

FACTS = facts_for(state_for())
AVAILABLE = [b["id"] for b in blocks_for(state_for())[1]]


def block(title="A title", *sentences):
    return {"title": title, "sentences": list(sentences) or ["The winner missed by {winner_test_miss} runs."]}


def parse(reply: str):
    return parse_writing_reply(reply, FACTS, AVAILABLE)


def test_a_valid_reply_is_used_as_written():
    w = parse(writing_reply({"verdict": block("Beat the TV"), "closing": block("In short", "It works.")},
                            order=["how_chosen", "wicket", "drivers"], closing_lead="biggest_factor"))
    assert w.blocks["verdict"] == {"title": "Beat the TV", "sentences": ["The winner missed by {winner_test_miss} runs."]}
    assert w.order == ["how_chosen", "wicket", "drivers"] and w.closing_lead == "biggest_factor"


@pytest.mark.parametrize("text", [
    "The winner missed by 18 runs.", "About 2 wickets matter.", "It was the 10th over.", "Two-thirds ½ of it.",
    "Fullwidth １０ runs.", "Roman Ⅷ runs.", "Superscript runs².",
])
def test_any_digit_or_numeric_character_written_by_the_model_rejects_the_whole_reply(text):
    with pytest.raises(UnusableReply):
        parse(writing_reply({"verdict": block("Fine", text), "closing": block("Fine", "Fine.")}))
    with pytest.raises(UnusableReply):
        parse(writing_reply({"verdict": block(text)}))                              # in a title too


def test_a_placeholder_for_a_fact_that_does_not_exist_rejects_the_whole_reply():
    with pytest.raises(UnusableReply):
        parse(writing_reply({"verdict": block("Fine", "It cost {made_up_fact} runs."), "closing": block("Fine", "Fine.")}))


def test_a_malformed_placeholder_rejects_the_whole_reply():
    for bad in ("It cost { winner_test_miss } runs.", "It cost {winner_test_miss runs.", "It cost winner_test_miss} runs."):
        with pytest.raises(UnusableReply):
            parse(writing_reply({"verdict": block("Fine", bad)}))


def test_a_title_or_sentence_over_its_limit_rejects_the_whole_reply():
    with pytest.raises(UnusableReply):
        parse(writing_reply({"verdict": block("x" * (MAX_TITLE + 1))}))
    with pytest.raises(UnusableReply):
        parse(writing_reply({"verdict": block("Fine", "x" * (MAX_SENTENCE + 1))}))
    with pytest.raises(UnusableReply):
        parse(writing_reply({"verdict": block("Fine", "One.", "Two.", "Three.")}))
    with pytest.raises(UnusableReply):
        parse(writing_reply({"closing": block("Fine", "One.", "Two.")}))                 # the closing block is one sentence


def test_a_reply_that_is_not_json_or_has_the_wrong_shape_is_unusable():
    for bad in ("not json at all", "[]", json.dumps({"nothing": 1}), json.dumps({"blocks": []}), ""):
        with pytest.raises(UnusableReply):
            parse(bad)


def test_json_in_a_code_fence_is_found():
    fenced = "Here you go:\n```json\n" + writing_reply({"verdict": block("Fine")}) + "\n```"
    assert parse(fenced).blocks["verdict"]["title"] == "Fine"


def test_a_block_that_is_not_one_of_the_fixed_blocks_is_ignored_and_never_reaches_the_page():
    w = parse(writing_reply({"verdict": block("Fine"), "bonus": block("An extra block"), "chart": block("A chart")}))
    assert set(w.blocks) == {"verdict"}


def test_a_block_missing_its_title_or_sentences_keeps_the_rest():
    w = parse(writing_reply({"verdict": {"sentences": ["Only a sentence."]}, "drivers": {"title": "Only a title"},
                             "closing": {}, "how_chosen": {"title": "", "sentences": []}}))
    assert w.blocks == {"verdict": {"sentences": ["Only a sentence."]}, "drivers": {"title": "Only a title"}}


def test_an_order_or_lead_outside_the_fixed_lists_falls_back_to_the_default():
    for order in (["drivers", "bonus", "wicket"], ["drivers", "wicket"], ["drivers", "drivers", "wicket", "how_chosen"], "x"):
        assert parse(writing_reply({"verdict": block()}, order=order)).order is None
    assert parse(writing_reply({"verdict": block()}, closing_lead="invented_fact")).closing_lead is None
    assert parse(writing_reply({"verdict": block()}, closing_lead="winner_name")).closing_lead is None   # not an allowed lead


def test_an_absent_wicket_block_is_not_in_the_order_and_a_reply_for_it_is_ignored():
    available = [b for b in AVAILABLE if b != "wicket"]
    w = parse_writing_reply(writing_reply({"wicket": block("What a wicket costs")}, order=["drivers", "how_chosen"]),
                            FACTS, available)
    assert "wicket" not in w.blocks and w.order == ["drivers", "how_chosen"]
    assert parse_writing_reply(writing_reply({}, order=["drivers", "wicket", "how_chosen"]), FACTS, available).order is None


def test_markup_in_the_wording_is_kept_as_text_not_removed_or_run():
    w = parse(writing_reply({"verdict": block("Fine", "<b>bold</b> & \"quotes\" <script>x</script>")}))
    assert "<script>" in w.blocks["verdict"]["sentences"][0]               # the page sets it as text
