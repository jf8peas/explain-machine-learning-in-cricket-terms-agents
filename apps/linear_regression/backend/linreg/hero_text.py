"""The words of the Working tab's hero, worked out on the server from the response's own figures. App-specific.

The caption, the panel sentence, the footnote and the chart's text equivalent are built here and shown by the page as
sent, so every clause that depends on the figures ("barely helps", "about its typical miss", "too low" or "too high",
the goal margin) is decided in one place and stays true when the figures change. Bias wording comes from accuracy_text.
"""
from __future__ import annotations

from typing import Any, Mapping

from . import accuracy_text

BARELY_HELPS_SHARE = 0.10   # the TV "barely helps" when it beats knowing nothing by no more than this share of that miss
TYPICAL_MISS_SHARE = 0.25   # this innings' miss is "about its typical miss" within this share of the TV's average miss
POPULATION = "IPL, BBL and full-member internationals"


def _runs(x: float) -> str:
    """Whole runs without a decimal point, otherwise one decimal."""
    return f"{x:.0f}" if float(x).is_integer() else f"{x:.1f}"


def _plural(x: float) -> str:
    return "run" if _runs(x) == "1" else "runs"


def barely_helps(know_nothing_miss: float, tv_miss: float) -> bool:
    """True only when the TV is better than knowing nothing, but by no more than BARELY_HELPS_SHARE of its miss."""
    gap = round(know_nothing_miss - tv_miss, 1)
    return know_nothing_miss > 0 and 0 < gap <= BARELY_HELPS_SHARE * know_nothing_miss + 1e-9


def about_typical_miss(innings_miss: float, tv_average_miss: float) -> bool:
    """True when this innings' miss is within TYPICAL_MISS_SHARE of the TV's average miss, either side."""
    return abs(innings_miss - tv_average_miss) <= TYPICAL_MISS_SHARE * tv_average_miss + 1e-9


def panel(know_nothing_miss: float, tv_miss: float, tv_bias: float, margin_runs: float) -> tuple[str, list[str]]:
    """The panel's sentence and the phrases in it to show in bold."""
    gap = round(know_nothing_miss - tv_miss, 1)
    if barely_helps(know_nothing_miss, tv_miss):
        first = "Knowing the score at 10 overs barely helps the TV"
    elif gap > 0:
        first = f"Knowing the score at 10 overs helps the TV: its average miss is {_runs(gap)} {_plural(gap)} lower"
    elif gap == 0:
        first = "Knowing the score at 10 overs does not help the TV: it misses by the same amount as knowing nothing"
    else:
        first = (f"Knowing the score at 10 overs does not help the TV: its average miss is {_runs(-gap)} "
                 f"{_plural(-gap)} higher than knowing nothing")
    emphasis: list[str] = []
    if accuracy_text.bias_short(tv_bias) == "0.0":
        lean = ", and it leans neither way on average"
    else:
        direction = "high" if tv_bias > 0 else "low"
        emphasis = [f"too {direction}"]
        lean = f", and on average it guesses too {direction}, by {accuracy_text.bias_short(tv_bias).split(' ')[0]} runs"
    margin = _runs(margin_runs)
    goal_part = f"The agent has to beat it by at least {margin} {_plural(margin_runs)}."
    return f"{first}{lean}. {goal_part}", emphasis


def footnote(first_year: int, last_year: int, innings: int) -> str:
    return f"{innings:,} past innings, {first_year} to {last_year}: {POPULATION}."


def caption(example: Mapping[str, Any], tv_average_miss: float) -> str:
    batting, bowling = example["batting_team"], example["bowling_team"]
    last_ten = example["final_total"] - example["runs_at_10"]
    typical = ": about its typical miss" if about_typical_miss(example["tv_miss"], tv_average_miss) else ""
    return (f"A real innings: {batting} v {bowling}, {example['venue']}, {example['date_label']}. {batting} made "
            f"{example['runs_at_10']} in the first 10 overs and {last_ten} in the last 10. The TV's straight line assumed "
            f"the same pace, said {example['tv_projection']}, and was {_runs(example['tv_miss'])} runs out{typical}. "
            f"Open circles mark wickets.")


def chart_text(example: Mapping[str, Any], tv_average_miss: float, average_total: float) -> str:
    batting = example["batting_team"]
    return (f"Runs by over for {batting} v {example['bowling_team']}, {example['venue']}, {example['date_label']}. "
            f"{batting} were {example['runs_at_10']} for {example['wickets_at_10']} after 10 overs. The TV projection "
            f"said {example['tv_projection']}. The know-nothing guess said {_runs(average_total)}. The innings finished "
            f"on {example['final_total']}. The TV's average miss is {_runs(tv_average_miss)} runs either way. The "
            f"agent's prediction is not known.")


def build_hero(figures: Mapping[str, Mapping[str, Any]], training: Mapping[str, int], margin_runs: float,
               average_total: float, example: Mapping[str, Any] | None) -> dict[str, Any]:
    """The whole hero block of the response. The caption and the chart text are None without an example."""
    known, tv = figures["know_nothing"], figures["broadcaster"]
    text, emphasis = panel(known["average_miss"], tv["average_miss"], tv["bias"], margin_runs)
    return {
        "caption": caption(example, tv["average_miss"]) if example else None,
        "panel": text,
        "panel_emphasis": emphasis,
        "footnote": footnote(training["first_year"], training["last_year"], training["innings"]),
        "chart_text": chart_text(example, tv["average_miss"], average_total) if example else None,
    }
