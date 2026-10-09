"""Accuracy figures put into plain cricket words, in one place. App-specific.

The introduction's endpoint, the final state and the explanation all word their figures through here, so a number is
never worded two ways. Every number in a sentence is one of the (already rounded) figures it was given; nothing is
worked out here beyond a difference between two displayed figures.
"""
from __future__ import annotations

from typing import Any, Mapping

PROJECTION = "the TV projection"
NOTHING = "knowing nothing"
_CAP_PROJECTION = "The TV projection"     # str.capitalize() would lower-case the TV


def _runs(x: float) -> str:
    return f"{abs(x):.1f}"


def _plural(x: float) -> str:
    return "run" if _runs(x) == "1.0" else "runs"


def bias_words(bias: float) -> str:
    """"guesses 6.2 runs too low": which way a method leans, and by how many runs on average."""
    if _runs(bias) == "0.0":
        return "leans neither way on average (0.0 runs)"
    return f"guesses {_runs(bias)} {_plural(bias)} too {'high' if bias > 0 else 'low'}"


def bias_short(bias: float) -> str:
    """The bias for a tight table cell: "12.1 too low", or "0.0" when it leans neither way."""
    if _runs(bias) == "0.0":
        return "0.0"
    return f"{_runs(bias)} too {'high' if bias > 0 else 'low'}"


def meter_label(method_name: str) -> str:
    """A method's name as a mark's label: "the TV projection" becomes "TV projection"."""
    name = method_name[4:] if method_name.startswith("the ") else method_name
    return name[:1].upper() + name[1:]


def meter_caption(first_year: int, last_year: int, innings: int) -> str:
    return f"Average miss, runs · {first_year} to {last_year}, {innings:,} innings"


def meter_text(know_nothing_name: str, know_nothing: float, projection_name: str, projection: float,
               goal_value: float) -> str:
    """The meter's text equivalent: all three values and which way is better."""
    return (f"Average miss, lower is better: {know_nothing_name} {know_nothing:.1f}, {projection_name} "
            f"{projection:.1f}, the goal {goal_value:.1f} or less.")


def hit_rate_words(figures: Mapping[str, Any]) -> str:
    return (f"{figures['within_10']:.1f}% of its guesses land within 10 runs of the real total (a boundary or two), "
            f"and {figures['within_20']:.1f}% within 20 runs")


def bar_sentence(first_year: int, last_year: int, innings: int) -> str:
    return (f"Here is how well two simple guesses did against the real final totals in past seasons "
            f"({first_year} to {last_year}, {innings:,} innings). This is the bar the agent has to clear.")


def gap_sentence(know_nothing: Mapping[str, Any], projection: Mapping[str, Any]) -> str:
    """What knowing the score at 10 overs is worth: the gap between the two references."""
    runs = round(know_nothing["average_miss"] - projection["average_miss"], 1)
    percent = round(runs / know_nothing["average_miss"] * 100, 1) if know_nothing["average_miss"] else 0.0
    points = round(projection["within_10"] - know_nothing["within_10"], 1)
    return (f"{_CAP_PROJECTION} misses by {_runs(projection['average_miss'])} runs on average, against "
            f"{_runs(know_nothing['average_miss'])} for the know-nothing guess, which ignores the score at 10 overs. "
            f"Knowing the score at 10 overs is worth {_runs(runs)} runs ({_runs(percent)}%), and {_runs(points)} more "
            f"innings in every 100 land within 10 runs.")


def finding_sentence(finding: str, gap_runs: float, gap_percent: float | None) -> str:
    """Plainly: clearly, only slightly, or not better than knowing nothing."""
    pct = f" ({_runs(gap_percent)}%)" if gap_percent is not None else ""
    if finding == "clearly_better":
        return (f"{_CAP_PROJECTION} is clearly better than {NOTHING}: its average miss is {_runs(gap_runs)} "
                f"runs{pct} lower.")
    if finding == "slightly_better":
        return (f"{_CAP_PROJECTION} is only slightly better than {NOTHING}: its average miss is just "
                f"{_runs(gap_runs)} {_plural(gap_runs)}{pct} lower, so beating it means little.")
    if gap_runs == 0:
        return f"{_CAP_PROJECTION} is no better than {NOTHING}: the two miss by the same amount (a gap of 0.0 runs), so beating it means little."
    return (f"{_CAP_PROJECTION} is no better than {NOTHING}: its average miss is {_runs(gap_runs)} "
            f"{_plural(gap_runs)} higher, so beating it means little.")


def projection_bias_sentence(bias: float) -> str:
    text = f"{_CAP_PROJECTION} {bias_words(bias)} on average"
    if bias < 0 and _runs(bias) != "0.0":
        text += ", because sides tend to score faster in the last 10 overs than their run rate at the halfway mark"
    return text + "."


def large_bias_sentence(direction: str) -> str:
    return (f"Every method that uses the score at 10 overs, the TV projection and the agent's models alike, guesses too "
            f"{direction} by a wide margin on average: a straight line fitted on the data has not removed that lean.")


def comparison_sentences(final: Mapping[str, Any]) -> list[str]:
    """How the winning model compares with the know-nothing guess and the projection, for the explanation. Every number is
    a figure already in the final state; the comparison with the projection is the goal's verdict sentence, not here."""
    winner = final["winner"]
    acc = final["accuracy"]
    versus = final["versus_know_nothing"]
    tolerance = final["tolerances"][0]
    nothing = "the know-nothing guess"
    if versus["beat"]:
        first = (f"Against {nothing}, which ignores the state of the innings, the winning model's average miss was "
                 f"{_runs(versus['improvement_runs'])} runs ({_pct(versus['improvement_percent'])}) lower.")
    elif versus["improvement_runs"] == 0:
        first = f"The winning model did not beat {nothing}: the two missed by the same amount."
    else:
        first = (f"The winning model did not beat {nothing}: its average miss was "
                 f"{_runs(versus['improvement_runs'])} runs ({_pct(versus['improvement_percent'])}) higher.")
    hits = (f"The winning model landed within {tolerance} runs (a boundary or two) of the real total in "
            f"{acc[winner]['within_10']:.1f}% of innings, against {acc['broadcaster']['within_10']:.1f}% for "
            f"{PROJECTION} and {acc['know_nothing']['within_10']:.1f}% for {nothing}.")
    words = final["bias_words"][winner]
    lean = f"The winning model {words}{'' if 'average' in words else ' on average'}."
    out = [first, hits, lean]
    if final.get("bias_sentence"):
        out.append(final["bias_sentence"])
    return out


def _pct(x) -> str:
    return "n/a" if x is None else f"{abs(x):.1f}%"
