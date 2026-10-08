"""The goal is one object: its words and its margin are the same in the introduction, the verdict and the explanation, and
nothing about it is typed anywhere else (feature 006)."""
import re
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from linreg import goal as goal_module
from linreg import reference_api
from linreg.llm_fake import FakeLlm
from linreg.goal import goal
from tests.conftest import make_table, merged_state
from tests.test_final_test import SCRIPT

APP = Path(__file__).resolve().parent.parent


def names_margin(text, n):
    """True if the text speaks of a goal of n runs (a whole number, not the tail of a figure like 5.3)."""
    return re.search(rf"(?<![\d.]){n}(?:-run| runs)", text) is not None


def reference_text():
    api = FastAPI()
    api.include_router(reference_api.create_router(), prefix="/api")
    return TestClient(api).get("/api/reference").json()["goal"]["text"]


def run(run_graph, write_csv):
    return merged_state(run_graph({"data_path": write_csv(make_table())}, llm=FakeLlm({"fake/steady": list(SCRIPT)})))


def test_the_introductions_goal_the_verdict_and_the_explanation_all_name_the_same_margin(run_graph, write_csv):
    state = run(run_graph, write_csv)
    margin = goal()["margin_runs"]
    assert f"at least {margin} runs" in reference_text()
    assert f"at least {margin} runs" in state["final"]["verdict_sentence"]
    assert f"at least {margin} runs" in " ".join(state["explanation"]["sentences"])


def test_changing_the_margin_changes_every_place_the_goal_appears(run_graph, write_csv, monkeypatch):
    monkeypatch.setattr(goal_module, "MARGIN_RUNS", 5)
    state = run(run_graph, write_csv)
    assert "at least 5 runs" in reference_text()
    assert "at least 5 runs" in state["final"]["verdict_sentence"]
    assert "at least 5 runs" in " ".join(state["explanation"]["sentences"])
    assert not names_margin(state["final"]["verdict_sentence"], 3)
    f = state["final"]
    assert f["verdict"]["reached"] is (f["verdict"]["improvement_runs"] >= 5)
    assert f["cleared_margin"] is f["verdict"]["reached"]


def test_the_explanation_does_not_keep_its_own_copy_of_the_margin(run_graph, write_csv, monkeypatch):
    monkeypatch.setattr(goal_module, "MARGIN_RUNS", 7)
    sentences = " ".join(run(run_graph, write_csv)["explanation"]["sentences"])
    assert names_margin(sentences, 7)
    assert not names_margin(sentences, 3)


def test_the_page_holds_no_hand_written_goal():
    html = (APP / "web" / "index.html").read_text(encoding="utf-8").lower()
    assert "at least 3" not in html and "3 runs" not in html and "3-run" not in html
    page_code = " ".join(p.read_text(encoding="utf-8").lower() for p in (APP / "web" / "src" / "page").glob("*.ts"))
    assert "at least 3" not in page_code and "3 runs" not in page_code and "3-run" not in page_code


def test_the_percentage_in_the_verdict_can_be_checked_by_hand_from_the_displayed_misses(run_graph, write_csv):
    f = run(run_graph, write_csv)["final"]
    v = f["verdict"]
    assert v["reference_miss"] == f["accuracy"]["broadcaster"]["average_miss"]
    assert v["winner_miss"] == f["accuracy"][f["winner"]]["average_miss"]
    assert v["improvement_runs"] == round(v["reference_miss"] - v["winner_miss"], 1)
    assert v["improvement_percent"] == round(v["improvement_runs"] / v["reference_miss"] * 100, 1)
