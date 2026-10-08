"""The goal the agent is judged against, and what its result means. App-specific.

The goal is defined once, here, from MARGIN_RUNS. The introduction, the final verdict and the explanation all take its
words and numbers from this module. Everything is worked out from the figures as they are displayed (one decimal), so a
reader can reproduce any verdict from the page.
"""
from __future__ import annotations

from typing import Any

from .state import MARGIN_RUNS

REFERENCE = "broadcaster"            # the method the goal is measured against
CLEARLY_BETTER_SHARE = 0.10          # the projection is "clearly better" than knowing nothing at this much lower miss


def goal() -> dict[str, Any]:
    """The goal: the reference, the margin in runs, and its wording."""
    margin = MARGIN_RUNS
    shown = int(margin) if float(margin).is_integer() else margin
    return {
        "reference": REFERENCE,
        "margin_runs": margin,
        "text": (f"beat the TV projection by at least {shown} runs of average miss, on the latest calendar year, "
                 f"which nothing was trained or chosen on."),
    }


def compare(reference_miss: float, winner_miss: float) -> dict[str, Any]:
    """How much lower the winner's displayed average miss is than a reference's, in runs and as a percentage."""
    improvement = round(reference_miss - winner_miss, 1)
    percent = round(improvement / reference_miss * 100, 1) if reference_miss > 0 else None
    return {"reference_miss": reference_miss, "winner_miss": winner_miss, "improvement_runs": improvement,
            "improvement_percent": percent, "beat": improvement > 0}


def verdict(reference_miss: float, winner_miss: float, winner: str) -> dict[str, Any]:
    """Judge the winning model against the goal, from the two displayed average misses."""
    c = compare(reference_miss, winner_miss)
    return {**c, "reached": c["improvement_runs"] >= MARGIN_RUNS, "winner": winner}


def reference_finding(know_nothing_miss: float, projection_miss: float) -> dict[str, Any]:
    """How good the projection is compared with knowing nothing: clearly, only slightly, or not better."""
    gap = round(know_nothing_miss - projection_miss, 1)
    percent = round(gap / know_nothing_miss * 100, 1) if know_nothing_miss > 0 else None
    if know_nothing_miss > 0 and gap / know_nothing_miss >= CLEARLY_BETTER_SHARE - 1e-9:
        finding = "clearly_better"
    elif gap > 0:
        finding = "slightly_better"
    else:
        finding = "no_better"
    return {"finding": finding, "gap_runs": gap, "gap_percent": percent}


def verdict_sentence(v: dict[str, Any]) -> str:
    """The verdict in plain words: whether the winner beat the projection, by how much, and whether that is the goal."""
    shown = int(MARGIN_RUNS) if float(MARGIN_RUNS).is_integer() else MARGIN_RUNS
    runs, percent = abs(v["improvement_runs"]), v["improvement_percent"]
    pct = f" ({abs(percent):.1f}%)" if percent is not None else ""
    if not v["beat"]:
        return f"The winning model did not beat the TV projection: it was {runs:.1f} runs{pct} worse." if runs else             "The winning model did not beat the TV projection: the two missed by the same amount."
    if v["reached"]:
        return (f"The winning model beat the TV projection by {runs:.1f} runs{pct}, which reaches the goal of at least "
                f"{shown} runs.")
    return (f"The winning model beat the TV projection by {runs:.1f} runs{pct}, which is short of the goal of at least "
            f"{shown} runs.")
