"""What this app tells the graph page about its stages: notes and the done-beforehand item. App-specific.

The stage set and the loop come from stages.py (the same for every app). This module adds the plain-text notes that
only this app can write, and returns them with the stage set as the extras of the structure response.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

from . import features, setup_settings
from .competition_dummies import DUMMIES
from .data_table import DEFAULT_MANIFEST, exclusion_rows
from .data_loading import DataError, load_innings
from .graph import NODE_STAGES
from .season_split import rolling_checks
from .stages import CHOOSE_STAGE, FIT_STAGE, STAGES, stage_set

SPLIT_STAGE = "split"
CHOOSE_NOTE = ("In this app, Choose the setup means picking the features and the hyperparameters. "
               + setup_settings.HYPERPARAMETER_NOTE)
SPLIT_NOTE = ("The data is split by calendar year, never at random. Instead of one validation year there are three check "
              "years: each is judged by a model that learned only from the years before it, and the three errors are "
              "averaged, so one odd year cannot decide the winner. The latest year is kept for one final test. Only IPL "
              "and BBL innings and T20 internationals between ICC full members are scored.")

# A stage with no node in this agent must say why. Every stage has a node today, so this is empty.
NO_NODE_REASONS: dict[str, str] = {}


def stage_notes(mapping: Mapping[str, str] = NODE_STAGES, reasons: Mapping[str, str] = NO_NODE_REASONS) -> dict[str, str]:
    """A note per stage: the choose and split statements, and for each stage with no node the reason there is none."""
    notes = {CHOOSE_STAGE: CHOOSE_NOTE, SPLIT_STAGE: SPLIT_NOTE}
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


def loop_note(data_path: str | Path | None = None) -> str:
    """The two loops in plain words. The years come from the same rolling checks the agent uses; if the data cannot be
    read the note is sent without any year rather than with a guess."""
    first = (f"Every time the agent tries a new setup (stage {STAGE_NUMBER[CHOOSE_STAGE]}) it fits the model again "
             f"(stage {STAGE_NUMBER[FIT_STAGE]}), so the two stages form a loop.")
    try:
        rolling = rolling_checks(load_innings(data_path, required=["match_date", "in_test_population"]))
        years = [str(c.year) for c in rolling.checks]
        checks, test = f" ({years[0]}, {years[1]} and {years[2]})", f" ({rolling.test_year})"
    except (DataError, IndexError, KeyError, ValueError):
        checks = test = ""
    return (f"{first} Parameters are learned from the years before each check year. The setup is chosen using the three "
            f"check years{checks}, each judged by a model that learned only from earlier years. The test year{test} is "
            f"used once, at the end.")


def structure_extras(manifest_path: str | Path | None = None, data_path: str | Path | None = None) -> dict[str, Any]:
    """Extra fields for GET /api/structure: the stage set, the loop, the notes and the done-beforehand item."""
    return {
        "stages": stage_set(),
        "loop": {"fit": FIT_STAGE, "choose": CHOOSE_STAGE},
        "notes": {"general": loop_note(data_path), "stages": stage_notes()},
        "items": [prepare_item(manifest_path)],
    }
