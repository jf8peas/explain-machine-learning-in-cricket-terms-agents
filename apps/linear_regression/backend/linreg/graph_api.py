"""Structure and stream endpoints for any compiled LangGraph app. Shared-library candidate.

GET /structure -> {nodes, edges}; GET /run -> Server-Sent Events, one `step` per completed node.
Knows nothing about the specific agent: pass it a compiled graph.
"""
from __future__ import annotations

import json
import math
import time
from typing import Any, Callable, Iterator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

HIDDEN_KEYS = {"summary", "data_path"}


class Refusal(Exception):
    """A start that is refused before the graph runs. Becomes a JSON response with this status."""

    def __init__(self, status: int, reason: str, message: str, retry_after: float | None = None):
        super().__init__(message)
        self.status, self.reason, self.message, self.retry_after = status, reason, message, retry_after


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


def graph_structure(app, node_meta: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    """Nodes and edges. `node_meta` maps a node id to extra fields for that node (for example {"actor": "llm"})."""
    meta = node_meta or {}
    raw = app.get_graph().to_json()
    nodes = []
    for n in raw["nodes"]:
        kind = "start" if n["id"] == "__start__" else "end" if n["id"] == "__end__" else "node"
        nodes.append({"id": n["id"], "kind": kind, **(meta.get(n["id"]) or {})})
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


def run_events(app, initial: dict[str, Any], recursion_limit: int, configurable: dict[str, Any] | None = None,
               redact: Callable[[str], str] | None = None, release: Callable[[], None] | None = None) -> Iterator[str]:
    """One `step` event per completed node, then `done`; `error` on failure."""
    step = 0
    pending: tuple[str, dict] | None = None
    try:
        for mode, chunk in app.stream(initial, stream_mode=["updates", "values"],
                                      config={"recursion_limit": recursion_limit,
                                              "configurable": configurable or {}}):
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
        message = f"The run failed: {exc}"
        yield sse("error", {"message": redact(message) if redact else message})
    finally:
        if release:
            release()  # for example, free the visitor's run-in-progress lock, however the stream ended


def create_router(app, initial_state: Callable[[], dict[str, Any]], recursion_limit: int,
                  node_meta: dict[str, dict[str, Any]] | None = None,
                  admit: Callable[[Request, float], Any] | None = None) -> APIRouter:
    """`admit(request, started)` decides whether a run may start. It returns a permit with `configurable` (the per-run
    configuration passed to the graph outside its state) and `release()` (called when the stream ends), or raises
    Refusal. `started` is a monotonic clock reading taken at the top of the handler."""
    router = APIRouter()
    structure = graph_structure(app, node_meta)

    @router.get("/structure")
    def get_structure():
        return structure

    @router.get("/run")
    def get_run(request: Request):
        started = time.monotonic()
        permit = None
        if admit:
            try:
                permit = admit(request, started)
            except Refusal as refusal:
                body: dict[str, Any] = {"reason": refusal.reason, "message": refusal.message}
                headers = {"Cache-Control": "no-store"}
                if refusal.retry_after is not None:
                    seconds = max(1, int(math.ceil(refusal.retry_after)))
                    body["retry_after_seconds"] = seconds
                    headers["Retry-After"] = str(seconds)
                return JSONResponse(body, status_code=refusal.status, headers=headers)
        return StreamingResponse(
            run_events(app, initial_state(), recursion_limit, permit.configurable if permit else None,
                       release=permit.release if permit else None),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return router
