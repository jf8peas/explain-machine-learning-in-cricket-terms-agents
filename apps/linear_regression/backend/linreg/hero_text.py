"""The words of the Working tab's hero, worked out on the server from the response's own figures. App-specific.

The caption, the panel sentence, the footnote and the chart's text equivalent are built here and shown by the page as
sent, so every clause that depends on the figures ("barely helps", "about its typical miss", "too low" or "too high",
the goal margin) is decided in one place and stays true when the figures change. Bias wording comes from accuracy_text.
"""
from __future__ import annotations

from typing import Any, Mapping

from . import accuracy_text
from .methods import cap, short, short_possessive, term

BARELY_HELPS_SHARE = 0.10   # the broadcaster "barely helps" when it beats knowing nothing by no more than this share of that miss
TYPICAL_MISS_SHARE = 0.25   # this innings' miss is "about its typical miss" within this share of the broadcaster's average miss
POPULATION = "IPL, BBL and full-member internationals"


def _runs(x: float) -> str:
    """Whole runs without a decimal point, otherwise one decimal."""
    return f"{x:.0f}" if float(x).is_integer() else f"{x:.1f}"


def _plural(x: float) -> str:
    return "run" if _runs(x) == "1" else "runs"


def miss_words(actual: int, tv: int) -> str:
    """How far the broadcaster's projection was from the total, from the displayed whole numbers: "22 runs short" when it said less
    than the total, "21 runs over" when it said more, "1 run" for one, "spot on" when equal. The page's bracket uses the
    same rule (worm-layout.ts missWords); web/tests/fixtures/miss_words_cases.json holds the cases both are tested on."""
    n = round(actual) - round(tv)
    if n == 0:
        return "spot on"
    size = abs(n)
    return f"{size} {'run' if size == 1 else 'runs'} {'short' if n > 0 else 'over'}"


def barely_helps(know_nothing_miss: float, tv_miss: float) -> bool:
    """True only when the broadcaster is better than knowing nothing, but by no more than BARELY_HELPS_SHARE of its miss."""
    gap = round(know_nothing_miss - tv_miss, 1)
    return know_nothing_miss > 0 and 0 < gap <= BARELY_HELPS_SHARE * know_nothing_miss + 1e-9


def about_typical_miss(innings_miss: float, tv_average_miss: float) -> bool:
    """True when this innings' miss is within TYPICAL_MISS_SHARE of the broadcaster's average miss, either side."""
    return abs(innings_miss - tv_average_miss) <= TYPICAL_MISS_SHARE * tv_average_miss + 1e-9


def panel(know_nothing_miss: float, tv_miss: float, tv_bias: float, margin_runs: float) -> tuple[str, list[str]]:
    """The panel's sentence and the phrases in it to show in bold."""
    gap = round(know_nothing_miss - tv_miss, 1)
    who = short("tv")
    if barely_helps(know_nothing_miss, tv_miss):
        first = f"Knowing the score at 10 overs barely helps {who}"
    elif gap > 0:
        first = f"Knowing the score at 10 overs helps {who}: its average miss is {_runs(gap)} {_plural(gap)} lower"
    elif gap == 0:
        first = f"Knowing the score at 10 overs does not help {who}: it misses by the same amount as knowing nothing"
    else:
        first = (f"Knowing the score at 10 overs does not help {who}: its average miss is {_runs(-gap)} "
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
    """The caption under the chart: which innings, what the grey and white parts are, how the innings went and how far the broadcaster was.
    The direction and size come from the displayed whole numbers (the page's bracket uses the same rule), and so does the
    "about its typical miss" clause, so none of them can disagree with the figures shown."""
    batting, bowling = example["batting_team"], example["bowling_team"]
    total, tv = example["final_total"], example["tv_projection"]
    typical = ": about its typical miss" if about_typical_miss(abs(round(total) - round(tv)), tv_average_miss) else ""
    return (f"A real innings: {batting} v {bowling}, {example['venue']}, {example['date_label']}. "
            f"The first 10 overs, in grey, are context; the white part is what everyone is trying to predict. "
            f"{batting} went from {example['runs_at_10']}/{example['wickets_at_10']} to {total}. "
            f"{cap(short_possessive('tv'))} straight line said {tv} and was {miss_words(total, tv)}{typical}. "
            f"Open circles mark wickets.")


def chart_text(example: Mapping[str, Any], tv_average_miss: float, average_total: float) -> str:
    batting = example["batting_team"]
    total, tv = example["final_total"], example["tv_projection"]
    return (f"Runs by over for {batting} v {example['bowling_team']}, {example['venue']}, {example['date_label']}. "
            f"The first 10 overs are shown in grey as context and the last 10 in the prediction area. "
            f"{batting} were {example['runs_at_10']} for {example['wickets_at_10']} after 10 overs. The {term('tv')} "
            f"said {tv}. The {term('average_total')} said {_runs(average_total)}. The innings finished "
            f"on {total}. A zoom on the finish shows where each prediction landed at 20 overs: the actual total {total}, "
            f"the {term('tv')} {tv} ({miss_words(total, tv)}) and the {term('average_total')} {_runs(average_total)}. {cap(short_possessive('tv'))} "
            f"usual miss is {_runs(tv_average_miss)} runs either way, shown as a band around its projection. The "
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


def goal_card(margin_runs: float, tv_miss: float | None = None, training: Mapping[str, int] | None = None,
              test: Mapping[str, int] | None = None) -> dict[str, Any]:
    """The words of the goal card on the main page's hero (feature 022). The kicker and the goal sentence always; the broadcaster's usual
    miss on past innings (with the years it was worked out on), the target and the "Judged on" line when the figures are known."""
    shown = int(margin_runs) if float(margin_runs).is_integer() else margin_runs
    card: dict[str, Any] = {"kicker": "THE GOAL",
                            "sentence": f"Beat the {term('tv')} by at least {shown} runs on average."}
    if tv_miss is not None and training:
        card["tv"] = {"miss": tv_miss, "label": f"runs: how far out {short('tv')} usually is, on past innings "
                                                f"({training['first_year']}–{training['last_year']})"}
        card["target"] = {"runs": f"{shown}+", "label": "runs closer: what the agent must do"}
    if test:
        card["judged"] = (f"Judged on {test['innings']:,} innings from {test['year']}, a season the agent never sees "
                          "while it works.")
    return card
