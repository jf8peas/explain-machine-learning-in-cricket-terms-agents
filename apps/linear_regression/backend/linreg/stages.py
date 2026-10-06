"""The eight stages of a machine learning project, defined once for every algorithm app. Shared-library candidate.

Every node of an agent's graph belongs to exactly one stage. The stage set travels to the browser inside the graph's
structure response, so the graph visualiser never holds a stage name of its own. This module knows nothing about any
particular app: an app gives each node a stage id and `check_stages` confirms none was missed.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence


@dataclass(frozen=True)
class Stage:
    id: str
    number: int          # the position in the set, 1 to 8; shown on badges
    name: str
    question: str
    description: str     # one plain sentence


STAGES: tuple[Stage, ...] = (
    Stage("frame", 1, "Frame the problem", "What are we predicting, and what counts as good?",
          "Say what we are predicting and what counts as a good answer, so we know the score to beat."),
    Stage("prepare", 2, "Prepare the data", "Is the data clean and in a usable form?",
          "Clean the data and turn what was recorded into measurements a model can use."),
    Stage("understand", 3, "Understand the data", "What patterns are there?",
          "Look for patterns in the data before fitting anything."),
    Stage("split", 4, "Split the data", "What do we learn from, choose with, and mark on?",
          "Set aside data to learn from, data to choose with, and data to mark the final answer on."),
    Stage("fit", 5, "Fit the model", "What are the best parameters for this setup?",
          "For one chosen setup, find the parameters that fit the learning data best."),
    Stage("choose", 6, "Choose the setup", "Which features, model type and hyperparameters?",
          "Decide which features, model type and hyperparameters to use, judged on data the fit never saw."),
    Stage("assess", 7, "Final assessment", "How good is it on data it has never seen?",
          "Score the chosen model once, on data it has never seen."),
    Stage("interpret", 8, "Interpret and communicate", "What does it mean?",
          "Explain in plain words what the result means."),
)

# The two stages that form the loop the page emphasises: every new setup (choose) is fitted again (fit).
FIT_STAGE = "fit"
CHOOSE_STAGE = "choose"


class StageError(ValueError):
    """A node has no stage, a node names a stage that is not in the set, or the mapping names a node that is not there."""


def stage_set(stages: Sequence[Stage] = STAGES) -> list[dict[str, Any]]:
    return [{"id": s.id, "number": s.number, "name": s.name, "question": s.question, "description": s.description}
            for s in stages]


def check_stages(app, mapping: Mapping[str, str], stages: Sequence[Stage] = STAGES) -> None:
    """Raise StageError listing every problem. `app` is a compiled graph; `__start__` and `__end__` need no stage."""
    known = {s.id for s in stages}
    nodes = {n for n in app.get_graph().nodes if n not in ("__start__", "__end__")}
    problems = [f"node '{n}' has no stage" for n in sorted(nodes) if n not in mapping]
    problems += [f"node '{n}' names the unknown stage '{mapping[n]}'" for n in sorted(nodes)
                 if n in mapping and mapping[n] not in known]
    problems += [f"'{k}' is in the stage mapping but is not a node of the graph" for k in sorted(mapping) if k not in nodes]
    if problems:
        raise StageError("; ".join(problems))
