# `<graph-replay>`

A framework-free web component that draws any agent graph, in rows, and replays a run of it. It knows nothing about the app: it is driven only by a structure and a stream of events (or a run saved earlier).

```html
<graph-replay structure-url="/api/structure" run-url="/api/run"></graph-replay>
<script type="module" src="./graph-replay/graph-replay.ts"></script>
```

## Attributes

| Attribute | Meaning |
|---|---|
| `structure-url` | `GET` returns the graph structure (see `contracts/structure.schema.json`) |
| `run-url` | optional. `GET` returns Server-Sent Events: `step`, then `done` (or `error`). With it the component has its own Play button; without it a host page supplies the run (see Methods) |
| `interval-ms` | optional starting pace in ms per step (default 1500) |
| `view="structure"` | optional. Draws only the rows and the legend, with no run controls, status, path or panels (for a page that explains the graph) |
| `data-theme` | optional `light` or `dark` to override the system theme |

## Methods (for a host page that has its own buttons)

`loadRun(events)` replaces what is shown with a saved run (nothing is fetched, no run is started); `play()`, `pause()`, `restart()` (back to the first step, playing) and `showEnd()` (the finished run at once, no playback); `startLive(url)` streams a new run from `url`; `events` (every step received so far), `isReady` (the rows are drawn) and `isPlaying`.

## Events it emits

`refused` when a start is refused, `structureready` once the rows are drawn, and `replaychange` (bubbles, composed) on every change. `detail`: `{ cursor, steps, finished, atEnd, playing, state, finalState, receivedState, run, failed }`, where `run` goes up by one each time a new run starts or is loaded, `failed` is true when the stream ended with an error event or the connection was lost before the run finished, `state` is the accumulated state at the step on display, `finalState` is the state after the last step once the stream has finished, and `receivedState` is the state of every step received so far, shown yet or not. Host pages use this to show their own results; the component never interprets the state.

## Rows

The structure's `rows` (an ordered list of `{id, title, note}`) and each node's `row` decide the drawing: one light card per row with its title and note, and a pill for each step in the order a run first reaches it (`rows.ts`; `rows-view.ts` draws it). A conditional edge that goes back to an earlier step of the same row is written out under the row ("↺ rejected · continue → back to propose_features"). A step with no row, or one the structure does not list, goes in a last untitled row; a structure with no rows draws every step in one list. The rows are plain HTML, so they wrap on a phone and can be drawn while hidden. No row title, note or step name is held here.

## Behaviour

Pause/Resume, Back, Step, Reset (back to before the first step when the host supplies the run), a speed control, a clickable "Path taken" list of the steps reached (closed until asked for), and ← / → keys. Fetching is separate from display: events are buffered and shown at the chosen pace, and Back, jumping and the path replay from the buffer without rerunning the agent. A step with `actor: "llm"` is drawn with a dashed outline and an "AI" tag, and its event is marked in the Event panel; `actor` is optional and means nothing beyond styling. The step the replay has reached has a 3 px ring and a visited step shows a tick with its visit count. If the server refuses a start (a non-2xx response with a JSON `message`), the message is shown, earlier results stay visible, and a `refused` event is emitted.

## The state panel

The Event panel names the step, who did it, its stage and its summary. "Show every value" opens each state value as formatted JSON, except that an array longer than 20 items is shown as "N items" (`state-view.ts`). The panel knows nothing about what the values are.

## Stages (optional)

If the structure response has `stages`, the component shows which stage of a project each step belongs to. It holds no stage name, question, colour choice per name or wording of its own: all of that arrives in the structure. A structure without these fields draws and replays exactly as before, with no legend and no badges.

| Structure field | What the component does with it |
|---|---|
| `stages` (ordered list of `{id, number, name, question, description}`) | The legend; a numbered badge on each step and in the Event panel and path; the number shown is the position in the list |
| `nodes[].stage` (a stage id) | Which stage the step belongs to. A missing or unknown id gives a neutral badge ("–"), and the legend lists the step under "No stage assigned" |
| `loop` (`{fit, choose}`, two stage ids) | The row that holds the `fit` stage shows a "round N" pill once the run has visited that stage twice |
| `notes.general` | A plain-text note under the legend (not shown with `view="structure"`) |
| `notes.stages` (stage id to text) | A note under that stage's legend entry and, behind "About this stage", in the Event panel; for a stage with no step it is the reason shown with "Not a step in this agent" |
| `items` (display-only entries `{id, label, stage, before, summary}`) | A dashed, muted pill in the row of the step it comes before, with a "done beforehand" tag and its stage badge. It is never a step: never active, visited, counted or in the path. Selecting it opens its summary in its own panel; its `summary.link` is a link only if `href` starts with `#` |

Colours: eight tokens `--gr-stage-1` to `--gr-stage-8` (with light and dark values, `--gr-stage-text` for the number and `--gr-stage-none` for the neutral case) in `styles.ts`, keyed by stage number. A stage number above 8 is drawn neutral. The number is the primary cue; colour never carries the meaning alone. Selecting a stage in the legend dims the other stages' steps (the active step is never dimmed) and moves the replay to the first step the run has reached in that stage (pausing it), so the Event and Graph state panels show that step; if the step on display is already in the stage, or no step in it has been reached yet, the replay stays where it is, and clearing the selection moves nothing. Which stage is highlighted is a viewing preference held apart from the playback buffer, and a redraw that puts the selection back does not move the replay. All text from the structure is inserted as text, never as markup. On a phone every control is at least 44 px tall.

## Files

| File | Role | Candidate for the shared library |
|---|---|---|
| `graph-replay.ts` | the custom element | yes |
| `structure.ts` | the structure's types | yes |
| `rows.ts` | pure: groups the steps into the structure's rows, in the order a run reaches them | yes |
| `rows-view.ts` | draws the rows: pills, stage badges, the AI tag, items | yes |
| `buffer.ts` | event buffer, paced playback, navigation, `foldState` (pure, unit-tested) | yes |
| `sse.ts` | `fetch()` + stream reader (never `EventSource`, which would reconnect and rerun the agent) | yes |
| `styles.ts` | component styles, including the stage colour tokens | yes |
| `stages.ts` | stage types and pure helpers: resolve a step's stage, `roundAt`, `visitTick` | yes |
| `legend.ts` | the legend, its live region and the item panel | yes |
| `state-view.ts` | how a state value is shown | yes |

`web/tests/unit/graph-replay-generic.test.ts` fails if a cricket or regression word is written into any of these files.
