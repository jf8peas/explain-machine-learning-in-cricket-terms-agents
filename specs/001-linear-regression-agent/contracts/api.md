# API Contract

Base path on the app's own deployment: `/api`. When the website proxies the app, it rewrites `/api/linear-regression/*` to this app, so the visualiser is configured with full URLs and never assumes a path.

## `GET /api/structure`

- **200** `application/json`, body per [structure.schema.json](structure.schema.json).
- Cacheable (static for a deployment).
- Includes `__start__` and `__end__` as nodes of kind `start` / `end`.
- Conditional edges carry `branch`. Expected for this app: `load_data → explore` (`ok`), `load_data → __end__` (`stop`), `evaluate → tune` (`tune`), `evaluate → explain_in_cricket_terms` (`explain`).

## `GET /api/run`

- **200** `text/event-stream`; headers `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
- Each run is independent and deterministic; there is no server state and no parameters.
- Events (SSE `event:` name, then `data:` JSON):

| event | data | when |
|---|---|---|
| `step` | StepEvent ([step-event.schema.json](step-event.schema.json)) | once per completed node, in completion order |
| `done` | `{ "steps": <int> }` | after the last node, or after `load_data` stops |
| `error` | `{ "message": <string> }` | an unexpected failure; the stream then ends |

- A data failure (FR-007a) is **not** an `error` event: it is an ordinary `step` from `load_data` (summary states the reason, `changes.data_error` set), followed by `done`.
- Guarantees: `step` numbers are 1, 2, 3, … without gaps; node order matches a valid path through `/structure`; numpy values are converted to plain JSON numbers; non-finite floats never appear.
- The final run state is the shallow merge of all `changes` (minus `summary`), so clients need no other call to obtain coefficients, intercept, features and explanation.

## Client rules (visualiser)

- Read with `fetch()` and a stream reader; do not use `EventSource`.
- Abort the request when Play is pressed again.
- On disconnect before `done`, show a message and keep received steps viewable.

## Versioning

Additive changes only within the first release. Shared by all eight apps once extracted, so any breaking change needs a new path version.
