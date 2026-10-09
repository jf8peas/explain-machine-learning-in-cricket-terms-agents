"""Turn run state into plain cricket sentences. Shared-library candidate.

Every number in the sentences is read from the run state (or derived from it) and recorded in `figures`, so nothing is
hard-coded and nothing comes from a language model. Words, not digits, are used for fixed ideas such as "halfway".
"""
from __future__ import annotations

from typing import Any


def _runs(x: float) -> float:
    return round(float(x), 1)


def build_explanation(state: dict[str, Any], labels: dict[str, dict[str, str]], margin_runs: float,
                      comparison_sentences: list[str] | None = None,
                      verdict_sentence: str | None = None, setup_sentence: str | None = None,
                      setup_figures: dict[str, float] | None = None) -> dict[str, Any]:
    """`comparison_sentences` (how the winner compares with the other references) are placed before the final
    comparison with the TV projection, and `verdict_sentence`, when given, replaces the built-in verdict: both are
    worded by the caller from figures in the state, so this module needs no knowledge of them. `setup_sentence` (the winning
    setup's parts other than its features, worded by the caller from the settings labels) follows the list of features, and
    `setup_figures` holds any number that sentence uses."""
    final = state["final"]
    split = state["split"]
    features: list[str] = state["features"]            # the winning model's features
    coefs: dict[str, float] = state["coefficients"]
    iqr: dict[str, float] = state["feature_iqr"]
    attempts: list[dict] = state.get("attempts", [])
    took_part = bool(final["llm_took_part"])
    mae = final["test_mae"]
    tv = float(mae["tv"])
    winner_mae = float(final["winner_mae"])
    improvement = tv - winner_mae
    beat, cleared = improvement > 0, improvement >= margin_runs

    importance = {f: _runs(abs(coefs[f] * iqr[f])) for f in features}
    most = max(features, key=lambda f: abs(coefs[f] * iqr[f]))

    checks = split["checks"]
    figures: dict[str, float] = {
        "test_n": split["test_n"], "test_year": split["test_year"],
        **{f"check_{i}_{key}": c[key] for i, c in enumerate(checks, 1) for key in ("year", "n")},
        "winner_mae": _runs(winner_mae), "tv_mae": _runs(tv), "improvement": _runs(abs(improvement)),
        "margin_runs": _runs(margin_runs), "r2": round(float(final["winner_r2"]), 2),
        "n_features": len(features), "importance_runs": importance[most], "importance_iqr": _runs(iqr[most]),
        "llm_rounds": state.get("rounds_used", 0),
        "llm_fits": sum(1 for a in attempts if a["proposer"] == "llm"),
        "forward_steps": sum(1 for a in attempts if a["proposer"] == "forward_selection"),
    }
    if mae["llm"] is not None:
        figures["llm_mae"] = _runs(mae["llm"])
    if mae["forward"] is not None:
        figures["forward_mae"] = _runs(mae["forward"])
    if final["margin"] is not None:
        figures["winner_margin"] = _runs(final["margin"])

    lab = lambda f: labels[f]["label"]  # noqa: E731
    unit = lambda f: labels[f]["unit"]  # noqa: E731
    sentences: list[str] = []

    years = ", ".join(f"{c['year']} ({c['n']} innings)" for c in checks[:-1]) + f" and {checks[-1]['year']} ({checks[-1]['n']})"
    sentences.append(
        f"We judged every setup on three check years, {years}, each time learning only from the years before the one "
        f"being checked, and kept {split['test_year']} ({split['test_n']} innings) for one final test that nothing was "
        f"chosen from."
    )

    model = state.get("model_name")
    who = f"The language model ({model})" if model else "The language model"
    if took_part:
        sentences.append(
            f"{who} proposed feature sets over {figures['llm_rounds']} rounds and code fitted and scored each one, "
            f"while forward selection, a mechanical method, added one feature at a time."
        )
        if state.get("llm_status") == "failed" and state.get("llm_failure"):
            sentences.append(
                f"The language model stopped early ({state['llm_failure'].rstrip('.')}), so the best set it had found "
                f"by then was kept for the final test."
            )
    else:
        why = state.get("llm_failure")
        sentences.append(
            "The language model did not take part in this run" + (f" ({why.rstrip('.')})" if why else "")
            + ", so forward selection, a mechanical method that adds one feature at a time, made the choice."
        )

    if mae["llm"] is not None and mae["forward"] is not None:
        winner = final["winner"]
        loser = "forward" if winner == "llm" else "llm"
        name = {"llm": "the language model's choice", "forward": "forward selection"}
        won_on, lost_on = final["validation_mae"][winner], final["validation_mae"][loser]
        figures["winner_validation_mae"], figures["loser_validation_mae"] = _runs(won_on), _runs(lost_on)
        if won_on == lost_on:
            sentences.append(
                f"On the check years the two best setups tied at {_runs(won_on)} runs of average miss, so the language "
                f"model's choice was taken, before the test year was touched."
            )
        else:
            sentences.append(
                f"On the check years {name[winner]} had the lower average miss ({_runs(won_on)} runs against "
                f"{_runs(lost_on)} for {name[loser]}), so it was chosen before the test year was touched."
            )
        sentences.append(
            f"On the final test {name[winner]} missed by {_runs(winner_mae)} runs on average and {name[loser]} by "
            f"{_runs(mae[loser])}."
        )
    else:
        sentences.append(
            f"On the final test the chosen set missed by {_runs(winner_mae)} runs on average."
        )

    sentences.append(
        f"The winning model used {len(features)} feature{'s' if len(features) != 1 else ''}: "
        + (lab(features[0]) if len(features) == 1 else ", ".join(lab(f) for f in features[:-1]) + " and " + lab(features[-1]))
        + "."
    )
    if setup_sentence:
        sentences.append(setup_sentence)
        figures.update(setup_figures or {})
    sentences.append(
        f"The biggest factor was {lab(most)}: a typical difference of {_runs(iqr[most])} {unit(most)} moves the "
        f"predicted final total by about {importance[most]} runs."
    )

    if "wickets_at_10" in coefs:
        c = coefs["wickets_at_10"]
        figures["wicket_cost"] = _runs(abs(c))
        if c < 0:
            sentences.append(
                f"Each extra wicket lost at the halfway mark costs about {_runs(abs(c))} runs by the end of the "
                f"innings, given the other things the model knows."
            )
        else:
            sentences.append(
                f"Surprisingly, in this data a wicket lost at the halfway mark did not cost runs by the end: the "
                f"model gave it a change of {_runs(abs(c))} runs in the other direction, so treat it with caution."
            )
    elif "wickets_in_hand" in coefs:
        c = coefs["wickets_in_hand"]
        figures["wicket_in_hand_value"] = _runs(abs(c))
        sentences.append(
            f"Each extra wicket in hand is worth about {_runs(abs(c))} runs by the end of the innings, "
            f"{'on top of' if c >= 0 else 'but, oddly, less than nothing beside'} the other things the model knows."
        )

    sentences.extend(comparison_sentences or [])
    sentences.append(
        f"On the final test the winning model's prediction was {_runs(winner_mae)} runs away from the real total on "
        f"average, against {_runs(tv)} runs for the TV projected score."
    )
    if beat:
        verdict = f"The winning model beat the TV projection by {_runs(improvement)} runs on average."
        verdict += (f" That clears the {_runs(margin_runs)}-run margin we asked for." if cleared else
                    f" That is short of the {_runs(margin_runs)}-run margin we asked for.")
    else:
        verdict = (f"The winning model did not beat the TV projection: it was {_runs(abs(improvement))} runs worse "
                   f"on average.")
    sentences.append(verdict_sentence or verdict)

    return {
        "sentences": sentences,
        "most_important": most,
        "comparison": {
            "model_mae": _runs(winner_mae), "baseline_mae": _runs(tv), "beat_baseline": beat,
            "cleared_margin": cleared, "improvement": _runs(improvement), "r2": round(float(final["winner_r2"]), 2),
            "winner": final["winner"], "llm_mae": figures.get("llm_mae"), "forward_mae": figures.get("forward_mae"),
            "winner_margin": figures.get("winner_margin"), "llm_took_part": took_part,
        },
        "importance": importance,
        "figures": figures,
    }
