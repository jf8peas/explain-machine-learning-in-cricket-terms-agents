"""What the language model is told: the rules, the catalogue, training-only statistics, the history and the rejections."""
import json
import re

from linreg import features
from linreg.prompts import build_request, build_system, build_user, reply_schema
from linreg.state import SET_LIMIT

EXPLORE = {
    "corr_with_total": {"runs_at_10": 0.812, "wickets_at_10": -0.231, "fours_at_10": 0.402},
    "by_wickets": {"0-1 down": {"innings": 1500, "avg_runs_at_10": 81.2, "avg_added_after_10": 98.4}},
    "mean_total_by_competition": {"ipl": 171.2, "bbl": 160.0, "t20i": 148.7},
    "train_n": 4036,
}
ATTEMPTS = [
    {"features": ["runs_at_10"], "proposer": "llm", "validation_mae": 17.4, "validation_r2": 0.61, "improved": True, "round": 1},
    {"features": ["runs_at_10", "wickets_in_hand"], "proposer": "llm", "validation_mae": 16.2, "validation_r2": 0.66,
     "improved": True, "round": 2},
]
REJECTIONS = [{"round": 3, "features": ["wickets_at_10", "wickets_in_hand"],
               "reason": "wickets lost at the halfway mark and wickets in hand repeat each other."}]


def user(**kw) -> str:
    base = dict(explore=EXPLORE, attempts=[], rejections=[])
    base.update(kw)
    return build_user(**base)


def test_the_system_message_states_the_task_the_rules_the_shape_the_limit_and_the_rounds_left():
    text = build_system(rounds_remaining=4)
    assert "final total" in text and "10th over" in text
    assert str(SET_LIMIT) in text and "4 round" in text
    assert "catalogue" in text and "exactly" in text                        # only catalogue ids, written exactly
    assert "already tried" in text or "never propose a set" in text.lower()
    assert "repeat" in text.lower() or "built exactly" in text              # no redundant sets
    assert '"features"' in text and '"reason"' in text and '"finished"' in text
    assert "code" in text.lower() and "numbers" in text.lower()             # it never produces numbers
    assert "JSON" in text


def test_the_user_message_lists_every_candidate_with_id_label_description_and_unit():
    text = user()
    for f in features.CATALOGUE:
        assert f["id"] in text and f["label"] in text and f["description"] in text and f["unit"] in text


def test_it_includes_the_training_only_statistics():
    text = user()
    assert "0.812" in text and "-0.231" in text and "0-1 down" in text and "171.2" in text and "4036" in text


def test_it_includes_each_attempt_with_its_validation_error():
    text = user(attempts=ATTEMPTS)
    assert "17.4" in text and "16.2" in text and "improved" in text.lower()
    assert "runs_at_10, wickets_in_hand" in text
    assert "validation" in text.lower()


def test_it_includes_the_rejections_with_their_reasons():
    text = user(rejections=REJECTIONS)
    assert "wickets_at_10, wickets_in_hand" in text and "repeat each other" in text


def test_the_first_round_says_nothing_has_been_tried():
    assert "nothing yet" in user().lower()


def test_neither_message_mentions_the_final_check_year_or_anything_from_it():
    for text in (build_system(rounds_remaining=3), user(attempts=ATTEMPTS, rejections=REJECTIONS)):
        assert not re.search(r"\btest\b", text, re.IGNORECASE)


def test_the_schema_asks_for_features_reason_and_finished():
    schema = reply_schema()
    assert schema["required"] == ["features", "reason", "finished"]
    assert schema["properties"]["features"]["items"] == {"type": "string"}
    assert schema["additionalProperties"] is False
    json.dumps(schema)  # it is plain JSON


def test_a_request_carries_the_model_the_caps_and_the_schema():
    req = build_request(model="vendor/m", rounds_remaining=5, explore=EXPLORE, attempts=ATTEMPTS, rejections=[],
                        max_tokens=800, timeout=20.0, structured=True)
    assert (req.model, req.max_tokens, req.timeout) == ("vendor/m", 800, 20.0)
    assert req.json_schema == reply_schema() and "5 round" in req.system and "runs_at_10" in req.user
    plain = build_request(model="vendor/m", rounds_remaining=5, explore=EXPLORE, attempts=[], rejections=[],
                          max_tokens=800, timeout=20.0, structured=False)
    assert plain.json_schema is None
