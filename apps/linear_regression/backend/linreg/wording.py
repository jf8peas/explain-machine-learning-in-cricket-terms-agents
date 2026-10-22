"""The sentences the agent's steps write about themselves (feature 021). App-specific, pure.

Each function takes already-worked-out pieces (numbers, a list of clues in words) and returns the sentence, using the glossary in
methods.py. The nodes call them when a run happens; scripts/reword_recorded_run.py calls them again with the pieces the recorded
run holds, so a recording can be put in today's words without running the agent. Nothing here reads data or a model.
"""
from __future__ import annotations

from .methods import cap, term

AGENT = term("agent")
SEARCH = term("brute_force")
CHECKS = term("check_seasons")
TEST = term("test_season")
IDEA = term("idea")


def load_ok_reason() -> str:
    return f"The data loaded and the three {CHECKS} and the {TEST} have enough innings."


def agent_unavailable() -> str:
    return f"The {AGENT} could not be used for this run."


def split_summary(checks: list[dict], test_year: int, test_n: int) -> str:
    years = ", ".join(str(c["year"]) for c in checks[:-1]) + f" and {checks[-1]['year']}"
    sizes = ", ".join(f"{c['n']}" for c in checks[:-1]) + f" and {checks[-1]['n']}"
    return (f"Every {IDEA} is judged on three {CHECKS}: {years} ({sizes} innings), each time learning only from "
            f"the years before the one being checked. {test_year} ({test_n} innings) is the {TEST}, kept for "
            "one final test. Split by year, never at random, and only IPL, BBL and full-member internationals "
            "are scored.")


def baseline_summary(tv_miss: float, average_total_miss: float) -> str:
    return (f"Averaged over the three {CHECKS} the {term('tv')} (current run rate x 20 overs) misses the "
            f"real total by {tv_miss} runs. That is the score to beat. The {term('average_total')}, the average total of "
            f"the earlier test-population innings whatever the score at 10 overs, misses by "
            f"{average_total_miss} runs.")


def agent_failed_summary(message: str) -> str:
    return f"The {AGENT} could not take part: {message} The run continues with the {SEARCH} only."


def agent_gave_no_proposal() -> str:
    return f"The {AGENT} gave no proposal."


def no_proposal_summary() -> str:
    return f"No proposal to check. Moving on to the {SEARCH}."


def finished_too_soon_message() -> str:
    return f"The {AGENT} said it was finished before any {IDEA} had been tried."


def finished_too_soon_summary(message: str) -> str:
    return f"{message} The run continues with the {SEARCH} only."


def finished_summary() -> str:
    return f"The {AGENT} says it is finished, so the {SEARCH} comes next."


def proposal_named(features: list[str] | None, window, weighting, training_innings) -> str:
    """The proposal as the step names it: its clues, then its other parts in brackets."""
    named = ", ".join(features) if features else "no features"
    parts = [str(p) for p in (window, weighting, training_innings) if p is not None]
    return named + (f" ({'; '.join(parts)})" if parts else "")


def propose_summary(named: str, finished: bool) -> str:
    verdict = "It says it is finished." if finished else "It is not finished."
    return f"The {AGENT} proposes: {named}. {verdict} Its reasoning is shown with this step."


def evaluate_summary(by_year: str, err: float, score: float, verdict: str, tv_miss: float, reason: str | None) -> str:
    return (f"Over the three {CHECKS} ({by_year}) this {IDEA} misses by {err} runs on average "
            f"(R-squared {score}), {verdict}; the {term('tv')} misses by {tv_miss}."
            + (f" The search ends: {reason}." if reason else ""))


def grid_summary(considered: int, fitted: int, setup: str, clues: str, miss: float, reason: str) -> str:
    return (f"The {SEARCH} tried every combination of training innings, window and weighting ({considered} "
            f"considered, {fitted} fitted), adding clues one at a time in each. Its best {IDEA}, {setup}, uses "
            f"{clues} and misses by {miss} runs on average over the "
            f"three {CHECKS}. Choosing between the two methods on the {CHECKS}: {reason}.")


def grid_decision_reason(reason: str) -> str:
    return f"Every combination was considered; {reason}."


def winner_name(winner: str) -> str:
    return f"the {AGENT}" if winner == "llm" else f"the {SEARCH}"


def final_summary(agent_miss: float | None, search_miss: float | None, tv_miss: float, winner: str,
                  average_total_miss: float) -> str:
    parts = ", ".join(f"{name} {value} runs" for name, value in (
        (AGENT, agent_miss), (SEARCH, search_miss), (term("tv"), tv_miss)) if value is not None)
    return (f"Final test, once each on the {TEST}: {parts}. {cap(winner_name(winner))} was chosen on the {CHECKS}. "
            f"The {term('average_total')} missed by {average_total_miss} runs.")


def keep_templates_reason(kind: str, detail: str | None = None) -> str:
    return {
        "stopped_early": f"The {AGENT} stopped early, so the wording is from templates.",
        "not_taken_part": f"The {AGENT} did not take part in this run, so the wording is from templates.",
        "no_budget": f"There was no time or call budget left to ask the {AGENT}, so the wording is from templates.",
        "timeout": f"The {AGENT} did not reply in time, so the wording is from templates.",
        "unreachable": f"The {AGENT} could not be reached for the final wording, so the wording is from templates.",
        "unusable": f"The {AGENT}'s wording could not be used ({detail}), so the wording is from templates.",
        "empty": f"The {AGENT}'s reply had no wording for any block, so the wording is from templates.",
        "failed": "The final wording could not be written, so the wording is from templates.",
    }[kind]


def wrote_summary(covered: int, offered: int) -> str:
    return (f"The {AGENT} wrote the words for {covered} of {offered} takeaways; code filled in every number and every "
            "direction.")
