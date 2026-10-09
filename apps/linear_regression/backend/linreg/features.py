"""The feature catalogue: every candidate the agent may choose from. App-specific.

Each entry has an id (the column name in innings.csv), cricket wording, a plain-language description, a unit, the
bounds of a valid value, and a source: either measured from the ball-by-ball data (at the end of over 10 and never
later) or a declarative recipe over other columns (see recipes.py). The preparation script, the backend checks, the
language model's prompt and (through /api/catalogue) the browser all read this one definition.
"""
from __future__ import annotations

import pandas as pd

from .competition_dummies import DUMMIES, REFERENCE
from .data_loading import DataError
from .recipes import evaluate, inputs as recipe_inputs
from .state import SET_LIMIT


def _measured() -> dict:
    return {"measured": True}


def _recipe(recipe: dict) -> dict:
    return {"recipe": recipe}


_NAMES = {"ipl": "the IPL", "bbl": "the BBL"}

CATALOGUE: list[dict] = [
    {"id": "runs_at_10", "label": "runs scored at the halfway mark", "unit": "runs", "bounds": {"min": 0},
     "description": "Runs the batting side had scored after 10 overs.", "source": _measured()},
    {"id": "wickets_at_10", "label": "wickets lost at the halfway mark", "unit": "wickets", "bounds": {"min": 0, "max": 9},
     "description": "Wickets the batting side had lost after 10 overs.", "source": _measured()},
    {"id": "powerplay_runs", "label": "runs scored in the powerplay", "unit": "runs", "bounds": {"min": 0},
     "description": "Runs scored in the powerplay, overs 1 to 6.", "source": _measured()},
    {"id": "powerplay_wickets", "label": "wickets lost in the powerplay", "unit": "wickets", "bounds": {"min": 0, "max": 9},
     "description": "Wickets lost in the powerplay, overs 1 to 6.", "source": _measured()},
    {"id": "runs_overs_7_10", "label": "runs scored in overs 7 to 10", "unit": "runs", "bounds": {"min": 0},
     "description": "Runs scored in overs 7 to 10, the stretch just after the powerplay.", "source": _measured()},
    {"id": "wickets_overs_7_10", "label": "wickets lost in overs 7 to 10", "unit": "wickets", "bounds": {"min": 0, "max": 9},
     "description": "Wickets lost in overs 7 to 10, the stretch just after the powerplay.", "source": _measured()},
    {"id": "fours_at_10", "label": "fours hit", "unit": "fours", "bounds": {"min": 0, "max": 60},
     "description": "Fours hit in the first 10 overs.", "source": _measured()},
    {"id": "sixes_at_10", "label": "sixes hit", "unit": "sixes", "bounds": {"min": 0, "max": 60},
     "description": "Sixes hit in the first 10 overs.", "source": _measured()},
    {"id": "dot_balls_at_10", "label": "dot balls faced", "unit": "balls", "bounds": {"min": 0, "max": 80},
     "description": "Balls in the first 10 overs that went for no runs at all.", "source": _measured()},
    {"id": "extras_at_10", "label": "extras conceded", "unit": "runs", "bounds": {"min": 0, "max": 60},
     "description": "Extras the bowling side gave away in the first 10 overs: wides, no-balls, byes and leg-byes.",
     "source": _measured()},
    {"id": "partnership_runs", "label": "runs in the current partnership", "unit": "runs", "bounds": {"min": 0},
     "description": "Runs scored by the pair at the crease since the last wicket fell, as the 10th over ended.",
     "source": _measured()},
    {"id": "balls_since_last_wicket", "label": "balls since the last wicket", "unit": "balls", "bounds": {"min": 0, "max": 80},
     "description": "Legal balls bowled since the last wicket fell, as the 10th over ended. Equals all the balls bowled "
                    "if no wicket had fallen.", "source": _measured()},
    {"id": "wickets_in_hand", "label": "wickets in hand", "unit": "wickets", "bounds": {"min": 1, "max": 10},
     "description": "Wickets still in hand after 10 overs: 10 minus the wickets lost.",
     "source": _recipe({"difference": {"from": 10, "of": "wickets_at_10"}})},
    {"id": "runs_x_wickets_in_hand", "label": "runs at the halfway mark times wickets in hand", "unit": "runs x wickets",
     "bounds": {"min": 0},
     "description": "Runs at 10 overs multiplied by wickets in hand. It is high only when a side is scoring fast and "
                    "still has plenty of wickets to attack with.",
     "source": _recipe({"product": ["runs_at_10", "wickets_in_hand"]})},
    {"id": "batting_full_member", "label": "batting team is a full member", "unit": "0/1", "bounds": {"min": 0, "max": 1},
     "description": "1 if the batting side is an ICC full member playing a T20 international, otherwise 0. IPL and BBL "
                    "sides are franchises, not national teams, so every league innings has 0.", "source": _measured()},
    {"id": "bowling_full_member", "label": "bowling team is a full member", "unit": "0/1", "bounds": {"min": 0, "max": 1},
     "description": "1 if the bowling side is an ICC full member playing a T20 international, otherwise 0. Every league "
                    "innings has 0.", "source": _measured()},
    {"id": "both_full_members", "label": "both teams are full members", "unit": "0/1", "bounds": {"min": 0, "max": 1},
     "description": "1 if both sides are ICC full members. Among the innings the agent is judged on this is the same as "
                    "'not an IPL or BBL innings', so it repeats what the two league columns say together.",
     "source": _recipe({"product": ["batting_full_member", "bowling_full_member"]})},
] + [
    {"id": column, "label": f"innings played in {_NAMES[comp]}", "unit": "0/1", "bounds": {"min": 0, "max": 1},
     "description": f"1 if the innings was played in {_NAMES[comp]}, otherwise 0. A T20 international innings has 0 in "
                    "both competition columns.",
     "source": _recipe({"indicator": {"column": "competition", "equals": comp}})}
    for column, comp in DUMMIES.items()
]

# Short headings for the Data tab's grid and the CSV (the label above is a phrase for sentences).
_HEADINGS = {
    "runs_at_10": "Runs at 10 overs", "wickets_at_10": "Wickets at 10 overs",
    "powerplay_runs": "Powerplay runs (overs 1-6)", "powerplay_wickets": "Powerplay wickets (overs 1-6)",
    "runs_overs_7_10": "Runs in overs 7-10", "wickets_overs_7_10": "Wickets in overs 7-10",
    "fours_at_10": "Fours at 10 overs", "sixes_at_10": "Sixes at 10 overs",
    "dot_balls_at_10": "Dot balls at 10 overs", "extras_at_10": "Extras at 10 overs",
    "partnership_runs": "Partnership runs at 10 overs", "balls_since_last_wicket": "Balls since last wicket",
    "wickets_in_hand": "Wickets in hand", "runs_x_wickets_in_hand": "Runs x wickets in hand",
    "batting_full_member": "Batting team a full member (0/1)", "bowling_full_member": "Bowling team a full member (0/1)",
    "both_full_members": "Both teams full members (0/1)",
    **{column: f"{comp.upper()} (0/1)" for column, comp in DUMMIES.items()},
}
for _f in CATALOGUE:
    _f["heading"] = _HEADINGS[_f["id"]]

IDS: list[str] = [f["id"] for f in CATALOGUE]
BY_ID: dict[str, dict] = {f["id"]: f for f in CATALOGUE}
MEASURED: list[str] = [f["id"] for f in CATALOGUE if f["source"].get("measured")]
DERIVED: list[str] = [f["id"] for f in CATALOGUE if "recipe" in f["source"]]

# The prepared table's columns, in order: the identifying columns, competition and its dummies, venue, the two team
# names, the other candidates in catalogue order, whether the innings is in the test population, then the target.
TEAM_COLUMNS: list[str] = ["batting_team", "bowling_team"]
POPULATION_COLUMN = "in_test_population"
PREPARED_COLUMNS: list[str] = (["match_id", "match_date", "season", "competition", *DUMMIES, "venue", *TEAM_COLUMNS]
                               + [i for i in IDS if i not in DUMMIES] + [POPULATION_COLUMN, "final_total"])


def recipe_of(feature_id: str) -> dict | None:
    return BY_ID[feature_id]["source"].get("recipe")


def measured_inputs(feature_id: str) -> list[str]:
    """The measured columns a feature depends on, found by following recipes down (competition counts as measured)."""
    recipe = recipe_of(feature_id)
    if recipe is None:
        return [feature_id]
    out: list[str] = []
    for column in recipe_inputs(recipe):
        for base in (measured_inputs(column) if column in BY_ID else [column]):
            if base not in out:
                out.append(base)
    return out


def measured_inputs_for(feature_ids: list[str]) -> list[str]:
    """The base measurements needed for a set of features, in first-seen order, without repeats."""
    out: list[str] = []
    for f in feature_ids:
        for base in measured_inputs(f):
            if base not in out:
                out.append(base)
    return out


def manifest_entry() -> dict:
    """What data/manifest.json records about how each candidate is made."""
    return {f["id"]: ({"measured": True} if f["source"].get("measured") else f["source"]["recipe"]) for f in CATALOGUE}


def derive_row(row: dict) -> dict:
    """A copy of one row (a dict of numbers plus competition) with every derived candidate computed, in order."""
    out = dict(row)
    for f in CATALOGUE:
        recipe = f["source"].get("recipe")
        if recipe is not None:
            out[f["id"]] = evaluate(recipe, out)
    return out


def add_derived(df: pd.DataFrame) -> pd.DataFrame:
    """A copy of the table with every derived candidate (including the dummies) computed from its recipe, in order."""
    out = df.copy()
    for f in CATALOGUE:
        recipe = f["source"].get("recipe")
        if recipe is not None:
            out[f["id"]] = evaluate(recipe, out)
    return out


def check_features(df: pd.DataFrame) -> None:
    """Every candidate must be present and not blank, and every derived column must equal its recipe on every row.

    Raises DataError with a plain-English message naming the column and the number of affected rows.
    """
    for f in CATALOGUE:
        column = f["id"]
        if column in DUMMIES:
            continue  # the dummies have their own every-row check (competition_dummies.check_dummies)
        blank = int(pd.to_numeric(df[column], errors="coerce").isna().sum())
        if blank:
            word = "row has" if blank == 1 else "rows have"
            raise DataError(f"{blank} {word} a blank or non-numeric value in {column}.")
    for f in CATALOGUE:
        recipe = f["source"].get("recipe")
        if recipe is None or f["id"] in DUMMIES:
            continue
        wrong = int((pd.to_numeric(df[f["id"]]) != evaluate(recipe, df)).sum())
        if wrong:
            word = "row has" if wrong == 1 else "rows have"
            raise DataError(f"{wrong} {word} a {f['id']} value that does not match its definition.")


def public_catalogue(competition_names: dict[str, str] | None = None) -> dict:
    """What GET /api/catalogue returns. `competition_names` gives display names for the competition choice."""
    names = competition_names or {}
    codes = [REFERENCE, *DUMMIES.values()]
    items = []
    for f in CATALOGUE:
        recipe = f["source"].get("recipe")
        items.append({"id": f["id"], "label": f["label"], "description": f["description"], "unit": f["unit"],
                      "bounds": dict(f["bounds"]), "source": recipe if recipe is not None else {"measured": True},
                      "inputs": measured_inputs(f["id"])})
    return {"limit": SET_LIMIT, "features": items,
            "competition": {"column": "competition", "reference": REFERENCE,
                            "options": [{"value": c, "label": names.get(c, c)} for c in codes]}}


# --- helpers the explanation and older code use ---------------------------------------------------------------

FEATURES = {f["id"]: {"label": f["label"], "unit": f["unit"]} for f in CATALOGUE}


def label(feature: str) -> str:
    return FEATURES[feature]["label"]


def unit(feature: str) -> str:
    return FEATURES[feature]["unit"]


def labels() -> dict[str, dict[str, str]]:
    return FEATURES
