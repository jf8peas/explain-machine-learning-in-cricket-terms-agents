"""Owner tool: put the recorded run (web/public/recorded-run.json) in today's words, without running the agent (feature 021).

    uv run python scripts/reword_recorded_run.py                    # rewrite the shipped recording
    uv run python scripts/reword_recorded_run.py --file PATH        # rewrite another recording (the tests' fixture)
    uv run python scripts/reword_recorded_run.py --check [--file PATH]   # exit 1 if the file's wording is out of date

No language model is called and nothing is run again. Every code-worded string in the file (step summaries, decision reasons, the
grid caption, the winner's name and reason, the method names and notes, the fact meanings, the explanation's template sentences,
the headline words) is built again from the facts the file already holds, with the backend's own wording functions. Every
number, the agent's proposal reasons and the data fingerprint stay exactly as they were, and the script stops if it would change
any other string. The file stores `wording_version`, which changes when the terms or their definitions do.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from linreg import cricket_blocks, cricket_facts, features, goal, headlines, nodes, selection, setup_settings, wording  # noqa: E402
from linreg.fingerprint import data_fingerprint  # noqa: E402
from linreg.methods import method_defs, terms_version  # noqa: E402
from linreg.goal import verdict_sentence  # noqa: E402

DEFAULT_FILE = Path(__file__).resolve().parent.parent / "web" / "public" / "recorded-run.json"

# The only strings the script may change, as paths with list positions left out (the guard in `check_only_wording_changed`).
CODE_WORDED = {
    ("summary",),
    ("changes", "decision", "reason"),
    ("changes", "rounds", "message"),
    ("changes", "rejections", "reason"),
    ("changes", "grid", "caption"),
    ("changes", "validation_winner", "reason"),
    ("changes", "final", "winner_name"),
    ("changes", "final", "winner_reason"),
    ("changes", "final", "verdict_sentence"),
    ("changes", "final", "method_defs", "name"),
    ("changes", "final", "method_defs", "note"),
    ("changes", "final", "headlines", "scoreboard", "facts", "text"),
    ("changes", "final", "headlines", "scoreboard", "subject_label"),
    ("changes", "final", "headlines", "hero_h1"),
    ("changes", "final", "headlines", "lead"),
    ("changes", "final", "headlines", "verdict_h2"),
    ("changes", "final", "headlines", "vs_search"),
    ("changes", "explanation", "facts", "meaning"),
    ("changes", "explanation", "blocks", "title"),
    ("changes", "explanation", "blocks", "sentences"),
    ("changes", "explanation", "fallback_reason"),
}


class RewordError(Exception):
    """The file cannot be reworded safely."""


def _path_key(path: list) -> tuple:
    return tuple(p for p in path if not isinstance(p, int))


def check_only_wording_changed(old: Any, new: Any, path: list | None = None) -> None:
    """Stop unless the two files are the same apart from strings at the code-worded paths."""
    path = path or []
    if isinstance(old, dict) and isinstance(new, dict):
        if set(old) != set(new):
            raise RewordError(f"the keys at {'.'.join(map(str, path))} changed")
        for k in old:
            check_only_wording_changed(old[k], new[k], path + [k])
    elif isinstance(old, list) and isinstance(new, list):
        if len(old) != len(new):
            raise RewordError(f"the length of {'.'.join(map(str, path))} changed")
        for i, (a, b) in enumerate(zip(old, new)):
            check_only_wording_changed(a, b, path + [i])
    elif old != new:
        key = _path_key(path)
        # explanation facts live under a fact id: only a meaning, or the chosen method's label, may be reworded
        if key[:3] == ("changes", "explanation", "facts") and len(key) == 5:
            fact_id = path[path.index("facts") + 1]
            key = key[:3] + ("meaning",) if key[4] == "meaning" or (key[4] == "display" and fact_id == "chosen_label") else key
        if not (isinstance(old, str) and isinstance(new, str) and key in CODE_WORDED):
            raise RewordError(f"{'.'.join(map(str, path))} would change but is not code-worded: {old!r} -> {new!r}")


def _rebuilt_explanation(state: dict) -> tuple[dict, list[dict]]:
    margin = goal.goal()["margin_runs"]
    labels = features.labels()
    facts = cricket_facts.build_facts(state, labels, margin)
    return facts, cricket_blocks.build_blocks(facts, labels, list(state["features"]))


def reword(recording: dict) -> dict:
    """The recording with every code-worded string built again from the facts it holds."""
    out = copy.deepcopy(recording)
    state: dict[str, Any] = {}
    old_label = None
    new_facts: dict | None = None
    new_blocks: list[dict] = []
    messages: dict[str, str] = {}        # a rejection's old wording -> its wording now (the lists in `changes` repeat earlier entries)
    for ev in out["events"]:
        node, ch = ev["node"], ev["changes"]
        llm_best_before = state.get("llm_best")
        state.update(copy.deepcopy(ch))
        if node == "load_data" and ch.get("decision", {}).get("branch") == "ok":
            ch["decision"]["reason"] = wording.load_ok_reason()
        elif node == "split":
            s = ch["split"]
            ev["summary"] = wording.split_summary(s["checks"], s["test_year"], s["test_n"])
        elif node == "baseline":
            ev["summary"] = wording.baseline_summary(round(ch["baseline_validation_mae"], 1),
                                                     ch["reference_validation"]["know_nothing"]["average_miss"])
        elif node == "propose_features" and ch.get("proposal"):
            p = ch["proposal"]
            ev["summary"] = wording.propose_summary(
                wording.proposal_named(p["features"], p["window"], p["weighting"], p["training_innings"]), p["finished"])
        elif node == "check_proposal":
            _reword_check(ev, messages)
        elif node == "evaluate":
            attempt = ch["attempts"][-1]
            verdict = ("an improvement on the best so far" if attempt["improved"] and llm_best_before
                       else "the first idea tried" if attempt["improved"] else "no better than the best so far")
            reason = None
            if ch["decision"]["branch"] == "stop":
                reason = ch["decision"]["reason"].removeprefix("The model's search ends: ").removesuffix(".")
            ev["summary"] = wording.evaluate_summary(
                nodes._by_year(attempt["checks"]), round(attempt["validation_mae"], 1), attempt["validation_r2"], verdict,
                round(state["baseline_validation_mae"], 1), reason)
        elif node == "grid_search":
            best = ch["grid"]["best"]
            winner = selection.validation_winner(llm_best_before, ch["forward_best"])
            ch["validation_winner"]["reason"] = winner["reason"]
            ch["grid"]["caption"] = setup_settings.HYPERPARAMETER_NOTE
            ch["decision"]["reason"] = wording.grid_decision_reason(winner["reason"])
            setup = setup_settings.setup_words(best["window"], best["weighting"], best["training_innings"])
            ev["summary"] = wording.grid_summary(
                len(ch["grid"]["cells"]), sum(1 for c in ch["grid"]["cells"] if c["allowed"]), setup,
                nodes._words(best["features"]), round(best["validation_mae"], 1), winner["reason"])
            state["validation_winner"] = ch["validation_winner"]
        elif node == "final_test":
            _reword_final(ev, state)
        elif node == "explain_in_cricket_terms":
            old_label = ch["explanation"]["facts"]["chosen_label"]["display"]
            new_facts, new_blocks = _rebuilt_explanation(state)
            expl = ch["explanation"]
            _keep_numbers(expl["facts"], new_facts)
            expl["facts"] = new_facts
            expl["blocks"] = new_blocks
        elif node == "write_in_cricket_terms":
            _reword_written(ev, old_label, new_facts, new_blocks)
    out["wording_version"] = terms_version()
    return out


def _reword_check(ev: dict, messages: dict[str, str]) -> None:
    ch = ev["changes"]
    for entry in ch.get("rejections", []):
        if entry["code"] == "already_tried":
            messages[entry["reason"]] = selection.ALREADY_TRIED
    for entry in ch.get("rejections", []):
        entry["reason"] = messages.get(entry["reason"], entry["reason"])
    for r in ch.get("rounds", []):
        if "message" in r:
            r["message"] = messages.get(r["message"], r["message"])
    summary = ev["summary"]
    for old, new in messages.items():
        summary = summary.replace(old, new)
        if "decision" in ch:
            ch["decision"]["reason"] = ch["decision"]["reason"].replace(old, new)
    if ch.get("decision", {}).get("reason") == "The model said it is finished.":
        summary = wording.finished_summary()
    ev["summary"] = summary


def _reword_final(ev: dict, state: dict) -> None:
    ch = ev["changes"]
    final = ch["final"]
    winner = final["winner"]
    reason = selection.validation_winner(state.get("llm_best"), state.get("forward_best"))["reason"]
    ch["validation_winner"]["reason"] = reason
    final["winner_reason"] = reason
    final["winner_name"] = wording.winner_name(winner)
    final["method_defs"] = method_defs([m["id"] for m in final["method_defs"]])
    final["verdict_sentence"] = verdict_sentence(final["verdict"])
    shown = final["accuracy"]
    final["headlines"] = headlines.build(
        agent_miss=shown["llm"]["average_miss"] if "llm" in shown else None,
        search_miss=shown["forward"]["average_miss"] if "forward" in shown else None,
        tv_miss=shown["broadcaster"]["average_miss"], tries=state["rounds_used"])
    mae = final["test_mae"]
    tenth = lambda v: None if v is None else round(v, 1)  # noqa: E731 - the step rounded the unrounded score; the file holds two decimals
    ev["summary"] = wording.final_summary(tenth(mae["llm"]), tenth(mae["forward"]), tenth(mae["tv"]), winner,
                                          shown["know_nothing"]["average_miss"])
    state["final"] = final


def _keep_numbers(old: dict, new: dict) -> None:
    """The rebuilt facts must carry the very numbers the file holds; only wording may differ."""
    if set(old) != set(new):
        raise RewordError("the rebuilt facts are not the file's facts")
    for fact_id, fact in old.items():
        for key in ("value", "unit"):
            if fact[key] != new[fact_id][key]:
                raise RewordError(f"fact {fact_id} has a different {key} when built again")
        if fact["display"] != new[fact_id]["display"] and fact_id != "chosen_label":
            raise RewordError(f"fact {fact_id} shows a different number when built again")


def _reword_written(ev: dict, old_label: str | None, facts: dict | None, template_blocks: list[dict]) -> None:
    expl = ev["changes"]["explanation"]
    if facts is None:
        raise RewordError("the explanation step comes before the writing step")
    new_label = facts["chosen_label"]["display"]
    by_id = {b["id"]: b for b in template_blocks}
    blocks = []
    for old in expl["blocks"]:
        from_model = old.get("from_model", [])
        block = {**by_id[old["id"]], "from_model": from_model}
        if "title" in from_model:
            block["title"] = old["title"].replace(old_label, new_label)
        if "sentences" in from_model:
            block["sentences"] = [s.replace(old_label, new_label) for s in old["sentences"]]
        blocks.append(block)
    expl["facts"] = facts
    expl["blocks"] = blocks
    if expl.get("fallback_reason") is None and ev["summary"].startswith("The language model wrote the words for"):
        offered = [b for b in blocks if b["id"] not in cricket_blocks.CODE_ONLY]
        covered = sum(1 for b in blocks if b["from_model"])
        ev["summary"] = wording.wrote_summary(covered, len(offered))


def reworded(recording: dict) -> dict:
    """`reword`, refused for a recording made on other data, and checked to change wording only."""
    if recording.get("fingerprint") != data_fingerprint():
        raise RewordError("the recording was made on other data: record the run again (scripts/record_run.py)")
    new = reword(recording)
    old_without_version = {k: v for k, v in recording.items() if k != "wording_version"}
    check_only_wording_changed(old_without_version["events"], new["events"])
    return new


def dump(recording: dict) -> str:
    return json.dumps(recording, ensure_ascii=False, separators=(",", ":")) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", default=str(DEFAULT_FILE), help="the recording to reword")
    parser.add_argument("--check", action="store_true", help="change nothing; exit 1 if the wording is out of date")
    args = parser.parse_args(argv)
    path = Path(args.file)
    recording = json.loads(path.read_text(encoding="utf-8"))
    try:
        new = reworded(recording)
    except RewordError as exc:
        print(f"Not reworded: {exc}", file=sys.stderr)
        return 1
    if args.check:
        if new != recording:
            print(f"{path.name} is in old wording: run scripts/reword_recorded_run.py", file=sys.stderr)
            return 1
        print(f"{path.name} is in today's wording ({new['wording_version']})")
        return 0
    path.write_text(dump(new), encoding="utf-8")
    print(f"Reworded {path} ({new['wording_version']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
