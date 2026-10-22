# Data Model: Goal First

Everything here lives in the page (nothing is stored) except where a backend field is named.

## Run state (`web/src/page/run-state.ts`)

| Field | Type | Meaning |
|---|---|---|
| `phase` | `idle` \| `running` \| `finished` \| `failed` | where the reader's current run is |
| `current` | `Run` \| null | the run streaming now, or the one that just ended |
| `last` | `Run` \| null | the visit's last run that reached its final test; what every result shows |
| `message` | string \| null | a refusal or failure shown beside the player |
| `model` | string \| null | the display name of the model chosen for `current` |

`Run` = `{ events: StepEvent[], state: Record<string, unknown>, modelName: string, inProgress: string | null, stoppedAt: string | null }`.

### Transitions

```
idle ──press──▶ running ──final test──▶ (last = current; still running) ──done──▶ finished
   ▲               │  ▲                                                   │
   │               │  └───────── press (Run again) ◀───────────────────────┤
   │            refused ──▶ previous phase, message set                     │
   │               │                                                        │
   │            error / lost connection ──▶ failed (message = reason, current.stoppedAt = running node)
   └──────────────── reload ─ nothing kept ───────────────────────────────┘
```

- `press` from `finished` or `failed` starts a new `current`; `last` is not touched.
- A run that fails before the final test never becomes `last`; one that fails after it (during the explanation steps) keeps its results (`last` already holds it) and shows the failure message.
- "Watch it again" replays `last` (or `current` when finished) through the graph and changes no phase.

### Derived values

| Name | Rule |
|---|---|
| `button` | idle: `▶ Play`; running: `Running…` (disabled); finished: `▶ Run again` + `Watch it again`; failed: `▶ Play` (no `last`) or `▶ Run again` + `Watch it again` (a `last`) |
| `selectDisabled` | phase is `running` |
| `locks.verdict`, `locks.tryit`, `locks.scorebookRun` | `unlocked` when `last` is set; otherwise `locked` with the variant `before` (idle), `during` (running), `failed` (failed) |
| `status` (shown) | idle: "Ready. Choose the AI and press play."; running: "Live with {model} · {doing}"; finished: "Finished with {model} · {tries} tries · best {score} on the check seasons" (no agent: "Finished with the brute-force search alone · best {score} on the check seasons"); failed: "Stopped: {reason}" |
| `announce` (spoken) | a short sentence on phase changes and on AI-step/code-step changes only; not derived from every node |
| `rightNow` | step = `current.inProgress ?? last event's node`, doing = `structure.doing[node]`, round = from `rounds_used` ("2 of up to 6" or "—"), best = `llm_best.validation_mae`; stopped: "Stopped: {reason}" |
| `resultStrip` | present when `last.state.final.headlines.result_strip` exists |

## Node state (graph component)

| State | When |
|---|---|
| `idle` | not reached |
| `running` | started, no `step` yet (ringed, 3 px accent) |
| `done` | a `step` received (green) |
| `error` | the run stopped while it was running |

Exactly one node is `running` while a run streams (none for the instant between a `step` and the next `start`). Replaying a finished run: the node of the step shown is `running` until the last step, then none.

## Lock

`{ id: "verdict" | "tryit" | "scorebook-models" | "scorebook-graph", state: "locked" | "unlocked", variant: "before" | "during" | "failed", reason?: string }`. The wording per variant is in [contracts/page-contract.md](contracts/page-contract.md).

## Backend additions

| Field | Where | Shape |
|---|---|---|
| `start` event | `/api/run` stream | `{ "step": n, "node": "propose_features" }`, sent when the node begins |
| `doing` | `/api/structure` | `{ node_id: "Code fits the regression", … }`, one line per node of the graph |
| `goal_card` | `/api/reference` | `{ kicker, sentence, tv: { miss, label }, target: { runs, label }, judged }` |
| `test` | `/api/reference` | `{ year, innings }` (counts only) |
| `result_strip` | `final.headlines` | `{ label, text }` |
