"""GET /api/catalogue: the candidate features, for the page and the try-your-own form. App-specific."""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from . import features, setup_settings
from .data_table import COMPETITION_NAMES

CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400"


def create_router() -> APIRouter:
    router = APIRouter()

    @router.get("/catalogue")
    def catalogue() -> JSONResponse:
        body = {**features.public_catalogue(COMPETITION_NAMES), "setup_menus": setup_settings.public_menus()}
        return JSONResponse(body, headers={"Cache-Control": CACHE_CONTROL})

    return router
