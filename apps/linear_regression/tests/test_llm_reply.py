"""Defensive parsing of the language model's reply: plain JSON, a fenced block, or JSON buried in prose."""
import pytest

from linreg.llm_reply import UnusableReply, parse_reply

GOOD = '{"features": ["wickets_in_hand", "runs_at_10"], "reason": "Wickets in hand tell us how hard they can swing.", "finished": false}'


def test_plain_json():
    p = parse_reply(GOOD)
    assert p.features == ["wickets_in_hand", "runs_at_10"]
    assert p.reason == "Wickets in hand tell us how hard they can swing."
    assert p.finished is False


@pytest.mark.parametrize("text", [
    "```json\n" + GOOD + "\n```",
    "```\n" + GOOD + "\n```",
    "  ```JSON\n" + GOOD + "\n```  ",
    "Sure! Here is my proposal:\n" + GOOD + "\nHope that helps.",
    "Thinking... {not it} but then " + GOOD,                     # an earlier brace pair that is not the answer
])
def test_a_fenced_block_or_prose_around_the_json_still_parses(text):
    assert parse_reply(text).features == ["wickets_in_hand", "runs_at_10"]


def test_extra_keys_are_ignored_and_finished_defaults_to_false():
    p = parse_reply('{"features": ["runs_at_10"], "reason": "A start.", "confidence": 0.9, "notes": []}')
    assert p.finished is False


def test_finished_can_be_true():
    p = parse_reply('{"features": ["runs_at_10"], "reason": "That is enough.", "finished": true}')
    assert p.finished is True


def test_the_reason_is_returned_exactly_as_given():
    reason = '  Odd   spacing, "quotes", <b>markup</b> & a trailing space. '
    import json as _json
    p = parse_reply(_json.dumps({"features": ["runs_at_10"], "reason": reason}))
    assert p.reason == reason


@pytest.mark.parametrize("text", [
    "", "   ", "I think you should try runs and wickets.", "{}", "[]", '{"features": "runs_at_10", "reason": "x"}',
    '{"features": ["runs_at_10"]}',                                   # no reason
    '{"reason": "no features"}',
    '{"features": [1, 2], "reason": "numbers are not names"}',
    '{"features": ["runs_at_10"], "reason": "   "}',                  # blank reason
    '{"features": ["runs_at_10"], "reason": 5}',
    "{ not json }", '```json\n{"features": [}\n```', "null",
])
def test_anything_else_is_an_unusable_reply(text):
    with pytest.raises(UnusableReply):
        parse_reply(text)


def test_the_error_message_does_not_repeat_the_whole_reply():
    long = "x" * 5000
    with pytest.raises(UnusableReply) as err:
        parse_reply(long)
    assert len(str(err.value)) < 300
