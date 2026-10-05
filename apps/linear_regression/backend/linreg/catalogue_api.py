"""GET /api/catalogue: the candidate features, for the page and the try-your-own form. App-specific."""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from . import features
from .data_table import COMPETITION_NAMES

CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400"


def create_router() -> APIRouter:
    router = APIRouter()

    @router.get("/catalogue")
    def catalogue() -> JSONResponse:
        return JSONResponse(features.public_catalogue(COMPETITION_NAMES), headers={"Cache-Control": CACHE_CONTROL})

    return router
