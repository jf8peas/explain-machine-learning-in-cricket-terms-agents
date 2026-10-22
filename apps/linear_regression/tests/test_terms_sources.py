"""The backend wording takes its method names from the term list in methods.py (feature 021, FR-003): change a term there and
every sentence changes with it. Run in a copy of the package whose list says "robot search" and "robot agent", so no module is
reloaded in this process."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent / "backend"

PROBE = r"""
import json, sys
sys.path.insert(0, sys.argv[1])
from linreg import accuracy_text, cricket_blocks, cricket_facts, goal, headlines, methods, setup_settings, selection, wording
facts = {"chosen_label": {"value": "forward", "display": cricket_facts.METHOD_LABELS["forward"]}}
out = {
    "labels": cricket_facts.METHOD_LABELS,
    "defs": methods.method_defs(),
    "definitions": methods.definitions(),
    "headlines": [headlines.build(agent_miss=a, search_miss=s, tv_miss=20.5, tries=5) for a, s in ((17.0, 18.0), (None, 17.5))],
    "wording": [wording.winner_name("llm"), wording.winner_name("forward"), wording.no_proposal_summary(),
                wording.final_summary(17.9, 17.8, 21.4, "forward", 34.5),
                wording.grid_summary(24, 20, "learned from all", "runs", 18.0, "reason")],
    "goal": goal.verdict_sentence({"beat": True, "reached": True, "improvement_runs": 3.6, "improvement_percent": 16.8}),
    "note": setup_settings.HYPERPARAMETER_NOTE,
    "winner": selection.validation_winner({"validation_mae": 1.0}, {"validation_mae": 2.0})["reason"],
}
print(json.dumps(out))
"""


@pytest.fixture(scope="module")
def probed(tmp_path_factory):
    root = tmp_path_factory.mktemp("robot")
    shutil.copytree(BACKEND / "linreg", root / "linreg", ignore=shutil.ignore_patterns("__pycache__"))
    methods = root / "linreg" / "methods.py"
    text = methods.read_text(encoding="utf-8")
    for old, new in (('Term("brute_force", "brute-force search",', 'Term("brute_force", "robot search",'),
                     ('Term("agent", "AI agent",', 'Term("agent", "robot agent",'),
                     ('Term("average_total", "average-total guess",', 'Term("average_total", "mean guess",')):
        assert old in text
        text = text.replace(old, new)
    methods.write_text(text, encoding="utf-8")
    result = subprocess.run([sys.executable, "-I", "-c", PROBE, str(root)], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def test_the_labels_and_method_names_follow_the_list(probed):
    assert probed["labels"] == {"llm": "robot agent's model", "forward": "robot search's model", "broadcaster": "TV projection",
                                "know_nothing": "mean guess"}
    assert [d["name"] for d in probed["defs"]] == ["the mean guess", "the TV projection", "the robot agent's model",
                                                    "the robot search's model"]


def test_no_old_name_survives_in_any_backend_sentence(probed):
    text = json.dumps({k: v for k, v in probed.items()}).lower()
    for old in ("brute-force", "ai agent", "average-total"):
        assert old not in text, old
    assert "robot search" in text and "robot agent" in text and "mean guess" in text


def test_the_definitions_and_headlines_are_worded_from_the_list(probed):
    assert probed["definitions"]["brute_force"].startswith("The robot search is plain code, no AI:")
    assert probed["headlines"][1]["hero_h1"] == "The robot agent couldn't run, so the robot search ran alone."
    assert probed["winner"].startswith("the robot agent's best idea")
