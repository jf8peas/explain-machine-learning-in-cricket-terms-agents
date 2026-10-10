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

Fact = dict[str, Any]

# Which facts the closing sentence may lead with (the language model may choose one; code supplies the others).
CLOSING_LEADS = ("goal_reached", "biggest_factor", "wicket_cost", "beat_know_nothing_by")

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
                                  "whether the winner beat the TV projection by at least the goal margin")
    facts["beat_tv"] = _fact(beat, "yes/no", "yes" if beat else "no", "whether the winner beat the TV projection at all")
    facts["beat_tv_by"] = _fact(_runs(abs(improvement)), "runs", _one(_runs(abs(improvement))),
                                "the runs of average miss by which the winner beat the TV projection (or missed it, "
                                "if it did not beat it), as a positive number")
    facts["goal_margin"] = _fact(margin_runs, "runs", _shown(margin_runs),
                                 "the margin of improvement over the TV projection that the goal asks for")
    if beat and not reached:
        short = _runs(margin_runs - improvement)
        facts["short_of_goal_by"] = _fact(short, "runs", _one(short),
                                          "how far short of the goal the winner finished, in runs")
    know = final.get("versus_know_nothing")
    if know:
        gain = _runs(abs(know["improvement_runs"]))
        facts["beat_know_nothing_by"] = _fact(gain, "runs", _one(gain),
                                              "the runs of average miss by which the winner beat the know-nothing "
                                              "guess (the average of past totals)")
        facts["beat_know_nothing"] = _fact(bool(know["beat"]), "yes/no", "yes" if know["beat"] else "no",
                                           "whether the winner beat the know-nothing guess")
    facts["winner_name"] = _fact(final["winner_name"], "text", str(final["winner_name"]),
                                 "which method's best setup won (the language model's choice or forward selection)")
    facts["winner_test_miss"] = _fact(_runs(final["winner_mae"]), "runs", _one(_runs(final["winner_mae"])),
                                      "the winner's average miss on the test year")
    facts["tv_test_miss"] = _fact(_runs(final["test_mae"]["tv"]), "runs", _one(_runs(final["test_mae"]["tv"])),
                                  "the TV projection's average miss on the test year")
    won_on = final["validation_mae"][final["winner"]]
    facts["winner_validation_error"] = _fact(_runs(won_on), "runs", _one(_runs(won_on)),
                                             "the winner's average miss over the three check years")
    acc = (final.get("accuracy") or {}).get(final["winner"])
    if acc:
        facts["share_within_10"] = _fact(acc["within_10"], "percent", _one(acc["within_10"]),
                                         f"the share of test innings the winner predicted within {tolerances[0]} runs")
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
    facts["biggest_factor"] = _fact(most, "text", labels[most]["label"], "the feature with the biggest effect")
    facts["biggest_factor_effect"] = _fact(abs(effects[most]), "runs", _one(abs(effects[most])),
                                           "runs a typical difference in the biggest factor moves the prediction")
    facts["n_features"] = _fact(len(features), "count", str(len(features)), "how many features the winning model uses")

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

    for i, c in enumerate(checks, 1):
        facts[f"check_year_{i}"] = _fact(c["year"], "year", str(c["year"]), f"check year number {i}")
    facts["test_year"] = _fact(split["test_year"], "year", str(split["test_year"]), "the test year, used once at the end")
    facts["training_from"] = _fact(split["first_year"], "year", str(split["first_year"]),
                                   "the first year the models could learn from")
    facts["training_to"] = _fact(checks[0]["year"] - 1, "year", str(checks[0]["year"] - 1),
                                 "the last year before the first check year")
    return facts


def display(facts: Mapping[str, Fact], fact_id: str) -> str:
    return facts[fact_id]["display"]
