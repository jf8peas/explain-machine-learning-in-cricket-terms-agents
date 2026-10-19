"""What of the model's wording may be shown (features 012 and 015): no digit, no direction word, only known placeholders,
within the limits, and only for the takeaways."""
import json

import pytest

from linreg.cricket_blocks import CODE_ONLY, MAX_SENTENCE, MAX_TITLE
from linreg.llm_fake import writing_reply
from linreg.llm_reply import UnusableReply
from linreg.writing_reply import parse_writing_reply
from tests.test_explanation_numbers import blocks_for, facts_for, state_for

FACTS = facts_for(state_for())
AVAILABLE = [b["id"] for b in blocks_for(state_for())[1] if b["id"] not in CODE_ONLY]


def block(title="A title", *sentences):
    return {"title": title, "sentences": list(sentences) or ["The TV missed by {tv_test_miss} runs."]}


def parse(reply: str):
    return parse_writing_reply(reply, FACTS, AVAILABLE)


def test_the_available_blocks_are_the_three_takeaways():
    assert AVAILABLE == ["takeaway_run_rate", "takeaway_drivers", "takeaway_tv"]


def test_a_valid_reply_is_used_as_written():
    w = parse(writing_reply({"takeaway_run_rate": block("The run rate helps"), "takeaway_tv": block("TV leans", "It leans {tv_bias_direction}.")}))
    assert w.blocks["takeaway_run_rate"] == {"title": "The run rate helps", "sentences": ["The TV missed by {tv_test_miss} runs."]}
    assert w.blocks["takeaway_tv"]["sentences"] == ["It leans {tv_bias_direction}."]


@pytest.mark.parametrize("text", [
    "The TV missed by 18 runs.", "About 2 wickets matter.", "It was the 10th over.", "Two-thirds ½ of it.",
    "Fullwidth １０ runs.", "Roman Ⅷ runs.", "Superscript runs².",
])
def test_any_digit_or_numeric_character_written_by_the_model_rejects_the_whole_reply(text):
    with pytest.raises(UnusableReply):
        parse(writing_reply({"takeaway_run_rate": block("Fine", text), "takeaway_tv": block("Fine", "Fine.")}))
    with pytest.raises(UnusableReply):
        parse(writing_reply({"takeaway_run_rate": block(text)}))                       # in a title too


@pytest.mark.parametrize("text", [
    "The TV guesses too low.", "The TV guesses too high every time.", "It guesses TOO LOW.", "It guesses too-low.",
    "Add a few runs to it.", "It adds runs.", "Adding runs helps.", "Take off a few runs.", "Taking off runs helps.",
    "Take-off a few runs.", "It tends to underestimate the total.", "It will overestimate things.",
    "It underestimates sides.", "Sides over the line.", "It sits under the line.", "Lower than it should be.",
    "Higher than it should be.", "It overshoots.", "It is an understatement.",
])
def test_a_direction_word_written_by_the_model_rejects_the_whole_reply(text):
    with pytest.raises(UnusableReply, match="direction word"):
        parse(writing_reply({"takeaway_tv": block("Fine", text), "takeaway_run_rate": block("Fine", "Fine.")}))
    with pytest.raises(UnusableReply, match="direction word"):
        parse(writing_reply({"takeaway_tv": block(text)}))                             # in a title too


def test_the_rejection_message_never_repeats_the_models_own_words():
    with pytest.raises(UnusableReply) as exc:
        parse(writing_reply({"takeaway_tv": block("Fine", "It tends to underestimate.")}))
    assert "underestimate" not in str(exc.value)


@pytest.mark.parametrize("text", [
    "The TV guesses {tv_bias_runs} runs {tv_bias_direction}.", "Overall the TV does fine.", "Sides address the oversight.",
    "It covers the overs after the break.", "The address was sent at the weekend.", "A tough task, adequately done.",
    "Sides speed up late, and the TV forgets it.", "The run rate alone is not enough.", "Understanding the game helps.",
])
def test_ordinary_words_and_direction_placeholders_are_accepted(text):
    assert parse(writing_reply({"takeaway_tv": block("Fine", text)})).blocks["takeaway_tv"]["sentences"] == [text]


def test_a_placeholder_for_a_fact_that_does_not_exist_rejects_the_whole_reply():
    with pytest.raises(UnusableReply):
        parse(writing_reply({"takeaway_tv": block("Fine", "It cost {made_up_fact} runs."), "takeaway_run_rate": block("Fine", "Fine.")}))


def test_a_malformed_placeholder_rejects_the_whole_reply():
    for bad in ("It cost { tv_test_miss } runs.", "It cost {tv_test_miss runs.", "It cost tv_test_miss} runs."):
        with pytest.raises(UnusableReply):
            parse(writing_reply({"takeaway_tv": block("Fine", bad)}))


def test_a_title_or_sentence_over_its_limit_rejects_the_whole_reply():
    with pytest.raises(UnusableReply):
        parse(writing_reply({"takeaway_tv": block("x" * (MAX_TITLE + 1))}))
    with pytest.raises(UnusableReply):
        parse(writing_reply({"takeaway_tv": block("Fine", "x" * (MAX_SENTENCE + 1))}))
    with pytest.raises(UnusableReply):
        parse(writing_reply({"takeaway_tv": block("Fine", "One.", "Two.", "Three.")}))


def test_a_reply_that_is_not_json_or_has_the_wrong_shape_is_unusable():
    for bad in ("not json at all", "[]", json.dumps({"nothing": 1}), json.dumps({"blocks": []}), ""):
        with pytest.raises(UnusableReply):
            parse(bad)


def test_json_in_a_code_fence_is_found():
    fenced = "Here you go:\n```json\n" + writing_reply({"takeaway_tv": block("Fine")}) + "\n```"
    assert parse(fenced).blocks["takeaway_tv"]["title"] == "Fine"


def test_a_block_that_is_not_offered_is_ignored_and_never_reaches_the_page():
    w = parse(writing_reply({"takeaway_tv": block("Fine"), "bonus": block("An extra block"), "chart": block("A chart")}))
    assert set(w.blocks) == {"takeaway_tv"}


@pytest.mark.parametrize("old_id", ["drivers", "wicket", "how_chosen", "closing"])
def test_the_old_block_ids_are_ignored(old_id):
    assert parse(writing_reply({old_id: block("Old block")})).blocks == {}


@pytest.mark.parametrize("code_only", list(CODE_ONLY))
def test_the_code_only_blocks_are_never_taken_even_if_the_model_writes_them(code_only):
    # even when the block is (wrongly) listed as available, the verdict and rule of thumb can never carry model words
    w = parse_writing_reply(writing_reply({code_only: block("Model words")}), FACTS, [code_only, *AVAILABLE])
    assert code_only not in w.blocks


def test_a_block_missing_its_title_or_sentences_keeps_the_rest():
    w = parse(writing_reply({"takeaway_run_rate": {"sentences": ["Only a sentence."]}, "takeaway_drivers": {"title": "Only a title"},
                             "takeaway_tv": {}, "takeaway_extra": {"title": "", "sentences": []}}))
    assert w.blocks == {"takeaway_run_rate": {"sentences": ["Only a sentence."]},
                        "takeaway_drivers": {"title": "Only a title"}}


def test_an_order_or_closing_lead_in_the_reply_is_ignored():
    reply = json.dumps({"blocks": {"takeaway_tv": block("Fine")}, "order": ["takeaway_tv"], "closing_lead": "biggest_factor"})
    w = parse(reply)
    assert set(w.blocks) == {"takeaway_tv"} and not hasattr(w, "order") and not hasattr(w, "closing_lead")


def test_markup_in_the_wording_is_kept_as_text_not_removed_or_run():
    w = parse(writing_reply({"takeaway_tv": block("Fine", "<b>bold</b> & \"quotes\" <script>x</script>")}))
    assert "<script>" in w.blocks["takeaway_tv"]["sentences"][0]               # the page sets it as text
