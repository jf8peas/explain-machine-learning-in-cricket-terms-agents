"""Builds the LangGraph StateGraph for the agent (app-specific)."""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from . import nodes
from .state import RunState


def route_after_load(state: RunState) -> str:
    return "stop" if state.get("data_error") else "ok"


def route_after_evaluate(state: RunState) -> str:
    return state["decision"]["branch"]


def build_graph():
    g = StateGraph(RunState)
    for name in ["load_data", "explore", "split", "baseline", "fit_model", "evaluate", "tune",
                 "explain_in_cricket_terms"]:
        g.add_node(name, getattr(nodes, name))
    g.add_edge(START, "load_data")
    g.add_conditional_edges("load_data", route_after_load, {"ok": "explore", "stop": END})
    g.add_edge("explore", "split")
    g.add_edge("split", "baseline")
    g.add_edge("baseline", "fit_model")
    g.add_edge("fit_model", "evaluate")
    g.add_conditional_edges("evaluate", route_after_evaluate,
                            {"tune": "tune", "explain": "explain_in_cricket_terms"})
    g.add_edge("tune", "fit_model")
    g.add_edge("explain_in_cricket_terms", END)
    return g.compile()
