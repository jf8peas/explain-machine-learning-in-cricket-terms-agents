"""Data endpoint for any table-shaped app. Shared-library candidate.

GET /data -> {columns, rows, summary}. Knows nothing about the specific data: pass it a function
that builds the table (see specs/002-data-tab/contracts/data-api.md).
"""
from __future__ import annotations

from typing import Any, Callable

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .data_loading import DataError

CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400"


def create_router(build_table: Callable[[], dict[str, Any]]) -> APIRouter:
    router = APIRouter()

    @router.get("/data")
    def data() -> JSONResponse:
        try:
            body = build_table()
        except DataError as exc:
            return JSONResponse({"detail": str(exc)}, status_code=500, headers={"Cache-Control": "no-store"})
        return JSONResponse(body, headers={"Cache-Control": CACHE_CONTROL})

    return router
