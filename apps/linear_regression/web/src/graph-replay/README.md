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

## Stages (optional)

If the structure response has `stages`, the component shows which stage of a project each step belongs to. It holds
no stage name, question, colour choice per name or wording of its own: all of that arrives in the structure. A
structure without these fields draws and replays exactly as before and shows no legend.

| Structure field | What the component does with it |
|---|---|
| `stages` (ordered list of `{id, number, name, question, description}`) | The legend; a numbered badge on each node and in the Event panel and timeline; the bands. The number shown is the position in the list |
| `nodes[].stage` (a stage id) | Which stage the node belongs to. A missing or unknown id gives a neutral badge ("–"), and the legend lists the node under "No stage assigned" |
| `loop` (`{fit, choose}`, two stage ids) | The edges joining a node of one to a node of the other are emphasised, with a "round N" pill, once the run has visited the `fit` stage twice. N is the count of `fit`-stage steps up to the replay position, so Back lowers it and Reset clears it |
| `notes.general` | A plain-text note under the legend |
| `notes.stages` (stage id to text) | A note under that stage's legend entry and in the Event panel; for a stage with no node it is the reason shown with "Not a step in this agent" |
| `items` (display-only entries `{id, label, stage, before, summary}`) | A dashed, muted node joined by a dotted line to the node it sits `before`, with a "done beforehand" tag. It is never a step: never active, visited, counted or in the timeline. Selecting it (click, tap, Enter or Space) opens its summary in its own panel; its `summary.link` is a link only if `href` starts with `#` |

Colours: eight tokens `--gr-stage-1` to `--gr-stage-8` (with light and dark values, `--gr-stage-text` for the number and
`--gr-stage-none` for the neutral case) in `styles.ts`, keyed by stage number. A stage number above 8 is drawn neutral.
The number is the primary cue; colour never carries the meaning alone.

Selecting a stage in the legend dims the other stages' nodes and bands (the active node is never dimmed). The
selection is a viewing preference held apart from the playback buffer: Play, Pause, Step, Back, Reset and a new run
do not change it. All text from the structure is inserted as text, never as markup.

## Files

| File | Role | Candidate for the shared library |
|---|---|---|
| `graph-replay.ts` | the custom element | yes |
| `buffer.ts` | event buffer, paced playback, navigation (pure, unit-tested) | yes |
| `sse.ts` | `fetch()` + stream reader (never `EventSource`, which would reconnect and rerun the agent) | yes |
| `layout.ts` | dagre layout wrapper; also lays out items and computes the bands (`computeBands`) | yes |
| `styles.ts` | component styles, including the stage colour tokens | yes |
| `stages.ts` | stage types and pure helpers: resolve a node's stage, `roundAt`, `loopEdges` | yes |
| `bands.ts` | draws the stage bands (the bottom layer of the SVG) | yes |
| `legend.ts` | the legend, its live region and the item panel | yes |
| `svg.ts` | a small helper to build SVG elements | yes |

## Shared-library candidates elsewhere in this app

`backend/linreg/data_loading.py`, `season_split.py`, `evaluation.py`, `cricket_explanation.py`, `graph_api.py` (structure + stream endpoints). They are kept inside this app until the second app is built; `tests/test_boundaries.py` checks they import nothing app-specific.
