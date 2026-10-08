"""Deciding whether a run may start, and with what. App-specific.

Every check happens before any language-model call, so a refused start can never cost anything. In order: the chosen
model must be on the owner's list; the visitor must not already have a run going; the site's daily cap and the
visitor's hourly limit must have room. A refusal says when to try again. If the limit store cannot be reached the run
still goes ahead, but without the language model (forward selection only), because the limits could not be checked.
"""
from __future__ import annotations

import hashlib
import logging
import os
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable, Mapping

from fastapi import Request

from .graph_api import Refusal
from .limit_store import LimitStore, StoreUnavailable, store_from_env
from .model_options import ModelOption, ModelOptions
from .run_budget import RunBudget

log = logging.getLogger("linreg.gate")

NOT_AVAILABLE = ("That model is no longer available. The default model has been selected for you; press Play "
                 "again to use it.")
STORE_DOWN = ("The run limits could not be checked just now, so the language model was not used. Forward "
              "selection, which needs no model, still ran.")


@dataclass
class Permit:
    """What an admitted run carries: the per-run configuration and a way to release anything it holds."""
    configurable: dict
    release: Callable[[], None] = field(default=lambda: None)


def visitor_id(request: Request, secret: str) -> str:
    """A hash of the visitor's address (first X-Forwarded-For entry). The address itself is never stored or logged."""
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    address = forwarded or request.headers.get("x-real-ip", "").strip() or (request.client.host if request.client else "")
    return hashlib.sha256(f"{secret}|{address}".encode()).hexdigest()[:20]


def _when(seconds: float) -> str:
    seconds = max(1, int(round(seconds)))
    if seconds < 90:
        return f"in {seconds} second{'s' if seconds != 1 else ''}"
    minutes = int(round(seconds / 60))
    if minutes < 90:
        return f"in about {minutes} minute{'s' if minutes != 1 else ''}"
    hours = int(round(seconds / 3600))
    return f"in about {hours} hour{'s' if hours != 1 else ''}"


class RunGate:
    def __init__(self, options: ModelOptions, environ: Mapping[str, str] | None = None, store: LimitStore | None = None,
                 clock: Callable[[], float] = time.time):
        self.options = options
        self.environ = os.environ if environ is None else environ
        self.store = store if store is not None else store_from_env(self.environ)
        self._clock = clock
        # Hashing needs a secret; without one a random per-process value is used (ids then change when the server does).
        self._secret = self.environ.get("VISITOR_ID_SECRET") or secrets.token_hex(16)
        if not self.environ.get("VISITOR_ID_SECRET"):
            log.warning("VISITOR_ID_SECRET is not set: visitor ids will not survive a restart. Set it in production.")
        log.info("run gate ready: limit store=%s", type(self.store).__name__ if self.store is not None else "none")

    def _number(self, name: str, default: int) -> int:
        try:
            return int(self.environ.get(name, default))
        except (TypeError, ValueError):
            return default

    def _model(self, request: Request) -> ModelOption:
        chosen = request.query_params.getlist("model")
        if len(chosen) > 1:  # a repeated parameter is an altered request
            raise Refusal(400, "model_not_allowed", NOT_AVAILABLE)
        option = self.options.resolve(chosen[0] if chosen else None)
        if option is None:
            raise Refusal(400, "model_not_allowed", NOT_AVAILABLE)
        return option

    def _configurable(self, model: ModelOption, started: float, llm_allowed: bool, reason: str | None = None) -> dict:
        cfg = {"model_id": model.id, "model_name": model.name, "llm_allowed": llm_allowed,
               "budget": RunBudget.from_env(started, self.environ)}
        if reason:
            cfg["llm_unavailable_reason"] = reason
        return cfg

    def admit(self, request: Request, started: float) -> Permit:
        model = self._model(request)
        if self.store is None:  # no way to check the limits: never call the model
            log.warning("run limit store not configured: running without the language model (model=%s)", model.id)
            return Permit(self._configurable(model, started, False, STORE_DOWN))
        vid = visitor_id(request, self._secret)
        lock_ttl = self._number("RUN_LOCK_SECONDS", 90)
        lock_key = f"run:lock:{vid}"
        now = datetime.fromtimestamp(self._clock(), timezone.utc)
        counted: list[str] = []
        locked = False
        try:
            if not self.store.take_lock(lock_key, lock_ttl):
                raise Refusal(429, "run_in_progress", "A run is already in progress for you. Wait for it to finish "
                              "before starting another.", retry_after=lock_ttl)
            locked = True
            day_key = f"runs:day:{now:%Y-%m-%d}"
            count, _ = self.store.incr(day_key, 86400)
            counted.append(day_key)
            if count > self._number("RUN_LIMIT_PER_DAY", 300):
                midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                wait = (midnight - now).total_seconds()
                raise Refusal(429, "daily_limit", f"Today's limit of runs has been reached for everyone. Try again "
                              f"after 00:00 UTC, {_when(wait)}.", retry_after=wait)
            hour_key = f"runs:hour:{vid}:{now:%Y-%m-%d-%H}"
            count, left = self.store.incr(hour_key, 3600)
            counted.append(hour_key)
            if count > self._number("RUN_LIMIT_PER_HOUR", 5):
                raise Refusal(429, "hourly_limit", f"You have started as many runs as are allowed in an hour. You can "
                              f"start another run {_when(left)}.", retry_after=left)
        except Refusal:
            self._undo(lock_key, locked, counted)  # a refused start leaves no lock and uses up no quota
            raise
        except StoreUnavailable as exc:
            log.warning("run limit store unavailable, so running without the language model (model=%s): %s", model.id, exc)
            self._undo(lock_key, locked, counted)
            return Permit(self._configurable(model, started, False, STORE_DOWN))
        return Permit(self._configurable(model, started, True), release=lambda: self._release(lock_key))

    def _undo(self, lock_key: str, locked: bool, counted: list[str]) -> None:
        try:
            for key in counted:
                self.store.decr(key)
            if locked:
                self.store.release_lock(lock_key)
        except StoreUnavailable:
            pass  # best effort: the lock expires by itself and counters expire with their window

    def _release(self, lock_key: str) -> None:
        try:
            self.store.release_lock(lock_key)
        except StoreUnavailable:
            log.warning("could not release the run lock; it will expire by itself")
