# Data Model: Simpler Pages

Only new or changed shapes are listed. Everything else (`RunState`, `final.accuracy`, `final.methods`, `explanation`) is as today. Field names are final unless the contract tests say otherwise.

## Backend

### `final.headlines` (new, built by `headlines.py` inside `final_test`)

| Field | Type | Meaning |
|---|---|---|
| `case` | `"beat" \| "edged" \| "held" \| "no_llm"` | the agent's own displayed test miss against the TV's and `MARGIN_RUNS`; `no_llm` when no language-model setup was fitted |
| `hero_h1` | string | the hero h1 for the case |
| `verdict_h2` | string | the verdict h2 for the case |
| `vs_search` | string \| null | agent-vs-search sentence; null for `no_llm` |
| `scoreboard` | object | see below |

`scoreboard`: `{subject_label, subject_miss, tv_miss, facts: [{id, text}]}`. `subject_label` is "AI agent" (or "Brute-force search" for `no_llm`); `facts` holds `tries` ("5 tries"), `no_made_up` ("0 numbers made up by the AI") and `gap` ("3.5 runs closer than the TV"), with `tries` and `no_made_up` absent for `no_llm`, and `gap` worded for the case (closer, "just short", "behind").

### `final.agent_verdict` (new)

Same shape as `final.verdict` (`reference_miss`, `winner_miss`, `improvement_runs`, `improvement_percent`, `beat`, `reached`, `winner`) but for the agent's own model (`winner: "llm"`). Null for `no_llm`. `final.verdict` and `final.verdict_sentence` keep describing the pick.

### `final.agent_model` (new)

`{source: "agent" | "search", features: string[], coefficients: {feature: number}, intercept: number}`. Refitted on every year before the test year; the same fit already used to score it. `source: "search"` when no language-model setup took part.

### `NODE_ROWS` and `ROW_DEFS` (new, `graph.py`)

`NODE_ROWS: {node_id: row_id}`; `ROW_DEFS: [{id, title}]` in display order (`start`, `round`, `yardstick`, `end`). Every graph node has exactly one row; `check_rows` enforces it.

### `/api/structure` additions

`nodes[].row` (the row id) and a top-level `rows: [{id, title, note}]`. The `round` note says "up to {ROUND_CAP} rounds; rejected ideas count", built from `state.ROUND_CAP`.

### `/api/models` addition

`run: {per_hour: number, deadline_seconds: number}`, from the settings the gate enforces.

### Recorded run file (`web/public/recorded-run.json`)

| Field | Type | Meaning |
|---|---|---|
| `recorded_on` | string (ISO date) | day it was recorded |
| `model_name` | string | the model's display name (never an id) |
| `fingerprint` | string | SHA-256 over `data/manifest.json` and the data files' sizes |
| `events` | array | the `step` events as `/api/run` streams them, `{step, node, summary, changes}`, in order |
| `done` | object | the closing `done` payload, `{steps}` |

A run that failed is never recorded (the script refuses a file without `final.headlines`).

## Front end

### `RunSource` (`run-source.ts`)

`{kind: "recorded" | "live", modelName, recordedOn?, events, state, finished}`. `state` is the accumulated state after all received events. Transitions: `recorded` to `live` when the live stream has received `final_test`; `live` back to `recorded` is never automatic except on a failed or refused live run (the recorded source is kept in the page throughout and restored). Reload resets to `recorded`.

### Detail level

`"simple" | "everything"`, held in `localStorage["linreg:view"]` (best effort), overridden by `?view=everything`, mirrored on `document.body.dataset.view`.

### Player state (`player-state.ts`)

Pure: from `{kind, playing, atEnd}` to the main button's label and action: "▶ Watch the recorded run" (idle recorded), "❚❚ Pause" (playing), "▶ Watch again" (recorded, finished), "▶ Watch your run again" (live, finished), and the toolbar label "Recorded {date} · {model}" or "Your live run · {model}".

### Round feed row (`round-feed.ts`)

From one entry of `state.rounds` and the attempts: `{round, idea, reason, score, status}` where `status` is one of `first_score`, `new_best`, `no_better`, `rejected`, `finished`. `reason` is the agent's quoted text, unchanged.

### Scoreboard card view (`scoreboard.ts`)

From `final.headlines` and `final.accuracy`: `{kicker, subject: {label, miss}, tv: {label, miss}, facts[]}`. Pass-through for words; layout and number formatting only.

### Old anchors (`anchors.ts`)

`{"#working": "#watch", "#found": "#verdict", "#final-test": "#verdict", "#try-your-own": "#try", "#data": "#scorebook:data"}`; the last also opens the data panel.
