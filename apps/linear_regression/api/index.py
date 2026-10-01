"""Vercel entry point: exposes the FastAPI app at /api/structure and /api/run."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fastapi import FastAPI  # noqa: E402

from linreg.graph import build_graph  # noqa: E402
from linreg.graph_api import create_router  # noqa: E402
from linreg.state import RECURSION_LIMIT  # noqa: E402

app = FastAPI(title="Linear regression agent")
app.include_router(create_router(build_graph(), lambda: {}, RECURSION_LIMIT), prefix="/api")
