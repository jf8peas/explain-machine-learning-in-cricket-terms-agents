"""The agent's node functions. Each returns state changes plus a plain-language `summary`.

Only `propose_features` talks to a language model (through the injected client). Everything else is ordinary code:
every error, coefficient and prediction is computed here. The test year is read only inside `final_test`.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import numpy as np
from langchain_core.runnables import RunnableConfig

from . import cricket_explanation, features as feature_registry, regression, selection
from .competition_dummies import check_dummies
from .data_loading import DataError, load_innings
from .evaluation import broadcaster_projection, mae, r2
from .llm_client import LlmClient, LlmError, LlmTimeout, LlmUnavailable
from .llm_reply import UnusableReply, parse_reply
from .prompts import build_request
from .season_split import Slices, split_three_ways
from .state import FORWARD, LLM, MARGIN_RUNS, MIN_TEST_INNINGS, ROUND_CAP, SET_LIMIT, RunState

log = logging.getLogger("linreg.llm")


def _r(x: float, n: int = 2) -> float:
    return round(float(x), n)


def _load(state: RunState):
    return load_innings(state.get("data_path"), required=feature_registry.PREPARED_COLUMNS)


def _slices(state: RunState) -> Slices:
    return split_three_ways(_load(state))


def _config(config: RunnableConfig) -> dict:
    return (config or {}).get("configurable", {}) or {}


def _words(ids: list[str]) -> str:
    names = [feature_registry.label(i) for i in ids]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


# --- loading and preparing ---------------------------------------------------------------------------------------

def _check_slices(df) -> None:
    """Three calendar years at least; the validation and test years need enough innings to be fair."""
    s = split_three_ways(df)
    n_years = int(df["match_date"].dt.year.nunique())
    if n_years < 3:
        word = {1: "one", 2: "two"}[n_years]
        extra = ", so there is nothing to train on" if n_years == 1 else ""
        raise DataError(f"The data covers only {word} calendar year{'s' if n_years > 1 else ''}{extra}. It needs at "
                        "least three: training, validation and test.")
    for name, n, year in (("validate", s.n_validation, s.validation_year), ("test", s.n_test, s.test_year)):
        if n < MIN_TEST_INNINGS:
            raise DataError(f"Only {n} innings are available from {year}, fewer than the "
                            f"{MIN_TEST_INNINGS} needed to {name} the model fairly.")
    if s.n_train == 0:
        raise DataError("The data has no innings before the validation year, so there is nothing to train on.")


def load_data(state: RunState, config: RunnableConfig) -> dict[str, Any]:
    cfg = _config(config)
    try:
        df = _load(state)
        feature_registry.check_features(df)  # candidates present, not blank, derived columns match their recipes
        check_dummies(df)  # every row's competition dummies must be 0/1 and agree with its competition
        _check_slices(df)
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
        "decision": {"branch": "ok", "reason": "The data loaded and the validation and test years have enough innings."},
        "summary": (f"Loaded {summary['innings']} first innings from {summary['seasons']} seasons "
                    f"across {len(comps)} competitions ({', '.join(comps)})."),
    }
    if not cfg.get("llm_allowed", True):
        out["llm_status"] = "not_used"
        out["llm_failure"] = cfg.get("llm_unavailable_reason") or "The language model could not be used for this run."
    return out


def split(state: RunState) -> dict[str, Any]:
    s = _slices(state)
    years = s.train["match_date"].dt.year
    info = {"train_n": s.n_train, "validation_n": s.n_validation, "test_n": s.n_test,
            "validation_year": s.validation_year, "test_year": s.test_year,
            "train_years": [int(years.min()), int(years.max())]}
    return {"split": info,
            "summary": (f"Training on {info['train_n']} innings from {info['train_years'][0]} to {info['train_years'][1]}. "
                        f"Choosing features on {info['validation_n']} innings from {info['validation_year']}. Keeping "
                        f"{info['test_year']} ({info['test_n']} innings) for one final test. Split by year, never at "
                        "random.")}


def explore(state: RunState) -> dict[str, Any]:
    """Statistics for the language model, from the training years only."""
    train = _slices(state).train
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
    strongest = max((f for f, c in corr.items() if c is not None), key=lambda f: abs(corr[f]))
    return {
        "explore": {"corr_with_total": corr, "by_wickets": by_wickets, "mean_total_by_competition": by_comp,
                    "train_n": int(len(train))},
        "summary": (f"In the training years, {feature_registry.label(strongest)} moves most closely with the final total "
                    f"(correlation {corr[strongest]}). Sides with more wickets down add fewer runs in the second half."),
    }


def baseline(state: RunState) -> dict[str, Any]:
    """The TV projection scored on the validation year (the test year is not touched here)."""
    validation = _slices(state).validation
    err = mae(validation["final_total"], broadcaster_projection(validation["runs_at_10"]))
    return {"baseline_validation_mae": _r(err),
            "summary": (f"On the validation year the TV projected score (current run rate x 20 overs) misses the real "
                        f"total by {_r(err, 1)} runs on average. That is the score to beat.")}


# --- the language-model loop ----------------------------------------------------------------------------------

def _failure(message: str, status: str = "failed") -> dict[str, Any]:
    return {"proposal": None, "llm_status": status, "llm_failure": message,
            "summary": f"The language model could not take part: {message} The run continues with forward selection only."}


def propose_features(state: RunState, config: RunnableConfig, llm: LlmClient) -> dict[str, Any]:
    """The only language-model step: propose the next feature set, or fail in a way the run can carry on from."""
    cfg = _config(config)
    budget, model_id = cfg.get("budget"), cfg.get("model_id")
    if state.get("llm_status") == "not_used" or not cfg.get("llm_allowed", True) or budget is None or model_id is None:
        return _failure(state.get("llm_failure") or "The language model could not be used for this run.", "not_used")

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
    named = ", ".join(proposal.features) if proposal.features else "no features"
    verdict = "It says it is finished." if proposal.finished else "It is not finished."
    return {
        "proposal": {"features": list(proposal.features), "reason": proposal.reason, "finished": proposal.finished},
        "rounds_used": used + 1,
        "llm_status": "ok",
        "summary": f"The language model proposes: {named}. {verdict} Its reasoning is shown with this step.",
    }


def check_proposal(state: RunState) -> dict[str, Any]:
    """Code checks the model's proposal against every rule before anything is fitted."""
    proposal = state.get("proposal")
    if proposal is None:
        note = state.get("llm_failure") or "The language model gave no proposal."
        return {"decision": {"branch": "failed", "reason": note},
                "summary": "No proposal to check. Moving on to forward selection."}
    mine = [a for a in state.get("attempts", []) if a["proposer"] == LLM]
    used = state["rounds_used"]
    note = {"round": used, "features": list(proposal["features"]), "reason": proposal["reason"],
            "finished": bool(proposal["finished"])}
    if proposal["finished"]:
        if not mine:
            message = "The language model said it was finished before any feature set had been tried."
            return {"llm_status": "failed", "llm_failure": message, "rounds": [{**note, "outcome": "failed", "message": message}],
                    "decision": {"branch": "failed", "reason": message},
                    "summary": f"{message} The run continues with forward selection only."}
        return {"rounds": [{**note, "outcome": "finished", "message": "The model is finished."}],
                "decision": {"branch": "finished", "reason": "The model said it is finished."},
                "summary": "The model says it is finished, so the agent moves on to forward selection."}
    check = selection.check_proposal(proposal["features"], [a["features"] for a in mine], _slices(state).train)
    if check.outcome == "fit":
        return {"features": check.features, "rounds": [{**note, "outcome": "fit"}],
                "decision": {"branch": "fit", "reason": check.message},
                "summary": f"The proposal passed every check: {_words(check.features)}."}
    out: dict[str, Any] = {
        "rounds": [{**note, "outcome": "rejected", "message": check.message}],
        "rejections": [{"round": used, "features": list(proposal["features"]), "reason": check.message,
                        "code": check.reason}],
    }
    if used >= ROUND_CAP:
        out["decision"] = {"branch": "finished", "reason": "The round cap was reached."}
        out["summary"] = f"Rejected: {check.message} That was the last round allowed, so the agent moves on."
    else:
        out["decision"] = {"branch": "rejected", "reason": check.message}
        out["summary"] = f"Rejected: {check.message} The model gets to try again."
    return out


def fit_model(state: RunState) -> dict[str, Any]:
    train = _slices(state).train
    feats = list(state["features"])
    fitted = regression.fit(train, feats)
    fitted["coefficients"] = {f: _r(c, 3) for f, c in fitted["coefficients"].items()}
    fitted["intercept"] = _r(fitted["intercept"], 3)
    fitted["feature_iqr"] = {f: _r(v, 2) for f, v in fitted["feature_iqr"].items()}
    return {**fitted, "features": feats,
            "summary": f"Fitted a straight-line model on the training years using: {_words(feats)}."}


def evaluate(state: RunState) -> dict[str, Any]:
    """Score the fitted set on the validation year and decide whether the loop goes on."""
    s = _slices(state)
    feats = state["features"]
    _, err, score = selection.fit_and_score(s.train, s.validation, feats)
    err, score = _r(err), _r(score)
    best = state.get("llm_best")
    improved = best is None or err < best["validation_mae"]
    attempt = {"features": list(feats), "proposer": LLM, "validation_mae": err, "validation_r2": score,
               "improved": improved, "round": state["rounds_used"]}
    no_improve = 0 if improved else state.get("no_improve", 0) + 1
    why = selection.stop_reason(finished=False, rounds_used=state["rounds_used"], rounds_without_improvement=no_improve)
    base = state["baseline_validation_mae"]
    verdict = "an improvement on the best so far" if improved and best else "the first set tried" if improved else "no better than the best so far"
    reasons = {"no_improvement": "two rounds in a row brought no improvement", "round_cap": "the round cap was reached"}
    return {
        "attempts": [attempt], "llm_best": attempt if improved else best, "no_improve": no_improve,
        "decision": ({"branch": "stop", "reason": f"The model's search ends: {reasons[why]}."} if why
                     else {"branch": "continue", "reason": "The model gets another round."}),
        "summary": (f"On the validation year this set misses by {_r(err, 1)} runs on average (R-squared {score}), "
                    f"{verdict}; the TV projection misses by {_r(base, 1)}."
                    + (f" The search ends: {reasons[why]}." if why else "")),
    }


# --- the mechanical rival, the final test and the explanation -------------------------------------------------

def forward_selection(state: RunState) -> dict[str, Any]:
    """Code only: add the single feature that most reduces validation error, one per visit, until nothing helps."""
    s = _slices(state)
    current = list(state.get("forward_set", []))
    previous = state.get("forward_best")
    step = selection.forward_step(s.train, s.validation, current)
    # "Improved" means the error as shown (to two decimals) is lower, so the display and the decision agree.
    if step is None or (previous is not None and _r(step["mae"]) >= previous["validation_mae"]):
        reason = ("the set is full" if len(current) >= SET_LIMIT else
                  "no single feature lowers the validation error any further")
        return {"decision": {"branch": "done", "reason": f"Forward selection stops: {reason}."},
                "summary": f"Forward selection stops with {_words(current)}: {reason}."}
    attempt = {"features": step["features"], "proposer": FORWARD, "validation_mae": _r(step["mae"]),
               "validation_r2": _r(step["r2"]), "improved": True, "round": len(step["features"])}
    full = len(step["features"]) >= SET_LIMIT
    return {
        "attempts": [attempt], "forward_set": step["features"], "forward_best": attempt,
        "decision": {"branch": "done" if full else "again",
                     "reason": "The set is full." if full else "See whether another feature helps."},
        "summary": ((f"Forward selection starts with {feature_registry.label(step['feature'])}: the validation error is "
                     if previous is None else
                     f"Forward selection adds {feature_registry.label(step['feature'])}: the validation error falls to ")
                    + f"{_r(step['mae'], 1)} runs." + (" The set is full." if full else "")),
    }


def final_test(state: RunState) -> dict[str, Any]:
    """The only step that reads the test year: score each contender once, then pick the winner."""
    s = _slices(state)
    train, test = s.train, s.test  # the test slice is read here and nowhere else
    llm_best, forward_best = state.get("llm_best"), state.get("forward_best")
    scores: dict[str, dict[str, Any]] = {}
    for key, best in (("llm", llm_best), ("forward", forward_best)):
        if best is not None:
            fitted, err, score = selection.fit_and_score(train, test, best["features"])
            scores[key] = {"features": list(best["features"]), "test_mae": _r(err), "test_r2": _r(score), "fitted": fitted}
    tv = _r(mae(test["final_total"], broadcaster_projection(test["runs_at_10"])))
    if "llm" in scores and "forward" in scores:  # a tie goes to the simpler, mechanical method
        winner = "llm" if scores["llm"]["test_mae"] < scores["forward"]["test_mae"] else "forward"
    else:
        winner = "llm" if "llm" in scores else "forward"
    won = scores[winner]
    margin = _r(abs(scores["llm"]["test_mae"] - scores["forward"]["test_mae"])) if len(scores) == 2 else None
    fitted = won["fitted"]
    coefficients = {f: _r(c, 3) for f, c in fitted["coefficients"].items()}
    final = {
        "test_mae": {"llm": scores["llm"]["test_mae"] if "llm" in scores else None,
                     "forward": scores["forward"]["test_mae"] if "forward" in scores else None, "tv": tv},
        "winner": winner, "winner_name": "the language model" if winner == "llm" else "forward selection",
        "margin": margin, "winner_mae": won["test_mae"], "winner_r2": won["test_r2"],
        "beat_tv": tv - won["test_mae"] > 0, "cleared_margin": tv - won["test_mae"] >= MARGIN_RUNS,
        "improvement": _r(tv - won["test_mae"]),
        "sets": {k: v["features"] for k, v in scores.items()},
        "llm_took_part": "llm" in scores,
    }
    return {
        "final": final, "features": list(won["features"]), "coefficients": coefficients,
        "intercept": _r(fitted["intercept"], 3), "feature_iqr": {f: _r(v, 2) for f, v in fitted["feature_iqr"].items()},
        "summary": ("Final test, once each on the test year: "
                    + ", ".join(f"{name} {_r(v, 1)} runs" for name, v in (
                        ("language model", final["test_mae"]["llm"]), ("forward selection", final["test_mae"]["forward"]),
                        ("TV projection", tv)) if v is not None)
                    + f". {final['winner_name'].capitalize()} wins."),
    }


def explain_in_cricket_terms(state: RunState) -> dict[str, Any]:
    expl = cricket_explanation.build_explanation(dict(state), feature_registry.labels(), MARGIN_RUNS)
    return {"explanation": expl, "summary": "Turned the numbers into plain cricket sentences."}
