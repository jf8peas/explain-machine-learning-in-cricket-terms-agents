"""What this app tells the graph page about its stages: notes and the done-beforehand item. App-specific.

The stage set and the loop come from stages.py (the same for every app). This module adds the plain-text notes that
only this app can write, and returns them with the stage set as the extras of the structure response.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

from . import features, selection, setup_settings, state
from .competition_dummies import DUMMIES
from .data_table import DEFAULT_MANIFEST, exclusion_rows
from .data_loading import DataError, load_innings
from .graph import NODE_STAGES
from .methods import term, with_technical
from .wording import doing_lines
from .season_split import rolling_checks
from .stages import CHOOSE_STAGE, FIT_STAGE, STAGES, Row, row_set, stage_set

_COUNT_WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five"}


def _whole(x: float) -> str:
    """A number as written in the notes: no trailing '.0' on a whole number (the same rule goal.py uses)."""
    return str(int(x)) if float(x).is_integer() else str(x)


def note_texts() -> dict[str, str]:
    """The technical note for each stage, for a data scientist. Every number that is a constant of the app is read from
    its constant when this is called, never typed here, so the copy cannot drift from the code."""
    checks = _COUNT_WORDS[len(setup_settings.CHECK_OFFSETS)]
    margin = _whole(state.MARGIN_RUNS)
    return {
        "prepare": "Reads the prepared CSV into a pandas DataFrame and validates it.",
        "split": (
            "Split by calendar year, never at random. Expanding-window cross-validation: each of the "
            f"{checks} years before the latest is scored by a model trained only on earlier years, and the {checks} mean "
            "absolute errors (MAE, the average miss in runs) are averaged. That average chooses the clues, "
            "settings and winning method, while the coefficients are fitted only on each fold's training years. "
            f"The latest year is the {term('test_season')}, read once. Only IPL, BBL and full-member T20Is are scored."),
        "understand": (
            f"Computes summary statistics to brief the {term('agent')} before it proposes: each clue's correlation with the "
            "final total, runs added by wickets down, and mean totals by competition and year. They guide its proposals "
            "only; no model is fitted on them."),
        "frame": (
            f"Regression on the final total, scored by MAE. Before any fitting, two references are scored on the {term('check_seasons')}: "
            f"the {term('tv')} and the {term('average_total')}. The goal is to beat the {term('tv')} by "
            f"{margin} runs of MAE on the {term('test_season')}."),
        "choose": (
            f"Model selection. An {with_technical('idea')} is a set of {term('clues')} (up to {state.SET_LIMIT}) plus three "
            f"{term('settings')}, set before fitting rather than learned: training window, recency weighting and training "
            f"innings. The {term('agent')} proposes ideas; code rejects any that are invalid, already tried, too small to "
            f"train on or perfectly collinear, then fits and cross-validates the rest. The loop runs up to {state.ROUND_CAP} "
            f"rounds and stops after {state.NO_IMPROVE_STOP} without improvement. As the yardstick, the {term('brute_force')} "
            f"tries all {len(selection.GRID)} combinations of settings, adding clues one at a time inside each. Whichever "
            f"method's best idea has the lower cross-validated MAE wins, before the {term('test_season')} is read."),
        "fit": (
            "Fits the idea in closed form (least squares via the normal equations, not gradient descent): an "
            "intercept plus one coefficient per clue, weighted when recency weighting is on. A separate fit is made "
            f"for each of the {term('check_seasons')}, on only the years before it, and the loop repeats this for every new idea. "
            "Solved directly in NumPy rather than scikit-learn (a test confirms identical coefficients) to stay within "
            "Vercel's size limit."),
        "assess": (
            f"The winning {term('idea')} and the other method's best are refitted on every year before the "
            f"{term('test_season')}, then scored once on it alongside the {term('tv')} and the {term('average_total')}. "
            "Selection was already settled on cross-validated MAE, so this is an unbiased estimate of performance on a "
            "new season. Reports "
            f"MAE, R², share within 10 and 20 runs, error as a % of a typical total, and bias, and whether the {margin}-run "
            "goal was met."),
        "interpret": (
            "Code works out a fixed set of named facts from the run and builds the blocks of the results section with "
            f"template wording. A separate {term('agent')} step then writes the titles and sentences, naming facts in braces "
            "and never writing a number: code rejects any reply with a digit, an unknown fact or text over the length "
            "limit, and fills every number in from the facts. If the model is absent or its reply is rejected, the template "
            "wording is used. A clue's importance is coefficient × interquartile range: how many runs a typical difference "
            "in that clue moves the prediction."),
    }


# A stage with no node in this agent must say why. Every stage has a node today, so this is empty.
NO_NODE_REASONS: dict[str, str] = {}


def stage_notes(mapping: Mapping[str, str] = NODE_STAGES, reasons: Mapping[str, str] = NO_NODE_REASONS) -> dict[str, str]:
    """A note for every stage; a stage with no node in the agent must also be given a reason, which is its note."""
    notes = note_texts()
    used = set(mapping.values())
    for stage in STAGES:
        if stage.id in used:
            continue
        if stage.id not in reasons:
            raise ValueError(f"stage '{stage.id}' has no node in this agent and no reason is given for it")
        notes[stage.id] = reasons[stage.id]
    return notes


STAGE_NUMBER = {stage.id: stage.number for stage in STAGES}
DATA_TAB_LINK = {"label": "See the Data tab", "href": "#data"}


def prepare_item(manifest_path: str | Path | None = None) -> dict[str, Any]:
    """The display-only item for the data preparation script: what it excluded and the columns it created. It is not a
    step of the agent. If the manifest cannot be read the item is still sent, saying so, with the link."""
    path = Path(manifest_path) if manifest_path else DEFAULT_MANIFEST
    item = {"id": "prepare_data", "label": "data preparation script", "stage": "prepare", "before": "load_data"}
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
        rows = [{"label": f"Excluded: {r['label']}", "value": r["value"]} for r in exclusion_rows(manifest)]
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return {**item, "summary": {"text": "Details could not be loaded.", "link": DATA_TAB_LINK}}
    measured = sum(1 for f in features.CATALOGUE if "measured" in f["source"])
    rows += [
        {"label": "Columns measured from the ball-by-ball data", "value": str(measured)},
        {"label": "Columns worked out from those", "value": str(len(features.CATALOGUE) - measured)},
        {"label": "Competition columns", "value": " and ".join(DUMMIES)},
    ]
    text = ("Done once, before the agent runs, by scripts/prepare_data.py. The agent does not do any of this: it only "
            "ever sees the innings that were kept.")
    return {**item, "summary": {"text": text, "rows": rows, "link": DATA_TAB_LINK}}


def loop_note(data_path: str | Path | None = None) -> str | None:
    """One sentence naming the validation years and the test year. The years come from the same rolling checks the agent
    uses; if the data cannot be read there is no note at all, rather than a sentence without years."""
    try:
        rolling = rolling_checks(load_innings(data_path, required=["match_date", "in_test_population"]))
        years = [str(c.year) for c in rolling.checks]
        return f"{term('check_seasons').capitalize()}: {', '.join(years[:-1])} and {years[-1]}; {term('test_season')}: {rolling.test_year}, used once."
    except (DataError, IndexError, KeyError, ValueError):
        return None


def test_year(data_path: str | Path | None = None) -> int | None:
    """The test season's year, from the same rolling checks the agent uses (only the year: no test row is read), or None."""
    try:
        return rolling_checks(load_innings(data_path, required=["match_date", "in_test_population"])).test_year
    except (DataError, IndexError, KeyError, ValueError):
        return None


def rows() -> tuple[Row, ...]:
    """The display rows in order, with their notes. Every number in a note is read from its constant."""
    return (
        Row("start", "Once, at the start", "data preparation script ran beforehand"),
        Row("round", "Each round", f"up to {state.ROUND_CAP} rounds; rejected ideas count"),
        Row("yardstick", "The yardstick", "runs when the agent stops"),
        Row("end", "Once, at the end", "the test season is unlocked here"),
    )


def structure_extras(manifest_path: str | Path | None = None, data_path: str | Path | None = None) -> dict[str, Any]:
    """Extra fields for GET /api/structure: the stage set, the loop, the notes and the done-beforehand item."""
    return {
        "stages": stage_set(),
        "rows": row_set(rows()),
        "loop": {"fit": FIT_STAGE, "choose": CHOOSE_STAGE},
        "notes": {**({"general": general} if (general := loop_note(data_path)) else {}), "stages": stage_notes()},
        "items": [prepare_item(manifest_path)],
        "doing": doing_lines(test_year(data_path)),
    }
