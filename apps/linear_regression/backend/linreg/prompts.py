"""The messages sent to the language model. App-specific.

The model is told the task, the rules and the exact reply shape; it is shown the catalogue, the menus its setup is chosen
from, statistics from the years before the final-check year only (average totals by year, innings counts by competition and
year), the attempts so far with each one's error in each of the three checks, and any rejected proposals with reasons.
It is never shown the final-check year or anything computed from it, and it cannot run numbers: code fits and scores every
proposal, and code decides how it is judged.
"""
from __future__ import annotations

from typing import Any

from . import features, setup_settings
from .llm_client import LlmRequest
from .state import SET_LIMIT

SETUP_PARTS = ("features", "window", "weighting", "training_innings")


def reply_schema() -> dict:
    """The JSON shape asked for (as a schema where the model supports structured output)."""
    return {
        "type": "object",
        "properties": {
            "features": {"type": "array", "items": {"type": "string"}},
            "window": {"type": "string", "enum": setup_settings.WINDOW_IDS},
            "weighting": {"type": "string", "enum": setup_settings.WEIGHTING_IDS},
            "training_innings": {"type": "string", "enum": setup_settings.TRAINING_INNINGS_IDS},
            "reason": {"type": "string"},
            "finished": {"type": "boolean"},
        },
        "required": [*SETUP_PARTS, "reason", "finished"],
        "additionalProperties": False,
    }


def _menu(title: str, options: tuple[setup_settings.Option, ...]) -> list[str]:
    return [f"- {title}: " + "; ".join(f'"{o.id}" ({o.label})' for o in options)]


def build_system(rounds_remaining: int) -> str:
    menus = [
        *_menu("window (which past seasons to learn from, counted back from the year being checked)", setup_settings.WINDOWS),
        *_menu("weighting (how much recent seasons count when fitting)", setup_settings.WEIGHTINGS),
        *_menu("training_innings (which innings to learn from)", setup_settings.TRAINING_INNINGS),
    ]
    return (
        "You are helping a cricket analyst choose a setup for a straight-line (linear regression) model that predicts a "
        "T20 first innings' final total from how the innings stood at the end of the 10th over. A setup has four parts: "
        "which measurements (features) to use, which past seasons to learn from (window), how much recent seasons count "
        "(weighting), and which innings to learn from (training_innings). The innings the model is judged on are IPL and "
        "BBL innings and T20 internationals between full ICC members.\n\n"
        "You may only choose from the catalogue and the menus you are given. Rules:\n"
        "- All four parts are required in every proposal.\n"
        "- Use only the feature ids in the catalogue, written exactly as they appear.\n"
        f"- Propose at most {SET_LIMIT} features.\n"
        "- Choose window, weighting and training_innings exactly as written in the menus below:\n"
        + "\n".join(menus) + "\n"
        "- Never propose a setup that has already been tried: the same features (in any order), window, weighting and "
        "training_innings.\n"
        "- Do not include a feature that can be built exactly from the others in the set (for example wickets lost "
        "together with wickets in hand): a straight-line fit cannot tell such features apart, and the proposal will "
        "be rejected.\n"
        "- You cannot run any numbers. The analyst's code fits every proposal on earlier years and checks it on three "
        "later years, each time learning only from the years before the one being checked; lower average error across the "
        "three checks (average miss in runs) is better. Do not state or guess any numbers as results.\n\n"
        "Use what you know about T20 cricket (for example how scoring and the rules have changed over the seasons) and the "
        "results so far to decide what to try next. Reply with JSON only, in exactly this shape: "
        '{"features": ["id", "id"], "window": "' + setup_settings.WINDOWS[2].id + '", "weighting": "'
        + setup_settings.WEIGHTINGS[1].id + '", "training_innings": "' + setup_settings.TRAINING_INNINGS[0].id + '", '
        '"reason": "one or two sentences in plain cricket language, which may mention any part of the setup", '
        '"finished": false}. Set "finished" to true when more tries are unlikely to help; then give your best setup. '
        f"You have {rounds_remaining} round{'s' if rounds_remaining != 1 else ''} remaining "
        "(a rejected proposal uses a round)."
    )


def _num(value: Any) -> str:
    return f"{value}"


def _setup_line(item: dict) -> str:
    """One setup in words the model chose them in: the feature ids and the three menu ids."""
    return (f"{', '.join(item.get('features') or []) or '(no features)'} | window {item.get('window')} | "
            f"weighting {item.get('weighting')} | training_innings {item.get('training_innings')}")


def build_user(explore: dict, attempts: list[dict], rejections: list[dict]) -> str:
    lines = ["CATALOGUE (the only features you may choose from):"]
    for f in features.CATALOGUE:
        lines.append(f"- {f['id']}: {f['label']} ({f['unit']}). {f['description']}")

    lines += ["", "WHAT THE EARLIER YEARS SHOW (only the innings the model is judged on):"]
    if explore.get("train_n") is not None:
        lines.append(f"Innings in these years: {_num(explore['train_n'])}.")
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
    by_year = explore.get("mean_total_by_year") or {}
    if by_year:
        lines.append("Average final total by year: " + ", ".join(f"{y} {_num(v)}" for y, v in by_year.items()) + ".")
    counts = explore.get("innings_by_competition_year") or {}
    if counts:
        lines.append("Innings by year and competition: " + "; ".join(
            f"{y}: " + ", ".join(f"{c} {n}" for c, n in per.items()) for y, per in counts.items()) + ".")

    lines += ["", "ATTEMPTS SO FAR (the error is the average miss in runs over the three checks, lower is better; each "
                  "check year's own error is in brackets):"]
    if not attempts:
        lines.append("Nothing yet: this is the first round.")
    for a in attempts:
        verdict = "improved on the best so far" if a.get("improved") else "did not improve"
        per_check = ", ".join(f"{c['year']}: {_num(c['mae'])}" for c in a.get("checks") or [])
        lines.append(f"- Round {a['round']}: {_setup_line(a)} -> average error {_num(a['validation_mae'])} "
                     f"({per_check}) ({verdict}).")

    if rejections:
        lines += ["", "REJECTED PROPOSALS (these were not fitted):"]
        for r in rejections:
            lines.append(f"- Round {r['round']}: {_setup_line(r)} -> {r['reason']}")
    lines += ["", "Reply with the JSON object only."]
    return "\n".join(lines)


def build_request(*, model: str, rounds_remaining: int, explore: dict, attempts: list[dict], rejections: list[dict],
                  max_tokens: int, timeout: float, structured: bool = True) -> LlmRequest:
    return LlmRequest(model=model, system=build_system(rounds_remaining), user=build_user(explore, attempts, rejections),
                      max_tokens=max_tokens, timeout=timeout, json_schema=reply_schema() if structured else None)


# ---- the final writing step (feature 012) -----------------------------------------------------------------------

WRITING_MARKER = "TASK: write_in_cricket_terms"


def writing_schema(block_ids: list[str]) -> dict:
    """The JSON shape asked for when the model writes the section's titles and sentences."""
    block = {"type": "object",
             "properties": {"title": {"type": "string"}, "sentences": {"type": "array", "items": {"type": "string"}}},
             "additionalProperties": False}
    return {
        "type": "object",
        "properties": {"blocks": {"type": "object", "properties": {b: block for b in block_ids}, "additionalProperties": False},
                       "order": {"type": "array", "items": {"type": "string"}}, "closing_lead": {"type": "string"}},
        "required": ["blocks"], "additionalProperties": False,
    }


def build_writing_system(max_title: int, max_sentence: int, movable: list[str], leads: list[str]) -> str:
    return (
        f"{WRITING_MARKER}\n"
        "You write the words of a short results section for cricket fans: a few blocks, each with a title and one or two "
        "plain sentences. The analyst's code has already worked out every number; you only write words around them.\n\n"
        "Rules:\n"
        "- Never write a number, a digit or a number in words that stands for a figure. To mention a figure, write its "
        "placeholder in braces exactly as listed under FACTS, for example: each wicket costs {wicket_cost} runs. Code fills "
        "the placeholder in.\n"
        "- Use only the fact ids listed. A placeholder for a fact that is not listed makes your whole reply unusable.\n"
        "- Do not state anything as a statistic, record or result unless it is one of the listed facts. You may add plain "
        "cricket context in words, but not figures.\n"
        "- Write for the blocks listed, with these titles and sentences only: you may not add, remove or invent blocks, "
        "charts or facts.\n"
        f"- A title is at most {max_title} characters and a sentence at most {max_sentence} characters. The closing "
        "block is one sentence; the others are one or two.\n"
        f"- You may reorder these blocks (the verdict stays first and the closing sentence last): {', '.join(movable) or 'none'}, "
        f"and choose which fact the closing sentence leads with from: {', '.join(leads) or 'none'}.\n"
        "- Say what the result means in plain cricket language. Do not mention these rules.\n\n"
        'Reply with JSON only, in this shape: {"blocks": {"verdict": {"title": "...", "sentences": ["..."]}, ...}, '
        '"order": ["drivers", "how_chosen"], "closing_lead": "goal_reached"}. Any block you leave out keeps its usual wording.'
    )


def build_writing_user(facts: dict, blocks: list[dict], purpose: dict[str, str]) -> str:
    lines = ["FACTS (write the placeholder in braces; the text after 'shown as' is only what code will put there):"]
    for fid, f in facts.items():
        lines.append(f"- {{{fid}}}: {f['meaning']} [{f['unit']}] (shown as: {f['display']})")
    lines += ["", "BLOCKS (write a title and sentences for each):"]
    for b in blocks:
        lines.append(f"- {b['id']}: {purpose.get(b['id'], '')}. Usual title: {b['title']}")
    lines += ["", "Reply with the JSON object only."]
    return "\n".join(lines)


def build_writing_request(*, model: str, facts: dict, blocks: list[dict], purpose: dict[str, str], max_title: int,
                          max_sentence: int, movable: list[str], leads: list[str], max_tokens: int, timeout: float,
                          structured: bool = True) -> LlmRequest:
    ids = [b["id"] for b in blocks]
    return LlmRequest(model=model, system=build_writing_system(max_title, max_sentence, movable, leads),
                      user=build_writing_user(facts, blocks, purpose), max_tokens=max_tokens, timeout=timeout,
                      json_schema=writing_schema(ids) if structured else None)
