# Contract: the language-model interface

The graph depends on one small interface. Everything else (OpenRouter, httpx, keys, timeouts) is behind it.

```python
class LlmClient(Protocol):
    def complete(self, payload: LlmRequest) -> str:
        """Return the reply text, or raise LlmUnavailable / LlmTimeout."""

@dataclass(frozen=True)
class LlmRequest:
    model: str                      # an id from the owner's list, never from the visitor
    system: str
    user: str
    max_tokens: int
    timeout: float                  # seconds, already fitted to the remaining budget
    json_schema: dict | None        # asks for structured output where supported
```

- `LlmUnavailable`: the provider failed, refused or returned an error status, or the key is not set. Its message never contains the key.
- `LlmTimeout`: no reply within `timeout`.
- Anything the model returned that cannot be turned into a proposal is `UnusableReply`, raised by the parser, not the client.

## The reply the model is asked for

```json
{ "features": ["wickets_in_hand", "runs_at_10"], "reason": "One or two sentences in cricket language.", "finished": false }
```

Parsing (`llm_reply.parse_reply`): plain JSON, then strip a markdown code fence, then the text from the first `{` to the last `}`; validate with pydantic (`features: list[str]`, `reason: str`, `finished: bool = False`). Failure is `UnusableReply`.

## The scripted fake

`FakeLlm(script)` returns scripted replies by model id and call number, so a test or the e2e server can produce: a good sequence of proposals, an unknown feature, an empty set, a repeat, nine features, a redundant set, a reply wrapped in a code fence, a reply with extra prose, text that is not JSON, a timeout, an outage, and "finished" on the first call. It records every `LlmRequest` it receives (so tests can search prompts for test-year values and count calls). It reads no environment variable and makes no network call. Selected in the app by `LLM_PROVIDER=fake`; without it, `OpenRouterClient` is used.

## Call accounting

`RunBudget` (in the run's config, not in state) counts calls (cap `LLM_MAX_CALLS`) and tracks the deadline; `propose_features` asks it for a call and a timeout before every call, and receives "no budget" instead of a call when the cap or the time is used up.
