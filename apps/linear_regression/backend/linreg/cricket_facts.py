"""The named facts behind the "In cricket terms" section (feature 012). App-specific.

At the end of a run, code works out a fixed set of named facts from the run state. They are the only source of every
number in the section: the template wording and any wording the language model writes both name a fact in braces
(for example "each wicket costs {wicket_cost} runs") and code fills in the fact's display text. No calculation is new:
every value is an existing figure of the run (the importance of a feature is its coefficient times its typical
spread, the verdict and the percentages come from the final test, the years from the rolling checks).

Each fact is {"value", "unit", "display", "meaning"}: `value` is the raw number or text, `display` is the exact text
substituted into wording (rounded the way the page already rounds), and `meaning` is the plain description given to the
language model so it knows what a placeholder stands for.
"""
from __future__ import annotations

from typing import Any, Mapping

from . import accuracy_text
from .accuracy import is_large_bias
from .hero_text import barely_helps
from .methods import term

_AVG, _PICK, _CHECKS, _TEST, _CLUES, _TV = (term("average_total"), term("pick"), term("check_seasons"), term("test_season"),
                                             term("clues"), term("tv"))

Fact = dict[str, Any]

# How the page names a method in a sentence ("The <label> beat the TV projection..."), by method id. From the glossary.
METHOD_LABELS = {"llm": f"{term('agent')}'s model", "forward": f"{term('brute_force')}'s model",
                 "broadcaster": term("tv"), "know_nothing": term("average_total")}

# The share of innings called within 10 runs, in words that finish "...of the real total ___.": (lower bound, phrase).
WITHIN_10_WORDS = ((85.0, "nearly always"), (72.0, "about three quarters of the time"),
                   (62.0, "about two thirds of the time"), (52.0, "a little more than half the time"),
                   (48.0, "only about half the time"), (38.0, "only a little less than half the time"),
                   (28.0, "only about a third of the time"), (15.0, "only about a quarter of the time"),
                   (float("-inf"), "only rarely"))


def within_10_words(share: float) -> str:
    """The displayed (one decimal) within-10 share in words, from the fixed table."""
    shown = round(float(share), 1)
    return next(words for floor, words in WITHIN_10_WORDS if shown >= floor)

WICKET_COST_FEATURE = "wickets_at_10"
WICKET_HAND_FEATURE = "wickets_in_hand"


def _runs(x: float) -> float:
    return round(float(x), 1)


def _shown(x: float) -> str:
    """A number as the page writes it: whole numbers without a trailing '.0', others to one decimal."""
    x = float(x)
    return str(int(x)) if x.is_integer() else f"{x:.1f}"


def _one(x: float) -> str:
    """A measured figure as the page writes it: one decimal, always."""
    return f"{float(x):.1f}"


def _fact(value: Any, unit: str, display: str, meaning: str) -> Fact:
    return {"value": value, "unit": unit, "display": display, "meaning": meaning}


def effect_id(feature: str) -> str:
    return f"effect_{feature}"


def build_facts(state: Mapping[str, Any], labels: Mapping[str, Mapping[str, str]], margin_runs: float) -> dict[str, Fact]:
    """Every fact of the run, by id. `labels` gives each feature's plain name and unit; `margin_runs` is the goal."""
    final = state["final"]
    split = state["split"]
    features: list[str] = list(state["features"])
    coefs: Mapping[str, float] = state["coefficients"]
    iqr: Mapping[str, float] = state["feature_iqr"]
    checks = split["checks"]
    tolerances = final.get("tolerances") or [10, 20]

    improvement = float(final["improvement"])
    beat, reached = improvement > 0, bool(final["cleared_margin"])
    facts: dict[str, Fact] = {}

    facts["goal_reached"] = _fact(reached, "yes/no", "yes" if reached else "no",
                                  f"whether {_PICK} beat the {_TV} by at least the goal margin")
    facts["beat_tv"] = _fact(beat, "yes/no", "yes" if beat else "no", f"whether {_PICK} beat the {_TV} at all")
    facts["beat_tv_by"] = _fact(_runs(abs(improvement)), "runs", _one(_runs(abs(improvement))),
                                f"the runs of average miss by which {_PICK} beat the {_TV} (or missed it, "
                                "if it did not beat it), as a positive number")
    facts["goal_margin"] = _fact(margin_runs, "runs", _shown(margin_runs),
                                 f"the margin of improvement over the {_TV} that the goal asks for")
    if beat and not reached:
        short = _runs(margin_runs - improvement)
        facts["short_of_goal_by"] = _fact(short, "runs", _one(short),
                                          f"how far short of the goal {_PICK} finished, in runs")
    know = final.get("versus_know_nothing")
    if know:
        gain = _runs(abs(know["improvement_runs"]))
        facts["beat_know_nothing_by"] = _fact(gain, "runs", _one(gain),
                                              f"the runs of average miss by which {_PICK} beat the {_AVG} "
                                              "(the average of past totals)")
        facts["beat_know_nothing"] = _fact(bool(know["beat"]), "yes/no", "yes" if know["beat"] else "no",
                                           f"whether {_PICK} beat the {_AVG}")
    facts["tv_test_miss"] = _fact(_runs(final["test_mae"]["tv"]), "runs", _one(_runs(final["test_mae"]["tv"])),
                                  f"the {_TV}'s average miss on the {_TEST}")
    accs: Mapping[str, Mapping[str, float]] = final.get("accuracy") or {}
    acc = accs.get(final["winner"])
    if acc:
        facts["share_within_10"] = _fact(acc["within_10"], "percent", _one(acc["within_10"]),
                                         f"the share of test innings the chosen model predicted within {tolerances[0]} runs")
        facts["share_within_10_words"] = _fact(within_10_words(acc["within_10"]), "text", within_10_words(acc["within_10"]),
                                               "the chosen model's within-the-tolerance share in words, ending 'of the time'")
        facts["test_innings"] = _fact(acc["n"], "count", str(acc["n"]), f"how many innings the {_TEST} has")
    facts["chosen_label"] = _fact(final["winner"], "text", METHOD_LABELS[final["winner"]],
                                  f"the method chosen on the {_CHECKS}, before the {_TEST}")
    facts.update(_reference_facts(accs))
    facts["within_runs_threshold"] = _fact(tolerances[0], "runs", _shown(tolerances[0]),
                                           "the number of runs the 'within' share is measured at")

    # one effect per feature in the winning model: runs a typical difference moves the predicted total
    effects: dict[str, float] = {}
    for f in features:
        e = _runs(coefs[f] * iqr[f])
        effects[f] = e
        label = labels[f]["label"]
        facts[effect_id(f)] = _fact(e, "runs", _one(abs(e)),
                                    f"runs a typical difference in {label} moves the predicted final total "
                                    f"({'adds' if e >= 0 else 'costs'} runs)")
        facts[f"typical_difference_{f}"] = _fact(_runs(iqr[f]), labels[f]["unit"], _shown(_runs(iqr[f])),
                                                 f"a typical difference in {label}")
    most = max(features, key=lambda f: abs(coefs[f] * iqr[f]))
    facts["biggest_factor"] = _fact(most, "text", labels[most]["label"], "the clue with the biggest effect")
    facts["biggest_factor_effect"] = _fact(abs(effects[most]), "runs", _one(abs(effects[most])),
                                           "runs a typical difference in the biggest factor moves the prediction")
    facts["n_features"] = _fact(len(features), "count", str(len(features)), f"how many {_CLUES} the winning model uses")

    if WICKET_COST_FEATURE in coefs:
        c = float(coefs[WICKET_COST_FEATURE])
        facts["wicket_cost"] = _fact(_runs(abs(c)), "runs", _one(_runs(abs(c))),
                                     "runs a wicket lost by the halfway mark changes the final total, absolute value")
        facts["wicket_cost_direction"] = _fact("cost" if c < 0 else "gain", "text", "cost" if c < 0 else "gain",
                                               "whether a wicket cost runs ('cost') or, oddly, did not ('gain')")
    elif WICKET_HAND_FEATURE in coefs:
        c = float(coefs[WICKET_HAND_FEATURE])
        facts["wicket_in_hand_value"] = _fact(_runs(abs(c)), "runs", _one(_runs(abs(c))),
                                              "runs an extra wicket in hand is worth by the end, absolute value")
        facts["wicket_in_hand_direction"] = _fact("worth" if c >= 0 else "less", "text", "worth" if c >= 0 else "less",
                                                  "whether a wicket in hand added runs ('worth') or, oddly, did not "
                                                  "('less')")

    facts["test_year"] = _fact(split["test_year"], "year", str(split["test_year"]), f"the {_TEST}, used once at the end")
    return facts


def _reference_facts(accs: Mapping[str, Mapping[str, float]]) -> dict[str, Fact]:
    """The TV projection against the average-total guess, and which way the TV leans. Empty when they are missing."""
    tv, know = accs.get("broadcaster"), accs.get("know_nothing")
    if not tv or not know:
        return {}
    out: dict[str, Fact] = {}
    gap = round(know["average_miss"] - tv["average_miss"], 1)
    state = "barely" if barely_helps(know["average_miss"], tv["average_miss"]) else "clearly" if gap > 0 else "none"
    out["know_nothing_miss"] = _fact(_runs(know["average_miss"]), "runs", _one(_runs(know["average_miss"])),
                                          f"the {_AVG}'s average miss on the {_TEST}")
    out["tv_gap"] = _fact(abs(gap), "runs", _one(abs(gap)),
                                            f"how many runs apart the {_TV}'s and the {_AVG}'s "
                                            "average misses are (absolute)")
    out["run_rate_state"] = _fact(state, "text", state,
                                  "whether the run rate alone clearly helps, barely helps or does not help")
    # The average-total guess is far off because totals have risen when it passes the existing large-bias rule and guesses too low.
    kbias = know["bias"]
    kleaning = accuracy_text.bias_short(kbias) != "0.0"
    kdirection = ("high" if kbias > 0 else "low") if kleaning else "none"
    rising = is_large_bias(know) and kleaning and kbias < 0
    out["know_nothing_rising"] = _fact(rising, "yes/no", "yes" if rising else "no",
                                       f"whether the {_AVG} is far off because totals have risen (it is far off and guesses too low)")
    out["know_nothing_bias_runs"] = _fact(abs(round(kbias, 1)), "runs", f"{abs(kbias):.1f}",
                                          f"how many runs too low or too high the {_AVG} is on average (absolute)")
    out["know_nothing_bias_direction"] = _fact(kdirection, "text", {"high": "too high", "low": "too low", "none": "about right"}[kdirection],
                                               f"which way the {_AVG} leans on average: too low, too high or about right")
    bias = tv["bias"]
    leaning = accuracy_text.bias_short(bias) != "0.0"
    direction = ("high" if bias > 0 else "low") if leaning else "none"
    out["tv_bias_runs"] = _fact(abs(round(bias, 1)), "runs", f"{abs(bias):.1f}",
                                f"how many runs too low or too high the {_TV} is on average (absolute)")
    out["tv_bias_direction"] = _fact(direction, "text",
                                     {"high": "too high", "low": "too low", "none": "about right"}[direction],
                                     f"which way the {_TV} leans on average: too low, too high or about right")
    large = is_large_bias(tv)
    out["tv_bias_large"] = _fact(large, "yes/no", "yes" if large else "no",
                                 f"whether the {_TV}'s lean is large next to its average miss")
    verb = ("add" if direction == "low" else "take off") if large and leaning else "none"
    out["rule_verb"] = _fact(verb, "text", verb if verb != "none" else "",
                             f"what the rule of thumb does to the {_TV}: add or take off")
    out["rule_runs"] = _fact(abs(round(bias, 1)), "runs", f"{abs(bias):.1f}",
                             f"the runs the rule of thumb adds to or takes off the {_TV}")
    return out


def display(facts: Mapping[str, Fact], fact_id: str) -> str:
    return facts[fact_id]["display"]
