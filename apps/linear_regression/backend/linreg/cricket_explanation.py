"""Turn run state into plain cricket sentences. Shared-library candidate.

Every number in the sentences is read from the run state (or derived from it) and recorded in `figures`, so nothing is
hard-coded and nothing comes from a language model. Words, not digits, are used for fixed ideas such as "halfway".
"""
from __future__ import annotations

from typing import Any


def _runs(x: float) -> float:
    return round(float(x), 1)


def build_explanation(state: dict[str, Any], labels: dict[str, dict[str, str]],
                      margin_runs: float) -> dict[str, Any]:
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

    figures: dict[str, float] = {
        "train_n": split["train_n"], "validation_n": split["validation_n"], "test_n": split["test_n"],
        "train_first_year": split["train_years"][0], "train_last_year": split["train_years"][1],
        "validation_year": split["validation_year"], "test_year": split["test_year"],
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

    sentences.append(
        f"We trained on {split['train_n']} innings from {split['train_years'][0]} to {split['train_years'][1]}, chose "
        f"features using {split['validation_n']} innings from {split['validation_year']}, and kept "
        f"{split['test_year']} ({split['test_n']} innings) for one final test that nothing was chosen from."
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
        loser = "forward" if final["winner"] == "llm" else "llm"
        name = {"llm": "the language model's choice", "forward": "forward selection"}
        if final["margin"] == 0:
            sentences.append(
                f"On the final test the two tied at {_runs(winner_mae)} runs of average miss, so forward selection, "
                f"the simpler method, takes it."
            )
        else:
            sentences.append(
                f"On the final test {name[final['winner']]} won: its average miss was {_runs(winner_mae)} runs against "
                f"{_runs(mae[loser])} for {name[loser]}, a gap of {_runs(final['margin'])} runs."
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
    sentences.append(verdict)

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
