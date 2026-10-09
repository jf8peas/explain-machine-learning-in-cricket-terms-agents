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
    "train_n": 2133,
    "mean_total_by_year": {2021: 150.2, 2022: 158.9},
    "innings_by_competition_year": {2021: {"bbl": 61, "ipl": 60, "t20i": 99}, 2022: {"bbl": 55, "ipl": 74, "t20i": 100}},
}
ATTEMPTS = [
    {"features": ["runs_at_10"], "proposer": "llm", "window": "all", "weighting": "none", "training_innings": "population",
     "validation_mae": 17.4, "validation_r2": 0.61, "improved": True, "round": 1,
     "checks": [{"year": 2023, "mae": 18.1}, {"year": 2024, "mae": 17.2}, {"year": 2025, "mae": 16.9}]},
    {"features": ["runs_at_10", "wickets_in_hand"], "proposer": "llm", "window": "last_5", "weighting": "gentle",
     "training_innings": "all", "validation_mae": 16.2, "validation_r2": 0.66, "improved": True, "round": 2,
     "checks": [{"year": 2023, "mae": 16.8}, {"year": 2024, "mae": 16.1}, {"year": 2025, "mae": 15.7}]},
]
REJECTIONS = [{"round": 3, "features": ["wickets_at_10", "wickets_in_hand"], "window": "all", "weighting": "none",
               "training_innings": "population",
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
    assert "0.812" in text and "-0.231" in text and "0-1 down" in text and "171.2" in text and "2133" in text


def test_it_includes_each_attempt_with_its_setup_and_its_error_in_each_check():
    text = user(attempts=ATTEMPTS)
    assert "17.4" in text and "16.2" in text and "improved" in text.lower()
    assert "runs_at_10, wickets_in_hand | window last_5 | weighting gentle | training_innings all" in text
    for year, error in (("2023", "18.1"), ("2024", "17.2"), ("2025", "16.9"), ("2023", "16.8"), ("2025", "15.7")):
        assert f"{year}: {error}" in text
    assert "three checks" in text.lower()


def test_it_includes_the_by_year_averages_and_the_innings_counts_by_competition_and_year():
    text = user()
    assert "Average final total by year: 2021 150.2, 2022 158.9" in text
    assert "Innings by year and competition: 2021: bbl 61, ipl 60, t20i 99; 2022: bbl 55, ipl 74, t20i 100" in text


def test_the_system_message_lists_the_menus_with_their_ids_and_says_all_four_parts_are_required():
    from linreg import setup_settings as cfg
    text = build_system(rounds_remaining=4)
    for option in (*cfg.WINDOWS, *cfg.WEIGHTINGS, *cfg.TRAINING_INNINGS):
        assert f'"{option.id}"' in text and option.label in text
    assert "All four parts are required" in text and "window" in text and "training_innings" in text
    assert "same features (in any order), window, weighting and training_innings" in text


def test_the_prompt_never_names_a_year_after_the_ones_it_was_given_or_shows_a_final_check_value():
    text = user(attempts=ATTEMPTS, rejections=REJECTIONS)
    assert "2026" not in text and "final-check" not in text.lower()


def test_it_includes_the_rejections_with_their_reasons():
    text = user(rejections=REJECTIONS)
    assert "wickets_at_10, wickets_in_hand" in text and "repeat each other" in text


def test_the_first_round_says_nothing_has_been_tried():
    assert "nothing yet" in user().lower()


def test_neither_message_mentions_the_final_check_year_or_anything_from_it():
    for text in (build_system(rounds_remaining=3), user(attempts=ATTEMPTS, rejections=REJECTIONS)):
        assert not re.search(r"\btest\b", text, re.IGNORECASE)


def test_the_schema_asks_for_the_whole_setup_the_reason_and_finished():
    from linreg import setup_settings as cfg
    schema = reply_schema()
    assert schema["required"] == ["features", "window", "weighting", "training_innings", "reason", "finished"]
    assert schema["properties"]["window"]["enum"] == cfg.WINDOW_IDS
    assert schema["properties"]["weighting"]["enum"] == cfg.WEIGHTING_IDS
    assert schema["properties"]["training_innings"]["enum"] == cfg.TRAINING_INNINGS_IDS
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
