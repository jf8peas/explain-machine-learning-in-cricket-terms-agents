"""The agent's node functions. Each returns state changes plus a plain-language `summary`.

Only `propose_features` talks to a language model (through the injected client). Everything else is ordinary code:
every error, coefficient and prediction is computed here. The test year is read only inside `final_test`.
"""
from __future__ import annotations

import copy
import functools
import hashlib
import logging
import time
from pathlib import Path
from typing import Any, NamedTuple

import numpy as np
from langchain_core.runnables import RunnableConfig

from . import accuracy_text, cricket_blocks, cricket_facts, features as feature_registry, goal, headlines, regression, scoring, selection
from .accuracy import accuracy, display
from .competition_dummies import check_dummies
from .data_loading import DEFAULT_PATH, DataError, load_innings
from .fitting import Fitter
from .population import check_population, in_population
from .evaluation import broadcaster_projection, know_nothing_guess, mae, r2
from .llm_client import LlmClient, LlmError, LlmTimeout, LlmUnavailable
from .llm_reply import UnusableReply, parse_reply
from .writing_reply import parse_writing_reply
from .prompts import build_request, build_writing_request
from . import setup_settings, wording as phrasing
from .season_split import Rolling, rolling_checks
from .state import FORWARD, LLM, ROUND_CAP, SET_LIMIT, RunState

log = logging.getLogger("linreg.llm")


def _r(x: float, n: int = 2) -> float:
    return round(float(x), n)


def _load(state: RunState):
    return load_innings(state.get("data_path"), required=feature_registry.PREPARED_COLUMNS)


class _Context(NamedTuple):
    df: Any
    rolling: Rolling
    fitter: Fitter


@functools.lru_cache(maxsize=8)
def _context_for(path: str, content: str) -> _Context:
    df = load_innings(path, required=feature_registry.PREPARED_COLUMNS)
    rolling = rolling_checks(df)
    return _Context(df, rolling, Fitter(rolling))


def _context(state: RunState) -> _Context:
    """The table, the rolling checks and the fast fitter for this run's data, built once per file content (the numbers in
    them are pure functions of the data, so runs can share them)."""
    path = Path(state.get("data_path") or DEFAULT_PATH)
    return _context_for(str(path), hashlib.blake2b(path.read_bytes(), digest_size=16).hexdigest())


def _config(config: RunnableConfig) -> dict:
    return (config or {}).get("configurable", {}) or {}


def _r_or_none(v):
    return None if v is None else _r(v, 1)


def _words(ids: list[str]) -> str:
    names = [feature_registry.label(i) for i in ids]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


# --- loading and preparing ---------------------------------------------------------------------------------------

def load_data(state: RunState, config: RunnableConfig) -> dict[str, Any]:
    cfg = _config(config)
    try:
        df = _load(state)
        feature_registry.check_features(df)  # candidates present, not blank, derived columns match their recipes
        check_dummies(df)  # every row's competition dummies must be 0/1 and agree with its competition
        check_population(df)  # the test-population column agrees with the competition and the full-member flags
        rolling_checks(df)  # the three check years and the test year have enough innings, and there are earlier years
    except DataError as exc:
        return {
            "data_error": str(exc),
            "decision": {"branch": "stop", "reason": str(exc)},
            "summary": f"Could not load the data: {exc} The run stops here.",
        }
    years = df["match_date"].dt.year
    comps = sorted(df["competition"].unique().tolist())
    summary = {
        "innings": int(len(df)),
        "seasons": int(df["season"].nunique()),
        "competitions": comps,
        "years": [int(years.min()), int(years.max())],
        "by_competition": {c: int((df["competition"] == c).sum()) for c in comps},
    }
    out: dict[str, Any] = {
        "data_summary": summary,
        "data_error": None,
        "model_name": cfg.get("model_name"),
        "decision": {"branch": "ok", "reason": phrasing.load_ok_reason()},
        "summary": (f"Loaded {summary['innings']} first innings from {summary['seasons']} seasons "
                    f"across {len(comps)} competitions ({', '.join(comps)})."),
    }
    if not cfg.get("llm_allowed", True):
        out["llm_status"] = "not_used"
        out["llm_failure"] = cfg.get("llm_unavailable_reason") or phrasing.agent_unavailable()
    return out


def split(state: RunState) -> dict[str, Any]:
    rolling = _context(state).rolling
    checks = [{"year": c.year, "n": rolling.n_check[c.year], "earlier_years": [c.earlier_years[0], c.earlier_years[-1]]}
              for c in rolling.checks]
    info = {"test_year": rolling.test_year, "test_n": rolling.n_test, "checks": checks,
            "first_year": rolling.checks[0].earlier_years[0]}
    return {"split": info,
            "summary": phrasing.split_summary(checks, rolling.test_year, rolling.n_test)}


def explore(state: RunState) -> dict[str, Any]:
    """Statistics for the language model, from the test-population innings in the years before the test year."""
    ctx = _context(state)
    df = ctx.df
    years = df["match_date"].dt.year
    train = df[in_population(df) & (years < ctx.rolling.test_year)]
    train_years = train["match_date"].dt.year
    corr: dict[str, float | None] = {}
    for f in feature_registry.IDS:
        c = train[f].corr(train["final_total"])
        corr[f] = None if np.isnan(c) else _r(c, 3)
    buckets = [("0-1 down", train["wickets_at_10"] <= 1),
               ("2-3 down", train["wickets_at_10"].between(2, 3)),
               ("4 or more down", train["wickets_at_10"] >= 4)]
    by_wickets = {}
    for name, mask in buckets:
        sub = train[mask]
        if len(sub):
            by_wickets[name] = {
                "innings": int(len(sub)),
                "avg_runs_at_10": _r(sub["runs_at_10"].mean(), 1),
                "avg_added_after_10": _r((sub["final_total"] - sub["runs_at_10"]).mean(), 1),
            }
    by_comp = {c: _r(g["final_total"].mean(), 1) for c, g in train.groupby("competition")}
    mean_total_by_year = {int(y): _r(g["final_total"].mean(), 1) for y, g in train.groupby(train_years)}
    innings_by_competition_year = {int(y): {c: int(n) for c, n in g["competition"].value_counts().sort_index().items()}
                                   for y, g in train.groupby(train_years)}
    strongest = max((f for f, c in corr.items() if c is not None), key=lambda f: abs(corr[f]))
    return {
        "explore": {"corr_with_total": corr, "by_wickets": by_wickets, "mean_total_by_competition": by_comp,
                    "mean_total_by_year": mean_total_by_year, "innings_by_competition_year": innings_by_competition_year,
                    "train_n": int(len(train))},
        "summary": (f"In the years before {ctx.rolling.test_year}, {feature_registry.label(strongest)} moves most closely "
                    f"with the final total (correlation {corr[strongest]}). Sides with more wickets down add fewer runs in "
                    "the second half."),
    }


def _average_figures(per_check: list[dict[str, Any]]) -> dict[str, Any]:
    """One set of displayed figures for the three checks: the mean of each measure (one decimal), the innings summed."""
    return {k: (sum(f[k] for f in per_check) if k == "n" else round(sum(f[k] for f in per_check) / len(per_check), 1))
            for k in per_check[0]}


def baseline(state: RunState) -> dict[str, Any]:
    """The broadcaster's projection and the average-total guess scored on the three check years (the test year is not touched here)."""
    rolling = _context(state).rolling
    by_check = []
    for spec in rolling.checks:
        actual = rolling.check_rows(spec)
        earlier = rolling.training_rows(spec, "all", "population")["final_total"]
        by_check.append({
            "year": spec.year,
            "know_nothing": display(accuracy(actual["final_total"], know_nothing_guess(earlier, len(actual)))),
            "broadcaster": display(accuracy(actual["final_total"], broadcaster_projection(actual["runs_at_10"]))),
        })
    reference = {m: _average_figures([c[m] for c in by_check]) for m in ("know_nothing", "broadcaster")}
    reference["by_check"] = by_check
    err = float(np.mean([mae(rolling.check_rows(spec)["final_total"],
                             broadcaster_projection(rolling.check_rows(spec)["runs_at_10"])) for spec in rolling.checks]))
    return {"baseline_validation_mae": _r(err), "reference_validation": reference,
            "summary": phrasing.baseline_summary(_r(err, 1), reference["know_nothing"]["average_miss"])}


# --- the language-model loop ----------------------------------------------------------------------------------

def _failure(message: str, status: str = "failed") -> dict[str, Any]:
    return {"proposal": None, "llm_status": status, "llm_failure": message,
            "summary": phrasing.agent_failed_summary(message)}


def propose_features(state: RunState, config: RunnableConfig, llm: LlmClient) -> dict[str, Any]:
    """The only language-model step: propose the next feature set, or fail in a way the run can carry on from."""
    cfg = _config(config)
    budget, model_id = cfg.get("budget"), cfg.get("model_id")
    if state.get("llm_status") == "not_used" or not cfg.get("llm_allowed", True) or budget is None or model_id is None:
        return _failure(state.get("llm_failure") or phrasing.agent_unavailable(), "not_used")

    used = state.get("rounds_used", 0)
    mine = [a for a in state.get("attempts", []) if a["proposer"] == LLM]
    structured, text, failure = True, None, "The language model did not answer."
    for _ in range(2):  # at most one retry, and only while the budget allows
        timeout = budget.take_call()
        if timeout is None:
            failure = "There was no time or call budget left to ask it."
            break
        request = build_request(model=model_id, rounds_remaining=ROUND_CAP - used, explore=state["explore"],
                                attempts=mine, rejections=state.get("rejections", []), max_tokens=budget.max_tokens,
                                timeout=timeout, structured=structured)
        started = time.monotonic()
        try:
            text = llm.complete(request)
            break
        except LlmTimeout as exc:
            kind, failure = "timeout", str(exc)
        except LlmUnavailable as exc:
            kind, failure = "unavailable", str(exc)
            if exc.unsupported_format and structured:
                structured = False  # try once more without structured output
        except LlmError as exc:  # any other model-call failure
            kind, failure = "error", str(exc)
        log.warning("language model call failed: model=%s kind=%s elapsed=%.1fs", model_id, kind,
                    time.monotonic() - started)
    if text is None:
        return _failure(failure)
    try:
        proposal = parse_reply(text)
    except UnusableReply as exc:
        log.warning("language model reply unusable: model=%s", model_id)
        return _failure(str(exc))
    named = phrasing.proposal_named(proposal.features, proposal.window, proposal.weighting, proposal.training_innings)
    return {
        "proposal": {"features": None if proposal.features is None else list(proposal.features),
                     "window": proposal.window, "weighting": proposal.weighting,
                     "training_innings": proposal.training_innings, "reason": proposal.reason,
                     "finished": proposal.finished},
        "rounds_used": used + 1,
        "llm_status": "ok",
        "summary": phrasing.propose_summary(named, proposal.finished),
    }


def check_proposal(state: RunState) -> dict[str, Any]:
    """Code checks the model's proposal against every rule before anything is fitted."""
    proposal = state.get("proposal")
    if proposal is None:
        note = state.get("llm_failure") or phrasing.agent_gave_no_proposal()
        return {"decision": {"branch": "failed", "reason": note},
                "summary": phrasing.no_proposal_summary()}
    mine = [a for a in state.get("attempts", []) if a["proposer"] == LLM]
    used = state["rounds_used"]
    named = list(proposal["features"] or [])
    note = {"round": used, "features": named, "window": proposal.get("window"), "weighting": proposal.get("weighting"),
            "training_innings": proposal.get("training_innings"), "reason": proposal["reason"],
            "finished": bool(proposal["finished"])}
    if proposal["finished"]:
        if not mine:
            message = phrasing.finished_too_soon_message()
            return {"llm_status": "failed", "llm_failure": message, "rounds": [{**note, "outcome": "failed", "message": message}],
                    "decision": {"branch": "failed", "reason": message},
                    "summary": phrasing.finished_too_soon_summary(message)}
        return {"rounds": [{**note, "outcome": "finished", "message": "The model is finished."}],
                "decision": {"branch": "finished", "reason": "The model said it is finished."},
                "summary": phrasing.finished_summary()}
    check = selection.check_proposal(proposal, mine, _context(state).fitter)
    if check.outcome == "fit":
        setup = {k: proposal[k] for k in ("window", "weighting", "training_innings")}
        return {"features": check.features, "setup": setup, "rounds": [{**note, "outcome": "fit"}],
                "decision": {"branch": "fit", "reason": check.message},
                "summary": f"The proposal passed every check: {_words(check.features)}, {_setup_words(setup)}."}
    out: dict[str, Any] = {
        "rounds": [{**note, "outcome": "rejected", "message": check.message}],
        "rejections": [{"round": used, "features": named, "window": note["window"], "weighting": note["weighting"],
                        "training_innings": note["training_innings"], "reason": check.message, "code": check.reason}],
    }
    if used >= ROUND_CAP:
        out["decision"] = {"branch": "finished", "reason": "The round cap was reached."}
        out["summary"] = f"Rejected: {check.message} That was the last round allowed, so the agent moves on."
    else:
        out["decision"] = {"branch": "rejected", "reason": check.message}
        out["summary"] = f"Rejected: {check.message} The model gets to try again."
    return out


def _setup_words(setup: dict) -> str:
    return setup_settings.setup_words(setup["window"], setup["weighting"], setup["training_innings"])


def _current_setup(state: RunState) -> dict:
    """The window, weighting and training innings of the proposal being fitted (the default until one is chosen)."""
    window, weighting, innings = selection.DEFAULT_SETUP
    return state.get("setup") or {"window": window, "weighting": weighting, "training_innings": innings}


def _weights(rows, spec, weighting: str) -> np.ndarray:
    ages = (spec.year - rows["match_date"].dt.year).to_numpy(dtype=float)
    return np.array([setup_settings.weight_for_age(a, weighting) for a in ages])


def _fit(rolling: Rolling, spec, feats: list[str], window: str, weighting: str, training_innings: str) -> dict:
    """The reference fit of one setup relative to one check (or the final test): rows, weights, coefficients."""
    rows = rolling.training_rows(spec, window, training_innings)
    return regression.fit(rows, feats, weights=_weights(rows, spec, weighting))


def _check_errors(result: dict) -> list[dict]:
    return [{"year": c["year"], "mae": _r(c["mae"])} for c in result["checks"]]


def _by_year(checks: list[dict]) -> str:
    return ", ".join(f"{c['year']}: {_r(c['mae'], 1)}" for c in checks)


def fit_model(state: RunState) -> dict[str, Any]:
    rolling = _context(state).rolling
    setup = _current_setup(state)
    spec = rolling.checks[-1]
    feats = list(state["features"])
    fitted = _fit(rolling, spec, feats, setup["window"], setup["weighting"], setup["training_innings"])
    fitted["coefficients"] = {f: _r(c, 3) for f, c in fitted["coefficients"].items()}
    fitted["intercept"] = _r(fitted["intercept"], 3)
    fitted["feature_iqr"] = {f: _r(v, 2) for f, v in fitted["feature_iqr"].items()}
    return {**fitted, "features": feats,
            "summary": (f"Fitted a straight-line model using: {_words(feats)}, {_setup_words(setup)}, for the check on "
                        f"{spec.year}.")}


def evaluate(state: RunState) -> dict[str, Any]:
    """Score the fitted set on the three check years and decide whether the loop goes on."""
    fitter = _context(state).fitter
    setup = _current_setup(state)
    window, weighting, training_innings = setup["window"], setup["weighting"], setup["training_innings"]
    feats = state["features"]
    result = fitter.evaluate(window, weighting, training_innings, feats)
    err, score = _r(result["mae"]), _r(result["r2"])
    checks = _check_errors(result)
    best = state.get("llm_best")
    improved = best is None or err < best["validation_mae"]
    attempt = {"features": list(feats), "proposer": LLM, "window": window, "weighting": weighting,
               "training_innings": training_innings, "validation_mae": err, "validation_r2": score, "checks": checks,
               "improved": improved, "round": state["rounds_used"]}
    no_improve = 0 if improved else state.get("no_improve", 0) + 1
    why = selection.stop_reason(finished=False, rounds_used=state["rounds_used"], rounds_without_improvement=no_improve)
    base = state["baseline_validation_mae"]
    verdict = "an improvement on the best so far" if improved and best else "the first idea tried" if improved else "no better than the best so far"
    reasons = {"no_improvement": "two rounds in a row brought no improvement", "round_cap": "the round cap was reached"}
    return {
        "attempts": [attempt], "llm_best": attempt if improved else best, "no_improve": no_improve,
        "decision": ({"branch": "stop", "reason": f"The model's search ends: {reasons[why]}."} if why
                     else {"branch": "continue", "reason": "The model gets another round."}),
        "summary": phrasing.evaluate_summary(_by_year(checks), _r(err, 1), score, verdict, _r(base, 1),
                                            reasons[why] if why else None),
    }


# --- the mechanical rival, the final test and the explanation -------------------------------------------------

def grid_search(state: RunState) -> dict[str, Any]:
    """Code only: the rival. Forward selection inside every combination of training innings, window and weighting, on the
    same three rolling checks; then the winner between the two methods is decided on validation error, before the test year."""
    fitter = _context(state).fitter
    if "grid" not in fitter.memo:                   # the grid depends on nothing but the data, so runs share it
        fitter.memo["grid"] = selection.grid_search(fitter)
    found = copy.deepcopy(fitter.memo["grid"])
    best = found["best"]
    attempt = {"features": list(best["features"]), "proposer": FORWARD, "window": best["window"],
               "weighting": best["weighting"], "training_innings": best["training_innings"],
               "validation_mae": best["validation_mae"], "validation_r2": best["validation_r2"],
               "checks": best["checks"], "improved": True, "round": len(best["features"])}
    decision = selection.validation_winner(state.get("llm_best"), attempt)
    considered = len(found["cells"])
    fitted = sum(1 for c in found["cells"] if c["allowed"])
    setup = setup_settings.setup_words(best["window"], best["weighting"], best["training_innings"])
    return {
        "grid": {"caption": setup_settings.HYPERPARAMETER_NOTE, "cells": found["cells"], "best": best,
                 "build_up": found["build_up"]},
        "attempts": [attempt], "forward_set": list(best["features"]), "forward_best": attempt,
        "validation_winner": decision,
        "decision": {"branch": "done", "reason": phrasing.grid_decision_reason(decision["reason"])},
        "summary": phrasing.grid_summary(considered, fitted, setup, _words(best["features"]), _r(best["validation_mae"], 1),
                                        decision["reason"]),
    }


def final_test(state: RunState) -> dict[str, Any]:
    """The only step that reads the test year. The winner was already decided on validation error; this refits both best
    setups on every year before the test year, scores each once on the test innings, and scores the references there too."""
    rolling = _context(state).rolling
    llm_best, forward_best = state.get("llm_best"), state.get("forward_best")
    decision = state["validation_winner"]    # decided at the grid step, on the checks, before the test slice is read
    winner = decision["winner"]
    test = rolling.test_rows()  # the test slice is read here and nowhere else
    scores: dict[str, dict[str, Any]] = {}
    for key, best in (("llm", llm_best), ("forward", forward_best)):
        if best is not None:
            fitted = _fit(rolling, rolling.final, list(best["features"]), best["window"], best["weighting"],
                          best["training_innings"])
            predicted = regression.predict(test, fitted["coefficients"], fitted["intercept"])
            scores[key] = {"features": list(best["features"]), "test_mae": _r(mae(test["final_total"], predicted)),
                           "test_r2": _r(r2(test["final_total"], predicted)), "fitted": fitted}
    tv = _r(mae(test["final_total"], broadcaster_projection(test["runs_at_10"])))
    won = scores[winner]
    margin = _r(abs(scores["llm"]["test_mae"] - scores["forward"]["test_mae"])) if len(scores) == 2 else None
    fitted = won["fitted"]
    coefficients = {f: _r(c, 3) for f, c in fitted["coefficients"].items()}
    final = {
        "test_mae": {"llm": scores["llm"]["test_mae"] if "llm" in scores else None,
                     "forward": scores["forward"]["test_mae"] if "forward" in scores else None, "tv": tv},
        "validation_mae": {"llm": llm_best["validation_mae"] if llm_best else None,
                           "forward": forward_best["validation_mae"] if forward_best else None},
        "winner": winner, "winner_name": phrasing.winner_name(winner),
        "winner_chosen_on": decision["chosen_on"], "winner_reason": decision["reason"],
        "margin": margin, "winner_mae": won["test_mae"], "winner_r2": won["test_r2"],
        "sets": {k: v["features"] for k, v in scores.items()},
        "setups": {k: {"features": v["features"], **{p: best[p] for p in ("window", "weighting", "training_innings")}}
                   for k, v, best in ((k, v, llm_best if k == "llm" else forward_best) for k, v in scores.items())},
        "llm_took_part": "llm" in scores,
    }
    # How every method did, against actual totals, from the displayed figures (one scoring each, in scoring.py). The
    # know-nothing guess is the mean of the test-population innings before the test year.
    earlier = rolling.training_rows(rolling.final, "all", "population")["final_total"]
    extra = scoring.final_scoring(earlier, test, {k: v["fitted"] for k, v in scores.items()}, winner)
    final.update(extra)
    # The agent's own refitted model (the same fit that was just scored), for the page's "Your turn"; the search's stands in
    # when no language model took part. The top-level winner fields below stay the pick's.
    agent_key = "llm" if "llm" in scores else "forward"
    agent_fit = scores[agent_key]["fitted"]
    final["agent_model"] = {"source": "agent" if agent_key == "llm" else "search",
                            "features": list(scores[agent_key]["features"]),
                            "coefficients": {f: _r(c, 3) for f, c in agent_fit["coefficients"].items()},
                            "intercept": _r(agent_fit["intercept"], 3)}
    shown = extra["accuracy"]
    final["headlines"] = headlines.build(
        agent_miss=shown["llm"]["average_miss"] if "llm" in shown else None,
        search_miss=shown["forward"]["average_miss"] if "forward" in shown else None,
        tv_miss=shown["broadcaster"]["average_miss"], tries=state.get("rounds_used", 0))
    verdict = extra["verdict"]
    final.update({"beat_tv": verdict["beat"], "cleared_margin": verdict["reached"], "improvement": verdict["improvement_runs"]})
    return {
        "validation_winner": decision,
        "final": final, "features": list(won["features"]), "coefficients": coefficients,
        "intercept": _r(fitted["intercept"], 3), "feature_iqr": {f: _r(v, 2) for f, v in fitted["feature_iqr"].items()},
        "summary": phrasing.final_summary(_r_or_none(final["test_mae"]["llm"]), _r_or_none(final["test_mae"]["forward"]),
                                         _r(tv, 1), winner, final["accuracy"]["know_nothing"]["average_miss"]),
    }


def explain_in_cricket_terms(state: RunState) -> dict[str, Any]:
    """Code builds the named facts and the blocks of the "In cricket terms" section, with template wording. Every number in
    the section is a fact's display text; the language model plays no part here (see write_in_cricket_terms)."""
    margin = goal.goal()["margin_runs"]
    labels = feature_registry.labels()
    facts = cricket_facts.build_facts(state, labels, margin)
    blocks = cricket_blocks.build_blocks(facts, labels, list(state["features"]))
    return {"explanation": {"facts": facts, "blocks": blocks, "order": cricket_blocks.default_order(blocks),
                            "source": "template", "model": None, "fallback_reason": None},
            "summary": "Worked out the facts and built the blocks that explain the result in cricket terms."}


def _keep_templates(state: RunState, reason: str) -> dict[str, Any]:
    """The template wording stays, with one short line saying why the model's words are not used."""
    expl = dict(state["explanation"])
    expl["fallback_reason"] = reason
    return {"explanation": expl, "summary": f"Kept the template wording. {reason}"}


def write_in_cricket_terms(state: RunState, config: RunnableConfig, llm: LlmClient) -> dict[str, Any]:
    """The closing language-model step: it writes the titles and sentences of the section, naming facts in braces and never
    writing a number. Code checks the reply, fills the placeholders with the facts' display text and replaces the wording
    of the blocks it covers; whatever it did not write, or any failure at all, leaves the template wording as it was."""
    cfg = _config(config)
    budget, model_id = cfg.get("budget"), cfg.get("model_id")
    expl = state.get("explanation")
    if not expl:
        return {"summary": "There was no explanation to write."}
    try:
        if (state.get("llm_status") != "ok" or not cfg.get("llm_allowed", True) or budget is None or model_id is None
                or not (state.get("final") or {}).get("llm_took_part")):
            took_part = bool((state.get("final") or {}).get("llm_took_part"))
            return _keep_templates(state, phrasing.keep_templates_reason("stopped_early" if took_part else "not_taken_part"))
        timeout = budget.take_writing_call()
        if timeout is None:
            return _keep_templates(state, phrasing.keep_templates_reason("no_budget"))
        facts, blocks = expl["facts"], expl["blocks"]
        offered = [b for b in blocks if b["id"] not in cricket_blocks.CODE_ONLY]     # the verdict and rule of thumb stay code
        request = build_writing_request(
            model=model_id, facts=facts, blocks=offered, purpose=cricket_blocks.BLOCK_PURPOSE,
            max_title=cricket_blocks.MAX_TITLE, max_sentence=cricket_blocks.MAX_SENTENCE, max_tokens=budget.max_tokens,
            timeout=timeout)
        started = time.monotonic()
        try:
            text = llm.complete(request)
        except LlmTimeout:
            log.warning("language model writing call failed: model=%s kind=timeout elapsed=%.1fs", model_id,
                        time.monotonic() - started)
            return _keep_templates(state, phrasing.keep_templates_reason("timeout"))
        except LlmError as exc:   # unavailable, or any other model-call failure
            log.warning("language model writing call failed: model=%s kind=%s elapsed=%.1fs", model_id,
                        type(exc).__name__, time.monotonic() - started)
            return _keep_templates(state, phrasing.keep_templates_reason("unreachable"))
        try:
            wording = parse_writing_reply(text, facts, [b["id"] for b in offered])
            written = []
            for b in blocks:
                w = wording.blocks.get(b["id"], {})
                written.append({**b, "title": cricket_blocks.fill(w["title"], facts) if "title" in w else b["title"],
                                "sentences": [cricket_blocks.fill(x, facts) for x in w["sentences"]]
                                if "sentences" in w else b["sentences"], "from_model": sorted(w)})
        except (UnusableReply, cricket_blocks.UnknownFact) as exc:
            # the message names the rule that failed (never the model's own text), so it is safe to log and to show
            detail = str(exc) if isinstance(exc, UnusableReply) else f"a placeholder names a fact that does not exist ({exc})"
            log.warning("language model writing reply unusable: model=%s reason=%s", model_id, detail)
            return _keep_templates(state, phrasing.keep_templates_reason("unusable", detail))
        covered = sum(1 for b in written if b["from_model"])
        if not covered:
            log.warning("language model writing reply had no usable wording: model=%s", model_id)
            return _keep_templates(state, phrasing.keep_templates_reason("empty"))
        return {"explanation": {**expl, "blocks": written, "source": "language model",
                                "model": state.get("model_name") or model_id, "fallback_reason": None},
                "summary": phrasing.wrote_summary(covered, len(offered))}
    except Exception:   # nothing here may fail the run: the template wording is already in the state
        log.exception("writing the closing words failed")
        return _keep_templates(state, phrasing.keep_templates_reason("failed"))
