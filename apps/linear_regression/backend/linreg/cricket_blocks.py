"""The blocks of the final test tab's "In cricket terms" section and their template wording (features 012 and 015). App-specific.

The section is a fixed sequence of blocks: the verdict, three takeaways (what the run rate alone is worth, what drives the
final total, why the TV gets it wrong) and a rule of thumb. Each has a title, one or two sentences and the data for its
visual. The verdict and the rule of thumb are code only: they are always this template wording and never offered to the
language model, because a wrong direction or verdict there would mislead most. The language model may write only the
three takeaways' titles and sentences. The wording here is written with {fact_id} placeholders and filled by `fill`, the
same function that fills the language model's wording, so every number and direction word in the section is a fact's
display text.
"""
from __future__ import annotations

import re
from typing import Any, Mapping

from .cricket_facts import WICKET_COST_FEATURE, WICKET_HAND_FEATURE, Fact, effect_id

PLACEHOLDER = re.compile(r"\{([A-Za-z0-9_]+)\}")

# The wording limits given to the language model (and kept by the templates).
MAX_TITLE = 50
MAX_SENTENCE = 130
DEFAULT_MAX_SENTENCES = 2

BLOCK_IDS = ("verdict", "takeaway_run_rate", "takeaway_drivers", "takeaway_tv", "rule_of_thumb")
CODE_ONLY = ("verdict", "rule_of_thumb")           # always the template wording; never offered to the language model
MOVABLE: tuple[str, ...] = ()                       # the takeaways keep their fixed, numbered order

# What each block the language model writes shows, in words for the language model's prompt.
BLOCK_PURPOSE = {
    "takeaway_run_rate": "takeaway 1: what the TV projection (the run rate alone) is worth next to just guessing the average total",
    "takeaway_drivers": "takeaway 2: what drives the final total, with a small chart of how far each feature moves the prediction",
    "takeaway_tv": "takeaway 3: which way the TV projection tends to be wrong, and why a fan should care",
}


class UnknownFact(KeyError):
    """A placeholder names a fact that does not exist."""


def placeholders(text: str) -> list[str]:
    return PLACEHOLDER.findall(text)


def fill(text: str, facts: Mapping[str, Fact]) -> str:
    """Replace every {fact_id} with the fact's display text. An unknown id is an error, never left in the text."""
    def sub(m: re.Match[str]) -> str:
        fid = m.group(1)
        if fid not in facts:
            raise UnknownFact(fid)
        return str(facts[fid]["display"])
    return PLACEHOLDER.sub(sub, text)


def _verdict(facts: Mapping[str, Fact]) -> dict[str, Any]:
    reached, beat = facts["goal_reached"]["value"], facts["beat_tv"]["value"]
    if reached:
        variant, shape, title = "reached", "tick", "Goal reached"
        sentences = ["The {chosen_label} beat the TV projection by {beat_tv_by} runs on average. The goal was to win by "
                     "at least {goal_margin} runs."]
    elif beat:
        variant, shape, title = "missed_beat", "dash", "Goal missed"
        sentences = ["The {chosen_label} beat the TV projection, but only by {beat_tv_by} runs. The goal was to win by "
                     "at least {goal_margin} runs."]
    else:
        variant, shape, title = "missed_worse", "cross", "Goal missed"
        sentences = (["The TV projection was {beat_tv_by} runs more accurate than the {chosen_label}."]
                     if facts["beat_tv_by"]["value"] else
                     ["The TV projection was exactly as accurate as the {chosen_label}."])
    differs = bool(facts.get("race_leader_differs", {}).get("value"))
    if differs:
        sentences.append("The {race_leader_label} had the shortest bar in this test, but the {chosen_label} was chosen on "
                         "the check seasons, before the test, as it must be.")
    return {"title": title, "sentences": sentences,
            "visual": {"variant": variant, "shape": shape, "race_leader_differs": differs}}


def _takeaway_run_rate(facts: Mapping[str, Fact]) -> dict[str, Any]:
    state = facts["run_rate_state"]["value"]
    if state == "clearly":
        title = "The run rate alone is a real help"
        sentence = ("The TV misses by {tv_test_miss} runs, {tv_gap} fewer than the know-nothing "
                    "guess ({know_nothing_miss}).")
    elif state == "barely":
        title = "The run rate alone barely helps"
        sentence = ("The TV misses by {tv_test_miss} runs, only {tv_gap} fewer than the "
                    "know-nothing guess ({know_nothing_miss}).")
    else:
        title = "The run rate alone does not help"
        sentence = ("The TV misses by {tv_test_miss} runs, no better than the know-nothing guess "
                    "({know_nothing_miss}).")
    return {"title": title, "sentences": [sentence], "visual": {}}


def wicket_kind(facts: Mapping[str, Fact]) -> str | None:
    """How the model treats wickets: "cost" or "gain" (wickets lost by the halfway mark), "hand" or "less" (wickets in
    hand), or None when it has no wicket feature."""
    if "wicket_cost" in facts:
        return facts["wicket_cost_direction"]["value"]
    if "wicket_in_hand_value" in facts:
        return "hand" if facts["wicket_in_hand_direction"]["value"] == "worth" else "less"
    return None


def _takeaway_drivers(facts: Mapping[str, Fact], labels: Mapping[str, Mapping[str, str]], features: list[str]) -> dict[str, Any]:
    rows = [{"feature": f, "label": labels[f]["label"], "fact_id": effect_id(f),
             "effect_runs": facts[effect_id(f)]["value"], "display": facts[effect_id(f)]["display"]} for f in features]
    rows.sort(key=lambda r: -abs(r["effect_runs"]))
    kind = wicket_kind(facts)
    wicket = None
    if kind in ("cost", "gain"):
        wicket = {"fact_id": "wicket_cost", "figure": facts["wicket_cost"]["display"], "direction": kind}
    elif kind in ("hand", "less"):
        wicket = {"fact_id": "wicket_in_hand_value", "figure": facts["wicket_in_hand_value"]["display"], "direction": kind}
    mover = "{biggest_factor} moves it most: a typical difference is worth about {biggest_factor_effect} runs."
    if kind == "cost":
        title = "A lost wicket costs about {wicket_cost} runs"
        sentences = ["Each wicket lost by the halfway mark costs about {wicket_cost} runs by the end, other things "
                      "equal.", mover]
    elif kind == "gain":
        title = "Wickets did not cost runs here"
        sentences = ["Oddly, here a wicket lost by the halfway mark did not cost runs ({wicket_cost} the other way), "
                      "so be cautious.", mover]
    elif kind == "hand":
        title = "Wicket in hand: about {wicket_in_hand_value} runs"
        sentences = ["Each extra wicket in hand at the halfway mark is worth about {wicket_in_hand_value} runs by the "
                      "end, other things equal.", mover]
    elif kind == "less":
        title = "Wickets in hand did not add runs here"
        sentences = ["Oddly, here an extra wicket in hand was worth {wicket_in_hand_value} runs less by the end, so "
                      "be cautious.", mover]
    else:
        title = "What drives the total: {biggest_factor}"
        sentences = ["A typical difference in {biggest_factor} moves the predicted total by about "
                     "{biggest_factor_effect} runs.",
                     "This model has no wicket feature, so it cannot say what a lost wicket costs."]
    return {"title": title, "sentences": sentences, "visual": {"rows": rows, "wicket": wicket}}


def _takeaway_tv(facts: Mapping[str, Fact]) -> dict[str, Any]:
    direction = facts["tv_bias_direction"]["value"]
    if direction == "low":
        title = "Sides speed up, and the TV forgets it"
        sentence = ("On average the TV guesses {tv_bias_runs} runs {tv_bias_direction}: it assumes the run rate "
                    "holds, but sides usually speed up late.")
    elif direction == "high":
        title = "The TV expects more than sides deliver"
        sentence = ("On average the TV guesses {tv_bias_runs} runs {tv_bias_direction}: it assumes the run rate "
                    "holds, and this season it did not.")
    else:
        title = "On average the TV is about right"
        sentence = ("The TV guesses {tv_bias_direction} on average, but it still misses by {tv_test_miss} runs in a "
                    "typical innings.")
    return {"title": title, "sentences": [sentence], "visual": {}}


def _rule_of_thumb(facts: Mapping[str, Fact]) -> dict[str, Any]:
    kind = wicket_kind(facts)
    normal = kind in ("cost", "hand")
    verb = facts["rule_verb"]["value"]
    if verb != "none":
        sentences = ["When the TV shows a projected score, {rule_verb} about {rule_runs} runs."]
        if kind == "cost":
            sentences.append("Then allow for wickets: a bit more if few have fallen, a bit less if many have.")
        elif kind == "hand":
            sentences.append("Then allow for wickets: a bit more if wickets are in hand, a bit less if not.")
    else:
        if normal:
            sentences = ["The TV's projection is about right on average, so use it as it is.",
                         ("Then allow for wickets: each one lost by the halfway mark costs about {wicket_cost} runs."
                          if kind == "cost" else
                          "Then allow for wickets: each extra wicket in hand is worth about {wicket_in_hand_value} runs.")]
        else:
            sentences = ["The TV's projection is about right on average, so use it as it is, but expect it to miss by "
                         "{tv_test_miss} runs in a typical innings."]
    return {"title": "A rule of thumb for watching", "sentences": sentences, "visual": {}}


def build_blocks(facts: Mapping[str, Fact], labels: Mapping[str, Mapping[str, str]], features: list[str]) -> list[dict[str, Any]]:
    """The blocks in their fixed order, with template wording (placeholders filled) and the data for each visual."""
    raw = [("verdict", _verdict(facts)), ("takeaway_run_rate", _takeaway_run_rate(facts)),
           ("takeaway_drivers", _takeaway_drivers(facts, labels, features)), ("takeaway_tv", _takeaway_tv(facts)),
           ("rule_of_thumb", _rule_of_thumb(facts))]
    return [{"id": bid, "title": fill(b["title"], facts), "sentences": [fill(s, facts) for s in b["sentences"]],
             "visual": b["visual"], "from_model": []} for bid, b in raw]


def default_order(blocks: list[dict[str, Any]]) -> list[str]:
    return [b["id"] for b in blocks]


def max_sentences(block_id: str) -> int:
    return DEFAULT_MAX_SENTENCES


def wicket_features() -> tuple[str, str]:
    return WICKET_COST_FEATURE, WICKET_HAND_FEATURE
