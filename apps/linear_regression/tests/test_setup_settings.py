"""The one module that holds the new settings: full members, the setup menus, half-lives and minimums (feature 008)."""
import itertools
import re
from pathlib import Path

import pytest

from linreg import setup_settings as s

APP = Path(__file__).resolve().parent.parent
TWELVE = ["Afghanistan", "Australia", "Bangladesh", "England", "India", "Ireland", "New Zealand", "Pakistan",
          "South Africa", "Sri Lanka", "West Indies", "Zimbabwe"]


def test_the_full_members_are_exactly_the_twelve_named_teams():
    assert sorted(s.FULL_MEMBERS) == TWELVE and len(set(s.FULL_MEMBERS)) == 12


def test_aliases_only_map_to_full_members_and_are_not_themselves_canonical_names():
    assert all(target in s.FULL_MEMBERS for target in s.TEAM_ALIASES.values())
    assert not set(s.TEAM_ALIASES) & set(s.FULL_MEMBERS)


def test_a_name_is_mapped_through_the_aliases_before_membership_is_decided():
    aliases = {"Nepal XI": "India"}
    assert s.canonical_team("Nepal XI", aliases) == "India"
    assert s.is_full_member("Nepal XI", aliases) and not s.is_full_member("Nepal XI", {})
    assert s.canonical_team("Australia", aliases) == "Australia"
    assert not s.is_full_member("Scotland") and not s.is_full_member("Papua New Guinea")


def test_the_menus_have_the_documented_ids_in_order_with_plain_labels():
    assert [o.id for o in s.WINDOWS] == ["all", "last_10", "last_5", "last_3"]
    assert [o.id for o in s.WEIGHTINGS] == ["none", "gentle", "strong"]
    assert [o.id for o in s.TRAINING_INNINGS] == ["population", "all"]
    for option in (*s.WINDOWS, *s.WEIGHTINGS, *s.TRAINING_INNINGS):
        assert option.label.strip() and "<" not in option.label
    assert [s.window_years(o.id) for o in s.WINDOWS] == [None, 10, 5, 3]


def test_half_lives_and_the_weight_of_an_innings_by_age():
    assert s.HALF_LIVES == {"none": None, "gentle": 6, "strong": 2}
    table = {  # research.md Decision 3
        1: (1.00, 0.89, 0.71), 2: (1.00, 0.79, 0.50), 3: (1.00, 0.71, 0.35), 5: (1.00, 0.56, 0.18), 10: (1.00, 0.31, 0.03),
    }
    for age, expected in table.items():
        got = tuple(round(s.weight_for_age(age, w), 2) for w in ("none", "gentle", "strong"))
        assert got == expected, age
    assert s.weight_for_age(2, "strong") == pytest.approx(0.5)


def test_the_check_offsets_and_the_minimums():
    assert s.CHECK_OFFSETS == (3, 2, 1)
    assert s.MIN_CHECK_INNINGS == 100 and s.MIN_TRAIN_INNINGS == 150


def test_the_setup_in_cricket_words():
    words = s.setup_words("last_5", "gentle", "population")
    assert words == ("learned from the last 5 seasons, with recent seasons counting a little more, "
                     "using full-member and league innings only")
    for window, weighting, innings in itertools.product([o.id for o in s.WINDOWS], [o.id for o in s.WEIGHTINGS],
                                                        [o.id for o in s.TRAINING_INNINGS]):
        text = s.setup_words(window, weighting, innings)
        assert text.startswith("learned from ") and text.strip() == text and "<" not in text


def test_the_documented_gap_in_the_source_is_recorded_with_its_reason():
    assert s.ABSENT_FROM_SOURCE == frozenset({"Afghanistan"})
    assert "Cricsheet" in s.ABSENT_REASON
    assert s.ABSENT_FROM_SOURCE <= set(s.FULL_MEMBERS)


def test_public_menus_carry_ids_and_labels_for_the_page():
    menus = s.public_menus()
    assert set(menus) == {"window", "weighting", "training_innings"}
    assert [m["id"] for m in menus["window"]] == [o.id for o in s.WINDOWS]
    assert all(set(m) == {"id", "label"} for group in menus.values() for m in group)


# --- single source: nothing else spells out a member name or a distinctive menu id ----------------------------------

MENU_IDS = re.compile(r"""["'](last_10|last_5|last_3|gentle)["']""")


def _sources():
    for root in (APP / "backend" / "linreg", APP / "web" / "src"):
        for path in root.rglob("*"):
            # the scripted stand-in for the language model names menu ids on purpose: it plays the model's side
            if path.suffix in (".py", ".ts") and path.name not in ("setup_settings.py", "llm_fake.py"):
                yield path


def test_no_other_source_file_names_a_full_member_or_a_menu_id():
    members = re.compile(r"\b(" + "|".join(re.escape(m) for m in s.FULL_MEMBERS) + r")\b")
    offenders = []
    for path in _sources():
        text = path.read_text(encoding="utf-8")
        if members.search(text) or MENU_IDS.search(text):
            offenders.append(str(path.relative_to(APP)))
    assert offenders == []
