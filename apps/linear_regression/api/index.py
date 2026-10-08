"""Vercel entry point: exposes the FastAPI app at /api/structure, /api/run, /api/models, /api/data and /api/catalogue."""
import json
import logging
import os
import sys
from pathlib import Path
from typing import Mapping

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fastapi import FastAPI  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from linreg.catalogue_api import create_router as create_catalogue_router  # noqa: E402
from linreg.data_api import create_router as create_data_router  # noqa: E402
from linreg.data_table import build_table  # noqa: E402
from linreg.graph import NODE_ACTORS, NODE_STAGES, build_graph  # noqa: E402
from linreg.graph_api import create_router  # noqa: E402
from linreg.limit_store import LimitStore  # noqa: E402
from linreg.llm_client import LlmClient, OpenRouterClient  # noqa: E402
from linreg.llm_fake import FAKE_MODEL_OPTIONS, default_fake  # noqa: E402
from linreg.model_options import ModelOptions  # noqa: E402
from linreg.run_gate import RunGate  # noqa: E402
from linreg.stage_info import structure_extras  # noqa: E402
from linreg.state import RECURSION_LIMIT  # noqa: E402

# Our own loggers (linreg.limits, linreg.gate, linreg.llm) report at INFO so a deployment can be diagnosed from its logs.
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

MODELS_CACHE = "public, s-maxage=300, stale-while-revalidate=3600"


def create_app(llm: LlmClient, options: ModelOptions, environ: Mapping[str, str] | None = None,
               store: LimitStore | None = None) -> FastAPI:
    """The whole API, built from an injected language-model client and the owner's model list."""
    gate = RunGate(options, environ, store)
    app = FastAPI(title="Linear regression agent")
    app.include_router(create_router(build_graph(llm), lambda: {}, RECURSION_LIMIT,
                                     node_meta={n: {"actor": a, "stage": NODE_STAGES[n]} for n, a in NODE_ACTORS.items()},
                                     admit=gate.admit, structure_extras=structure_extras),
                       prefix="/api")
    app.include_router(create_data_router(build_table), prefix="/api")
    app.include_router(create_catalogue_router(), prefix="/api")

    @app.get("/api/models")
    def models() -> JSONResponse:
        return JSONResponse(options.public(), headers={"Cache-Control": MODELS_CACHE})

    return app


# LLM_PROVIDER=fake selects the scripted stand-in model (tests and the end-to-end server only; never set in production).
FAKE = os.environ.get("LLM_PROVIDER") == "fake"
llm = default_fake() if FAKE else OpenRouterClient()
_env = dict(os.environ)
if FAKE and not _env.get("MODEL_OPTIONS"):
    _env["MODEL_OPTIONS"] = json.dumps(FAKE_MODEL_OPTIONS)  # the model ids the fake knows
options = ModelOptions.from_env(_env)
app = create_app(llm, options, _env)
