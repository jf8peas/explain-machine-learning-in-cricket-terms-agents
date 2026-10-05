"""The messages sent to the language model. App-specific.

The model is told the task, the rules and the exact reply shape; it is shown the catalogue, statistics computed from
the training years only, the attempts so far with their validation errors, and any rejected proposals with reasons.
It is never shown the final-check year or anything computed from it, and it cannot run numbers: code fits and scores
every proposal.
"""
from __future__ import annotations

from typing import Any

from . import features
from .llm_client import LlmRequest
from .state import SET_LIMIT


def reply_schema() -> dict:
    """The JSON shape asked for (as a schema where the model supports structured output)."""
    return {
        "type": "object",
        "properties": {
            "features": {"type": "array", "items": {"type": "string"}},
            "reason": {"type": "string"},
            "finished": {"type": "boolean"},
        },
        "required": ["features", "reason", "finished"],
        "additionalProperties": False,
    }


def build_system(rounds_remaining: int) -> str:
    return (
        "You are helping a cricket analyst choose which measurements (features) to use in a straight-line "
        "(linear regression) model that predicts a T20 first innings' final total from how the innings stood at the "
        "end of the 10th over.\n\n"
        "You may only choose features from the catalogue you are given. Rules:\n"
        "- Use only the feature ids in the catalogue, written exactly as they appear.\n"
        f"- Propose at most {SET_LIMIT} features.\n"
        "- Never propose a set that has already been tried, in any order.\n"
        "- Do not include a feature that can be built exactly from the others in the set (for example wickets lost "
        "together with wickets in hand): a straight-line fit cannot tell such features apart, and the proposal will "
        "be rejected.\n"
        "- You cannot run any numbers. The analyst's code fits every proposal on earlier years and scores it on one "
        "later year; lower validation error (average miss in runs) is better. Do not state or guess any numbers as "
        "results.\n\n"
        "Use what you know about T20 cricket and the results so far to decide what to try next. Reply with JSON only, "
        'in exactly this shape: {"features": ["id", "id"], "reason": "one or two sentences in plain cricket '
        'language", "finished": false}. Set "finished" to true when more tries are unlikely to help; then give your '
        f"best set as the features. You have {rounds_remaining} round{'s' if rounds_remaining != 1 else ''} remaining "
        "(a rejected proposal uses a round)."
    )


def _num(value: Any) -> str:
    return f"{value}"


def build_user(explore: dict, attempts: list[dict], rejections: list[dict]) -> str:
    lines = ["CATALOGUE (the only features you may choose from):"]
    for f in features.CATALOGUE:
        lines.append(f"- {f['id']}: {f['label']} ({f['unit']}). {f['description']}")

    lines += ["", "WHAT THE TRAINING YEARS SHOW:"]
    if explore.get("train_n") is not None:
        lines.append(f"Innings in the training years: {_num(explore['train_n'])}.")
    corr = explore.get("corr_with_total") or {}
    if corr:
        lines.append("Correlation of each measurement with the final total: "
                     + ", ".join(f"{k} {_num(v)}" for k, v in corr.items()) + ".")
    for name, b in (explore.get("by_wickets") or {}).items():
        lines.append(f"With {name}: {_num(b['innings'])} innings, average runs at 10 overs {_num(b['avg_runs_at_10'])}, "
                     f"average runs added after 10 overs {_num(b['avg_added_after_10'])}.")
    comp = explore.get("mean_total_by_competition") or {}
    if comp:
        lines.append("Average final total by competition: " + ", ".join(f"{k} {_num(v)}" for k, v in comp.items()) + ".")

    lines += ["", "ATTEMPTS SO FAR (validation error is the average miss in runs on the validation year; lower is better):"]
    if not attempts:
        lines.append("Nothing yet: this is the first round.")
    for a in attempts:
        verdict = "improved on the best so far" if a.get("improved") else "did not improve"
        lines.append(f"- Round {a['round']}: {', '.join(a['features'])} -> validation error {_num(a['validation_mae'])} "
                     f"({verdict}).")

    if rejections:
        lines += ["", "REJECTED PROPOSALS (these were not fitted):"]
        for r in rejections:
            lines.append(f"- Round {r['round']}: {', '.join(r['features']) or '(no features)'} -> {r['reason']}")
    lines += ["", "Reply with the JSON object only."]
    return "\n".join(lines)


def build_request(*, model: str, rounds_remaining: int, explore: dict, attempts: list[dict], rejections: list[dict],
                  max_tokens: int, timeout: float, structured: bool = True) -> LlmRequest:
    return LlmRequest(model=model, system=build_system(rounds_remaining), user=build_user(explore, attempts, rejections),
                      max_tokens=max_tokens, timeout=timeout, json_schema=reply_schema() if structured else None)
