"""The settings feature 008 fixes, in one place. App-specific.

The test population's full-member list and team-name aliases, the menus the language model and the rival choose from
(training window, recency weighting, training innings), the recency strengths as half-lives, and the minimum innings
the rolling checks need. The prompt, the proposal check, the grid search, the Data tab, the stage notes and the page's
labels all read from here; nothing else holds a member name, a menu id, a half-life or a minimum.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

# --- the test population -----------------------------------------------------------------------------------------

# T20 internationals are in the test population only when both teams are on this list (the leagues always are).
FULL_MEMBERS: tuple[str, ...] = (
    "Afghanistan", "Australia", "Bangladesh", "England", "India", "Ireland", "New Zealand", "Pakistan",
    "South Africa", "Sri Lanka", "West Indies", "Zimbabwe",
)
# A team's spelling in a source file -> its canonical name. Empty today: the Cricsheet T20I download spells every full
# member it contains exactly as listed above. An entry is added when the preparation script's report shows a miss.
TEAM_ALIASES: dict[str, str] = {}

# Full members with no innings in the source data. Cricsheet's T20 internationals file has no Afghanistan match at all
# (checked 2026-10-09), so a test asserts the set of absent members equals this one.
ABSENT_FROM_SOURCE: frozenset[str] = frozenset({"Afghanistan"})
ABSENT_REASON = "Cricsheet's men's T20 internationals download contains no Afghanistan matches."


def canonical_team(name: str, aliases: Mapping[str, str] | None = None) -> str:
    """A team's name after the alias map is applied (a name with no alias is returned as it is)."""
    return (TEAM_ALIASES if aliases is None else aliases).get(name, name)


def is_full_member(name: str, aliases: Mapping[str, str] | None = None) -> bool:
    return canonical_team(name, aliases) in FULL_MEMBERS


# --- the menus ---------------------------------------------------------------------------------------------------

@dataclass(frozen=True)
class Option:
    id: str
    label: str            # plain words, used in sentences and on the page
    param: float | int | None = None   # window: years before the year checked (None = all); weighting: half-life in years


WINDOWS: tuple[Option, ...] = (
    Option("all", "all available seasons", None),
    Option("last_10", "the last 10 seasons", 10),
    Option("last_5", "the last 5 seasons", 5),
    Option("last_3", "the last 3 seasons", 3),
)
# Half-lives in years: an innings `age` years before the year being scored counts 0.5 ** (age / half_life).
WEIGHTINGS: tuple[Option, ...] = (
    Option("none", "every season counting equally", None),
    Option("gentle", "recent seasons counting a little more", 6),
    Option("strong", "recent seasons counting much more", 2),
)
TRAINING_INNINGS: tuple[Option, ...] = (
    Option("population", "full-member and league innings only"),
    Option("all", "all innings, including associate nations"),
)

HALF_LIVES: dict[str, int | None] = {o.id: o.param for o in WEIGHTINGS}
WINDOW_IDS = [o.id for o in WINDOWS]
WEIGHTING_IDS = [o.id for o in WEIGHTINGS]
TRAINING_INNINGS_IDS = [o.id for o in TRAINING_INNINGS]
_LABELS = {"window": {o.id: o.label for o in WINDOWS}, "weighting": {o.id: o.label for o in WEIGHTINGS},
           "training_innings": {o.id: o.label for o in TRAINING_INNINGS}}

# --- the rolling checks ------------------------------------------------------------------------------------------

CHECK_OFFSETS = (3, 2, 1)     # with test year Y the checks are Y-3, Y-2 and Y-1
MIN_CHECK_INNINGS = 100       # test-population innings each check year (and the test year) needs
MIN_TRAIN_INNINGS = 150       # innings a setup's window and training-innings choice must leave for each check


def window_years(window_id: str) -> int | None:
    """How many years before the year being scored a window reaches back, or None for all of them."""
    return next(o.param for o in WINDOWS if o.id == window_id)


def weight_for_age(age: float, weighting_id: str) -> float:
    """The weight of one training innings `age` years before the year being scored (1 when there is no weighting)."""
    half_life = HALF_LIVES[weighting_id]
    return 1.0 if half_life is None else 0.5 ** (age / half_life)


def label(menu: str, option_id: str) -> str:
    """The plain label of a menu option (the id itself if it is not on the menu)."""
    return _LABELS[menu].get(option_id, option_id)


def setup_words(window: str, weighting: str, training_innings: str) -> str:
    """The non-feature parts of a setup in cricket language, for the explanation and the page."""
    return (f"learned from {label('window', window)}, with {label('weighting', weighting)}, "
            f"using {label('training_innings', training_innings)}")


def public_menus() -> dict[str, list[dict[str, str]]]:
    """The menus as the page reads them (ids and labels only)."""
    def group(options: tuple[Option, ...]) -> list[dict[str, str]]:
        return [{"id": o.id, "label": o.label} for o in options]
    return {"window": group(WINDOWS), "weighting": group(WEIGHTINGS), "training_innings": group(TRAINING_INNINGS)}


# The one wording for the first hyperparameter tuning on the site: the stage 5 note and the line under the grid both use it.
HYPERPARAMETER_NOTE = (
    "Two of the choices here, how many past seasons to learn from (the training window) and how much recent seasons count "
    "(the recency weighting), are hyperparameters: settings chosen before fitting, not learned from the data. This is the "
    "first app on the site to tune them, and the rival does it by trying every combination, which is called a grid search.")
