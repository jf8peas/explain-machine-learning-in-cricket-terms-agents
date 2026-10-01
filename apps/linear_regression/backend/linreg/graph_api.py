"""Structure and stream endpoints for any compiled LangGraph app. Shared-library candidate.

GET /structure -> {nodes, edges}; GET /run -> Server-Sent Events, one `step` per completed node.
Knows nothing about the specific agent: pass it a compiled graph.
"""
from __future__ import annotations

import json
import math
from typing import Any, Callable, Iterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

HIDDEN_KEYS = {"summary", "data_path"}


def to_jsonable(value: Any) -> Any:
    """Plain JSON: numpy types converted, non-finite floats become null."""
    if isinstance(value, dict):
        return {str(k): to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_jsonable(v) for v in value]
    if hasattr(value, "item") and not isinstance(value, (str, bytes)):
        try:
            value = value.item()
        except (ValueError, AttributeError):
            return str(value)
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def graph_structure(app) -> dict[str, Any]:
    raw = app.get_graph().to_json()
    nodes = []
    for n in raw["nodes"]:
        kind = "start" if n["id"] == "__start__" else "end" if n["id"] == "__end__" else "node"
        nodes.append({"id": n["id"], "kind": kind})
    edges = []
    for e in raw["edges"]:
        conditional = bool(e.get("conditional"))
        edges.append({
            "source": e["source"], "target": e["target"], "conditional": conditional,
            # LangGraph omits the label when the branch name equals the target node name.
            "branch": (e.get("data") or e["target"]) if conditional else None,
        })
    return {"nodes": nodes, "edges": edges}


def sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(to_jsonable(data))}\n\n"


def run_events(app, initial: dict[str, Any], recursion_limit: int) -> Iterator[str]:
    """One `step` event per completed node, then `done`; `error` on failure."""
    step = 0
    pending: tuple[str, dict] | None = None
    try:
        for mode, chunk in app.stream(initial, stream_mode=["updates", "values"],
                                      config={"recursion_limit": recursion_limit}):
            if mode == "updates":
                (node, update), = chunk.items()
                pending = (node, update or {})
            elif mode == "values" and pending is not None:
                node, update = pending
                pending = None
                step += 1
                # Take full values from the snapshot so append-reduced keys arrive accumulated.
                changes = {k: chunk[k] for k in update if k not in HIDDEN_KEYS and k in chunk}
                yield sse("step", {"step": step, "node": node,
                                   "summary": update.get("summary", ""), "changes": changes})
        yield sse("done", {"steps": step})
    except Exception as exc:  # noqa: BLE001 - reported to the client as an error event
        yield sse("error", {"message": f"The run failed: {exc}"})


def create_router(app, initial_state: Callable[[], dict[str, Any]], recursion_limit: int) -> APIRouter:
    router = APIRouter()
    structure = graph_structure(app)

    @router.get("/structure")
    def get_structure():
        return structure

    @router.get("/run")
    def get_run():
        return StreamingResponse(
            run_events(app, initial_state(), recursion_limit),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return router
