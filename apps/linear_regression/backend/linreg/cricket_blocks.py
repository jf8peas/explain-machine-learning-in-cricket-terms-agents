"""The blocks of the "In cricket terms" section and their template wording (feature 012). App-specific.

The section is a short sequence of blocks: the verdict, what drives the final total, what a wicket costs (when the
winning model has a wicket feature), how the winner was chosen, and a closing sentence. Each has a title, one visual and
one or two sentences. The wording here is written with {fact_id} placeholders and filled by `fill`, the same function
that fills the language model's wording, so every number in the section is a fact's display text.
"""
from __future__ import annotations

import re
from typing import Any, Mapping

from .cricket_facts import WICKET_COST_FEATURE, WICKET_HAND_FEATURE, Fact, effect_id

PLACEHOLDER = re.compile(r"\{([A-Za-z0-9_]+)\}")

# The wording limits given to the language model (and kept by the templates).
MAX_TITLE = 50
MAX_SENTENCE = 130
MAX_SENTENCES = {"closing": 1}
DEFAULT_MAX_SENTENCES = 2

BLOCK_IDS = ("verdict", "drivers", "wicket", "how_chosen", "closing")
MOVABLE = ("drivers", "wicket", "how_chosen")        # the language model may reorder these (verdict first, closing last)

# What each block shows, in words for the language model's prompt.
BLOCK_PURPOSE = {
    "verdict": "a headline saying whether the winner beat the TV projection and by how many runs, with a goal badge",
    "drivers": "a bar chart of how many runs a typical difference in each feature moves the predicted total",
    "wicket": "one large figure: what a wicket lost by the halfway mark costs by the end of the innings",
    "how_chosen": "a strip of the training years, the three check years and the test year",
    "closing": "one closing sentence on what the result means for a cricket fan",
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
        title = "Goal reached: beat the TV by {beat_tv_by} runs"
        sentences = ["The goal was to beat the TV projection by at least {goal_margin} runs, and the winner did."]
        badge = "Goal reached"
    elif beat:
        title = "Beat the TV by {beat_tv_by} runs: goal missed"
        sentences = ["That is {short_of_goal_by} runs short of the {goal_margin}-run goal."]
        badge = "Goal missed"
    else:
        title = "Did not beat the TV projection"
        sentences = ["The winner missed by {beat_tv_by} runs more on average than the TV projected score."]
        badge = "Goal missed"
    return {"title": title, "sentences": sentences,
            "visual": {"goal_reached": bool(reached), "beat_tv": bool(beat), "badge": badge}}


def _drivers(facts: Mapping[str, Fact], labels: Mapping[str, Mapping[str, str]], features: list[str]) -> dict[str, Any]:
    rows = [{"feature": f, "label": labels[f]["label"], "fact_id": effect_id(f),
             "effect_runs": facts[effect_id(f)]["value"], "display": facts[effect_id(f)]["display"]} for f in features]
    rows.sort(key=lambda r: -abs(r["effect_runs"]))
    return {"title": "What drives the final total",
            "sentences": ["The biggest factor is {biggest_factor}: a typical difference moves the total by about "
                          "{biggest_factor_effect} runs."],
            "visual": {"rows": rows}}


def _wicket(facts: Mapping[str, Fact]) -> dict[str, Any] | None:
    if "wicket_cost" in facts:
        gain = facts["wicket_cost_direction"]["value"] == "gain"
        if gain:
            sentence = ("Oddly, in this data a wicket lost by the halfway mark did not cost runs ({wicket_cost} the other "
                        "way), so be cautious.")
        else:
            sentence = "Each wicket lost by the halfway mark costs about {wicket_cost} runs by the end of the innings."
        return {"title": "What a wicket costs", "sentences": [sentence],
                "visual": {"fact_id": "wicket_cost", "direction": facts["wicket_cost_direction"]["value"],
                           "figure": facts["wicket_cost"]["display"], "unit": "runs"}}
    if "wicket_in_hand_value" in facts:
        less = facts["wicket_in_hand_direction"]["value"] == "less"
        if less:
            sentence = ("Oddly, in this data an extra wicket in hand was worth {wicket_in_hand_value} runs less by the "
                        "end, so treat it with caution.")
        else:
            sentence = "Each extra wicket in hand is worth about {wicket_in_hand_value} runs by the end of the innings."
        return {"title": "What a wicket is worth", "sentences": [sentence],
                "visual": {"fact_id": "wicket_in_hand_value", "direction": facts["wicket_in_hand_direction"]["value"],
                           "figure": facts["wicket_in_hand_value"]["display"], "unit": "runs"}}
    return None


def _how_chosen(facts: Mapping[str, Fact]) -> dict[str, Any]:
    years = [f"check_year_{i}" for i in (1, 2, 3) if f"check_year_{i}" in facts]
    segments = [{"kind": "training", "from": facts["training_from"]["value"], "to": facts["training_to"]["value"],
                 "label": "Training"},
                *[{"kind": "check", "from": facts[y]["value"], "to": facts[y]["value"], "label": "Check"} for y in years],
                {"kind": "test", "from": facts["test_year"]["value"], "to": facts["test_year"]["value"], "label": "Test"}]
    return {"title": "How it was chosen",
            "sentences": ["The winner, {winner_name}, was chosen on the check years, before the test year was touched."],
            "visual": {"segments": segments}}


def _closing(facts: Mapping[str, Fact]) -> dict[str, Any]:
    if facts["goal_reached"]["value"]:
        sentence = "In short: the model called the final total better than the TV projection did."
    elif facts["beat_tv"]["value"]:
        sentence = "In short: the model edged the TV projection, but not by enough for a clear win."
    else:
        sentence = "In short: the TV projected score is still hard to beat."
    return {"title": "What it means", "sentences": [sentence], "visual": {}}


def build_blocks(facts: Mapping[str, Fact], labels: Mapping[str, Mapping[str, str]], features: list[str]) -> list[dict[str, Any]]:
    """The blocks in their default order, with template wording (placeholders filled) and the data for each visual."""
    raw = [("verdict", _verdict(facts)), ("drivers", _drivers(facts, labels, features)), ("wicket", _wicket(facts)),
           ("how_chosen", _how_chosen(facts)), ("closing", _closing(facts))]
    blocks = []
    for bid, b in raw:
        if b is None:
            continue
        blocks.append({"id": bid, "title": fill(b["title"], facts), "sentences": [fill(s, facts) for s in b["sentences"]],
                       "visual": b["visual"]})
    return blocks


def default_order(blocks: list[dict[str, Any]]) -> list[str]:
    return [b["id"] for b in blocks]


def max_sentences(block_id: str) -> int:
    return MAX_SENTENCES.get(block_id, DEFAULT_MAX_SENTENCES)


def wicket_features() -> tuple[str, str]:
    return WICKET_COST_FEATURE, WICKET_HAND_FEATURE
