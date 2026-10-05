# `<graph-replay>`

A framework-free web component that draws any agent graph and replays a run of it. It knows nothing about the app: it is driven only by a structure and a stream of events.

```html
<graph-replay structure-url="/api/structure" run-url="/api/run"></graph-replay>
<script type="module" src="./graph-replay/graph-replay.ts"></script>
```

## Attributes

| Attribute | Meaning |
|---|---|
| `structure-url` | `GET` returns the graph structure (see `contracts/structure.schema.json`) |
| `run-url` | `GET` returns Server-Sent Events: `step`, then `done` (or `error`) (see `contracts/api.md`) |
| `interval-ms` | optional starting pace in ms per step (default 1500) |
| `data-theme` | optional `light` or `dark` to override the system theme |

## Events it emits

`refused` when a start is refused, and `replaychange` (bubbles, composed) on every change. `detail`: `{ cursor, steps, finished, atEnd, state, finalState }`, where `state` is the accumulated state at the step on display and `finalState` is the state after the last step once the stream has finished. Host pages use this to show their own results; the component never interprets the state.

## Behaviour

Draws the whole graph before a run (dashed, labelled conditional edges); Play, Pause/Resume, Step, Back, Reset, a speed control, a clickable timeline of steps reached, and ← / → keys. Fetching is separate from display: events are buffered and shown at the chosen pace, and Back, jumping and the timeline replay from the buffer without rerunning the agent. Play and Reset are disabled while a run is streaming and come back when it ends (nothing is aborted and restarted). A node with `actor: "llm"` in the structure is drawn with a dashed outline and a small tag, and its events are marked in the event panel; `actor` is optional and means nothing beyond styling. If the server refuses a start (a non-2xx response with a JSON `message`), the message is shown, earlier results stay visible, and a `refused` event (`detail.message`) is emitted. Travelling-marker animation is switched off under `prefers-reduced-motion`.

## Files

| File | Role | Candidate for the shared library |
|---|---|---|
| `graph-replay.ts` | the custom element | yes |
| `buffer.ts` | event buffer, paced playback, navigation (pure, unit-tested) | yes |
| `sse.ts` | `fetch()` + stream reader (never `EventSource`, which would reconnect and rerun the agent) | yes |
| `layout.ts` | dagre layout wrapper | yes |
| `styles.ts` | component styles | yes |

## Shared-library candidates elsewhere in this app

`backend/linreg/data_loading.py`, `season_split.py`, `evaluation.py`, `cricket_explanation.py`, `graph_api.py` (structure + stream endpoints). They are kept inside this app until the second app is built; `tests/test_boundaries.py` checks they import nothing app-specific.
