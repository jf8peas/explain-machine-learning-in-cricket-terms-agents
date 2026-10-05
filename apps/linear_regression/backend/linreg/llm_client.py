"""The language-model interface and the OpenRouter client behind it. App-specific.

The rest of the app depends only on LlmClient.complete(request) -> reply text. Everything provider-specific (the URL,
the key, httpx, timeouts) lives here. The key comes only from the OPENROUTER_API_KEY environment variable and is
removed from every message this module raises or logs.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Protocol

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
KEY_VARIABLE = "OPENROUTER_API_KEY"
TEMPERATURE = 0.3
REASONING_EFFORT = "low"


@dataclass(frozen=True)
class LlmRequest:
    model: str                     # an id from the owner's list, never from the visitor
    system: str
    user: str
    max_tokens: int                # the reply length cap, sent on every call
    timeout: float                 # seconds, already fitted to the time left in the run
    json_schema: dict | None = None  # asks for structured output where the model supports it


class LlmError(Exception):
    """Base for failures of a model call. Messages never contain the key."""


class LlmUnavailable(LlmError):
    """The provider failed or refused, the reply was not usable as text, or the key is not set."""

    def __init__(self, message: str, unsupported_format: bool = False):
        super().__init__(message)
        self.unsupported_format = unsupported_format  # the host rejected response_format; retry without it


class LlmTimeout(LlmError):
    """No reply within the time allowed."""


class LlmClient(Protocol):
    def complete(self, request: LlmRequest) -> str:
        """Return the reply text, or raise LlmUnavailable / LlmTimeout."""


def redact(text: str, key: str | None) -> str:
    return text.replace(key, "[redacted]") if key else text


class OpenRouterClient:
    def __init__(self, api_key: str | None = None, transport: httpx.BaseTransport | None = None,
                 url: str = OPENROUTER_URL):
        self._api_key = api_key
        self._transport = transport
        self._url = url

    def _key(self) -> str | None:
        return self._api_key or os.environ.get(KEY_VARIABLE) or None

    def complete(self, request: LlmRequest) -> str:
        key = self._key()
        if not key:
            raise LlmUnavailable("The language model is not configured on this server.")
        body: dict = {
            "model": request.model,
            "messages": [{"role": "system", "content": request.system}, {"role": "user", "content": request.user}],
            "max_tokens": request.max_tokens,
            "temperature": TEMPERATURE,
            # Models that think before answering are billed, and capped, for that thinking too. Asking for little of it
            # leaves the reply cap for the answer; hosts that do not support the setting ignore it.
            "reasoning": {"effort": REASONING_EFFORT},
        }
        if request.json_schema is not None:
            body["response_format"] = {"type": "json_schema",
                                       "json_schema": {"name": "feature_proposal", "strict": True,
                                                       "schema": request.json_schema}}
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                   "X-Title": "Explain machine learning in cricket terms"}
        try:
            with httpx.Client(transport=self._transport, timeout=request.timeout) as http:
                response = http.post(self._url, json=body, headers=headers)
        except httpx.TimeoutException:
            raise LlmTimeout("The language model did not reply in time.") from None
        except httpx.HTTPError as exc:
            raise LlmUnavailable(redact(f"The language model could not be reached ({exc}).", key)) from None
        if response.status_code >= 400:
            raise self._error(response, key, structured=request.json_schema is not None)
        return self._text(response, key)

    @staticmethod
    def _error(response: httpx.Response, key: str, structured: bool) -> LlmUnavailable:
        # The provider's own words may echo request details, so they are used only to spot a format problem.
        try:
            detail = response.text.lower()
        except Exception:  # noqa: BLE001
            detail = ""
        unsupported = (structured and response.status_code in (400, 404, 422)
                       and ("response_format" in detail or "structured" in detail or "json_schema" in detail))
        return LlmUnavailable(f"The language model's provider answered with an error ({response.status_code}).",
                              unsupported_format=unsupported)

    @staticmethod
    def _text(response: httpx.Response, key: str) -> str:
        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError):
            raise LlmUnavailable("The language model's answer had no reply text.") from None
        if isinstance(content, list):  # some hosts return a list of parts
            content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
        if not isinstance(content, str) or not content.strip():
            raise LlmUnavailable("The language model's answer had no reply text.")
        return redact(content, None)
