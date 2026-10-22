"""The words of the page's headlines, worked out on the server from the final test's own figures. App-specific.

The hero's h1 and lead, the verdict's h2, the sentence comparing the agent with the brute-force search and the Scoreboard card's labels
and facts are built here and shown by the page as sent. Every one judges the AGENT's own model against the goal (the pick, the
winner on validation, has its own verdict in goal.py and is shown only in a Commentary card), and none can claim more than the
displayed figures: the case is decided on the same one-decimal misses and the same goal margin as `goal.verdict`.
web/tests/fixtures/headline_cases.json holds the cases that pytest and the page's tests share.
"""
from __future__ import annotations

from typing import Any

from .goal import agent_verdict
from .hero_text import _plural, _runs
from .methods import cap, term

SEARCH = term("brute_force")
AGENT = term("agent")

TOO_CLOSE_RUNS = 0.5          # two displayed misses less than this far apart are "too close to call" (the page's exam.ts rule)

CASES = ("beat", "edged", "held", "no_llm")
OPENING = f"An {AGENT} built its own prediction model."
HERO_H1 = {
    "beat": f"{OPENING} Then it beat the TV.",
    "edged": f"{OPENING} It edged the TV, just short of the goal.",
    "held": f"{OPENING} The TV held on this time.",
    "no_llm": f"The {AGENT} couldn't run, so the {SEARCH} ran alone.",
}
ASKED = "Halfway through a T20 innings, where will it finish?"
LEAD = {
    "agent": f"{ASKED} The agent chose the clues, code did the maths, and it was tested on a season it had never seen.",
    "search": f"{ASKED} The {SEARCH} chose the clues, code did the maths, and it was tested on a season it had never seen.",
}
NO_MADE_UP = f"0 numbers made up by the {AGENT}"
SEASON = "On a season it never saw,"


def _tenths(x: float) -> int:
    return round(x * 10)


def _count(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def _runs_text(x: float) -> str:
    return f"{_runs(x)} {_plural(x)}"


def case_for(agent_miss: float | None, tv_miss: float) -> str:
    """beat, edged, held or no_llm, from the agent's displayed test miss against the TV's and the goal."""
    if agent_miss is None:
        return "no_llm"
    v = agent_verdict(tv_miss, agent_miss)
    return "beat" if v["reached"] else "edged" if v["beat"] else "held"


def verdict_h2(case: str, agent_miss: float | None, search_miss: float | None, tv_miss: float) -> str:
    if case == "no_llm":
        return (f"{SEASON} the {SEARCH} missed by {_runs_text(search_miss)}; the TV missed by {_runs_text(tv_miss)}."
                if search_miss is not None else f"{SEASON} the TV missed by {_runs_text(tv_miss)}.")
    gap = round(tv_miss - agent_miss, 1)
    if case == "beat":
        return f"{SEASON} the agent beat the TV by {_runs_text(gap)}."
    if case == "edged":
        return f"{SEASON} the agent edged the TV by {_runs_text(gap)}, short of the goal."
    if gap == 0:
        return f"{SEASON} the agent and the TV missed by the same amount."
    return f"{SEASON} the TV beat the agent by {_runs_text(-gap)}."


def vs_search(agent_miss: float | None, search_miss: float | None, tries: int) -> str | None:
    """How the agent did against the brute-force search on the test season, or None when either did not run."""
    if agent_miss is None or search_miss is None:
        return None
    gap = _tenths(search_miss) - _tenths(agent_miss)          # tenths of a run; positive: the agent missed by less
    if abs(gap) < TOO_CLOSE_RUNS * 10:
        return f"The agent matched the {SEARCH}, using just {_count(tries, 'try', 'tries')}."
    size = _runs_text(abs(gap) / 10)
    return (f"The agent beat the {SEARCH} by {size}." if gap > 0
            else f"The agent finished {size} behind the {SEARCH}.")


def scoreboard(case: str, agent_miss: float | None, search_miss: float | None, tv_miss: float, tries: int) -> dict[str, Any]:
    """The Scoreboard card's labels and facts. Without a language model the card shows the search, without the tries and the
    claim about the AI, which then has nothing to be said about."""
    subject = agent_miss if agent_miss is not None else search_miss
    facts: list[dict[str, str]] = []
    if case != "no_llm":
        facts += [{"id": "tries", "text": _count(tries, "try", "tries")}, {"id": "no_made_up", "text": NO_MADE_UP}]
    if subject is not None:
        gap = round(tv_miss - subject, 1)
        text = (f"{_runs_text(gap)} closer than the TV" if gap > 0 else
                f"{_runs_text(-gap)} behind the TV" if gap < 0 else "level with the TV")
        facts.append({"id": "gap", "text": text})
    return {"subject_label": AGENT if case != "no_llm" else cap(SEARCH), "subject_miss": subject,
            "tv_miss": tv_miss, "facts": facts}


def build(*, agent_miss: float | None, search_miss: float | None, tv_miss: float, tries: int) -> dict[str, Any]:
    """All the headline words for one final test. The misses are the displayed (one-decimal) average misses on the test
    season; `agent_miss` is None when the agent made no idea that could be fitted; `tries` counts every proposal, rejected ones included."""
    case = case_for(agent_miss, tv_miss)
    return {"case": case, "hero_h1": HERO_H1[case], "lead": LEAD["search" if case == "no_llm" else "agent"],
            "verdict_h2": verdict_h2(case, agent_miss, search_miss, tv_miss),
            "vs_search": vs_search(agent_miss, search_miss, tries),
            "scoreboard": scoreboard(case, agent_miss, search_miss, tv_miss, tries)}
