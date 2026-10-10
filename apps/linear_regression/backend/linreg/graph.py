"""Builds the LangGraph StateGraph for the agent (app-specific).

load_data -> split -> explore -> baseline -> propose_features -> check_proposal -> fit_model -> evaluate
              (back to propose_features, or on to grid_search) -> final_test -> explain_in_cricket_terms -> write_in_cricket_terms

`propose_features` and `write_in_cricket_terms` are the language-model nodes; every other node is ordinary code. The
second writes only words (naming facts in braces), and code fills in every number.
"""
from __future__ import annotations

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph

from . import nodes
from .llm_client import LlmClient
from .state import RunState

# Which nodes are the language model's and which are code; the visualiser draws them differently.
NODE_ACTORS = {name: "code" for name in ["load_data", "split", "explore", "baseline", "check_proposal", "fit_model",
                                         "evaluate", "grid_search", "final_test", "explain_in_cricket_terms"]}
NODE_ACTORS["propose_features"] = "llm"
NODE_ACTORS["write_in_cricket_terms"] = "llm"

# Which of the eight machine learning stages (see stages.py) each node belongs to. The visualiser shows it on every node.
NODE_STAGES = {
    "baseline": "frame", "load_data": "prepare", "explore": "understand", "split": "split", "fit_model": "fit",
    "propose_features": "choose", "check_proposal": "choose", "evaluate": "choose", "grid_search": "choose",
    "final_test": "assess", "explain_in_cricket_terms": "interpret", "write_in_cricket_terms": "interpret",
}


def route_after_load(state: RunState) -> str:
    return "stop" if state.get("data_error") else "ok"


def route_after_check(state: RunState) -> str:
    """fit, rejected, or finished. A model that fails also ends the model's part (the decision says why)."""
    branch = state["decision"]["branch"]
    return "finished" if branch == "failed" else branch


def route_after_evaluate(state: RunState) -> str:
    return state["decision"]["branch"]          # continue or stop


def build_graph(llm: LlmClient):
    g = StateGraph(RunState)

    def propose_features(state: RunState, config: RunnableConfig) -> dict:
        return nodes.propose_features(state, config, llm)

    def write_in_cricket_terms(state: RunState, config: RunnableConfig) -> dict:
        return nodes.write_in_cricket_terms(state, config, llm)

    for name in ["load_data", "split", "explore", "baseline", "check_proposal", "fit_model", "evaluate",
                 "grid_search", "final_test", "explain_in_cricket_terms"]:
        g.add_node(name, getattr(nodes, name))
    g.add_node("propose_features", propose_features)
    g.add_node("write_in_cricket_terms", write_in_cricket_terms)

    g.add_edge(START, "load_data")
    g.add_conditional_edges("load_data", route_after_load, {"ok": "split", "stop": END})
    g.add_edge("split", "explore")
    g.add_edge("explore", "baseline")
    g.add_edge("baseline", "propose_features")
    g.add_edge("propose_features", "check_proposal")
    g.add_conditional_edges("check_proposal", route_after_check, {
        "fit": "fit_model", "rejected": "propose_features", "finished": "grid_search"})
    g.add_edge("fit_model", "evaluate")
    g.add_conditional_edges("evaluate", route_after_evaluate, {"continue": "propose_features",
                                                               "stop": "grid_search"})
    g.add_edge("grid_search", "final_test")
    g.add_edge("final_test", "explain_in_cricket_terms")
    g.add_edge("explain_in_cricket_terms", "write_in_cricket_terms")
    g.add_edge("write_in_cricket_terms", END)
    return g.compile()
