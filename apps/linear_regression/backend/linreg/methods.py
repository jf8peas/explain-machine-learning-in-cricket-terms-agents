"""The words for the methods and ideas the page compares, defined once. App-specific.

Every place that names a method or an idea (the introduction, the results table, the chart key, the explanation, the
verdicts, the node summaries) reads from here. `TERMS` is the glossary (feature 021): one plain term per concept, used at every
level, and a technical term shown in brackets after it at its first use in a Commentary or Scorebook panel. `METHODS` are the
four ways of predicting a final total, in display order; their names come from `TERMS`. The two the agent builds are `llm` and
`forward`; the other two are references. Method ids, marker shapes and state keys are identifiers and are not renamed.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Term:
    id: str
    plain: str                  # the word used at every level
    technical: str              # shown in brackets after the plain term, once per Commentary or Scorebook panel
    meaning: str                # one line, for the "Words we use" list
    order: int
    alt_plain: str | None = None


TERMS: tuple[Term, ...] = (
    Term("agent", "AI agent", "language-model agent",
         "The program in which a language model chooses ideas and code checks every number.", 1),
    Term("brute_force", "brute-force search", "grid search with forward selection",
         "Plain code, no AI: it tries every combination of settings and builds the best clues for each.", 2),
    Term("tv", "TV projection", "run rate × 20 overs",
         "The broadcaster's forecast: the runs per over so far, times 20.", 3),
    Term("average_total", "average-total guess", "baseline (the training seasons' average total)",
         "Always guess the typical final total, whatever the score at 10 overs.", 4),
    Term("idea", "idea", "candidate model",
         "One try: a set of clues together with settings.", 5),
    Term("clues", "clues", "features",
         "The facts about an innings a model may use, such as wickets at 10 overs.", 6),
    Term("settings", "settings", "hyperparameters",
         "Choices made before learning starts, such as how many seasons to learn from.", 7),
    Term("check_seasons", "check seasons", "validation (rolling cross-validation)",
         "Seasons used again and again to choose between ideas.", 8),
    Term("test_season", "test season", "hold-out test",
         "The one season kept sealed until the end, then scored once.", 9, alt_plain="final test"),
    Term("pick", "our pick", "the model chosen on the check seasons",
         "The idea that scored best on the check seasons.", 10),
)
TERM_BY_ID = {t.id: t for t in TERMS}


def term(term_id: str) -> str:
    """The plain term for a concept."""
    return TERM_BY_ID[term_id].plain


def with_technical(term_id: str) -> str:
    """The plain term followed by its technical term in brackets: "brute-force search (grid search with forward selection)"."""
    t = TERM_BY_ID[term_id]
    return f"{t.plain} ({t.technical})"


def meaning(term_id: str) -> str:
    return TERM_BY_ID[term_id].meaning


def cap(text: str) -> str:
    """The first letter upper-cased, the rest left alone ("brute-force search" -> "Brute-force search")."""
    return text[:1].upper() + text[1:]


# --- the words that must not appear (feature 021, FR-013) ---------------------------------------------------------------------

@dataclass(frozen=True)
class Banned:
    pattern: str                    # a case-insensitive regular expression
    allowed_in: tuple[str, ...]     # page regions where it may appear; the agent's own reasoning is always exempt


BANNED: tuple[Banned, ...] = (
    Banned(r"\brivals?\b", ()),
    Banned(r"know[- ]nothing", ()),
    Banned(r"mechanical search", ()),
    Banned(r"\bsetups?\b", ()),
    Banned(r"forward selection", ("commentary", "scorebook", "definition")),
)


def banned_in(text: str, allowed_regions: tuple[str, ...] = ()) -> list[str]:
    """The banned patterns found in `text`, leaving out those permitted in any of `allowed_regions`."""
    return [b.pattern for b in BANNED
            if re.search(b.pattern, text, re.IGNORECASE) and not set(b.allowed_in) & set(allowed_regions)]


def has_banned(text: str) -> bool:
    """True when `text` uses any banned word at all (the check on a model's reply, where no region is permitted)."""
    return bool(banned_in(text))


# --- the four methods ---------------------------------------------------------------------------------------------------------

@dataclass(frozen=True)
class Method:
    id: str
    name: str           # how the page names it
    note: str           # one line of technical description
    marker: str         # the open shape that stands for it on the chart


METHODS: tuple[Method, ...] = (
    Method("know_nothing", f"the {term('average_total')}",
           "always the training years' average final total, whatever the score at 10 overs", "square"),
    Method("broadcaster", f"the {term('tv')}",
           "the broadcaster's projected score: current run rate x 20 overs", "circle"),
    Method("llm", f"the {term('agent')}'s model",
           f"a straight line fitted on the {term('clues')} the {term('agent')} picked", "triangle"),
    Method("forward", f"the {term('brute_force')}'s model",
           f"a straight line fitted on the {term('clues')} the {term('brute_force')} picked", "diamond"),
)
BY_ID = {m.id: m for m in METHODS}


def method_defs(ids=None) -> list[dict[str, str]]:
    """Plain data for the page: the given methods (default all), always in display order."""
    wanted = None if ids is None else set(ids)
    return [{"id": m.id, "name": m.name, "note": m.note, "marker": m.marker}
            for m in METHODS if wanted is None or m.id in wanted]


# --- what the page is sent ----------------------------------------------------------------------------------------------------

def definitions() -> dict[str, str]:
    """The three pieces of text that define the brute-force search; the numbers are worked out, never typed."""
    from . import features, setup_settings            # imported here: both import this module for their wording
    combinations = setup_settings.grid_combinations()
    clues = len(features.CATALOGUE)
    subsets = round(2 ** clues, -3)
    return {
        "brute_force": (f"The {term('brute_force')} is plain code, no AI: it tries every combination of {term('settings')} and, "
                        f"inside each, adds {term('clues')} one at a time, keeping whichever cuts the miss most. It is the "
                        f"yardstick: if the agent can't match it, its reasoning isn't adding anything."),
        "brute_force_technical": (f"Technically it is a grid search over {combinations} combinations of three hyperparameters "
                                  f"(which innings, how many seasons, how much recent seasons count), with greedy forward "
                                  f"selection of features in each cell."),
        "brute_force_honest": (f"\"{cap(term('brute_force').split()[0])}\" refers to the settings only: it does not try every possible "
                               f"set of {term('clues')} (2^{clues}, about {subsets:,})."),
    }


def terms_payload() -> list[dict]:
    return [{"id": t.id, "plain": t.plain, "technical": t.technical, "meaning": t.meaning, "order": t.order,
             "alt_plain": t.alt_plain} for t in sorted(TERMS, key=lambda t: t.order)]


def banned_payload() -> list[dict]:
    return [{"pattern": b.pattern, "allowed_in": list(b.allowed_in)} for b in BANNED]


def terms_version() -> str:
    """A short fingerprint of the terms and definitions, stored with the recorded run (the run's own wording is checked by rebuilding it)."""
    body = json.dumps({"terms": terms_payload(), "definitions": definitions()}, sort_keys=True)
    return "w1-" + hashlib.sha256(body.encode("utf-8")).hexdigest()[:12]


def reference_terms() -> dict:
    """Everything the page needs to word itself, sent with /api/reference."""
    return {"terms": terms_payload(), "definitions": definitions(), "banned": banned_payload(),
            "terms_version": terms_version()}
