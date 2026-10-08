"""The four ways of predicting a final total that the page compares, defined once. App-specific.

Every place that names a method (the introduction, the results table, the chart key, the explanation) reads from here.
The order is the display order. The two the agent builds are `llm` and `forward`; the other two are references.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Method:
    id: str
    name: str           # how the page names it
    note: str           # one line of technical description
    marker: str         # the open shape that stands for it on the chart


METHODS: tuple[Method, ...] = (
    Method("know_nothing", "the know-nothing guess",
           "always the training years' average final total, whatever the score at 10 overs", "square"),
    Method("broadcaster", "the TV projection",
           "the broadcaster's projected score: current run rate x 20 overs", "circle"),
    Method("llm", "the language model's model",
           "a straight line fitted on the features the language model picked", "triangle"),
    Method("forward", "forward selection's model",
           "a straight line fitted on the features forward selection picked", "diamond"),
)
BY_ID = {m.id: m for m in METHODS}


def method_defs(ids=None) -> list[dict[str, str]]:
    """Plain data for the page: the given methods (default all), always in display order."""
    wanted = None if ids is None else set(ids)
    return [{"id": m.id, "name": m.name, "note": m.note, "marker": m.marker}
            for m in METHODS if wanted is None or m.id in wanted]
