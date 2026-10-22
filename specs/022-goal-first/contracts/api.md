# Contract: API changes

Only additions; no existing field, event or route changes meaning.

## `GET /api/run` (server-sent events)

Events, in the order a run sends them:

```
event: start   data: {"step": 5, "node": "propose_features"}      # new: the node begins
event: step    data: {"step": 5, "node": "propose_features", "summary": "...", "changes": {...}}   # unchanged: the node completed
event: done    data: {"steps": 24}                                 # unchanged
event: error   data: {"message": "The run failed: ..."}            # unchanged
```

Rules:
- One `start` per node run, always before that node's `step`; `step` numbers are the same as before, and a `start` carries the number its `step` will have.
- `start` carries no state and no summary (the node has not produced any yet).
- A node that fails sends its `start`, then the stream ends with `error` (no `step` for it).
- `graph_api` names no node: any compiled LangGraph app gets `start` events.
- With no `model` query parameter, the run uses the owner's default model (unchanged; now covered by a test).
- A refusal is still a JSON body with a status, before any event.

## `GET /api/structure`

New top-level field next to `rows`:

```json
"doing": {
  "load_data": "Code is loading the innings",
  "propose_features": "The AI agent is choosing its clues",
  "final_test": "Unlocking 2026 and scoring once"
}
```

One non-empty line for every node (a test fails if one is missing), worded from the term list, no banned name. The year in the `final_test` line is the data's test year, read from the rolling checks; with no year it says "the test season".

## `GET /api/reference`

New fields (also on the failure path, reduced):

```json
"goal_card": {
  "kicker": "THE GOAL",
  "sentence": "Beat the TV's projection by at least 3 runs on average.",
  "tv": { "miss": 22.5, "label": "runs: how far out the TV usually is, on past innings (2005–2022)" },
  "target": { "runs": "3+", "label": "runs closer: what the agent must do" },
  "judged": "Judged on 214 innings from 2026, a season the agent never sees while it works."
},
"test": { "year": 2026, "innings": 214 }
```

On the failure path `goal_card` has only `kicker` and `sentence`, and `test` is null; the page then shows no figures.

## `final.headlines` (inside the `final_test` step's state)

New `result_strip`:

```json
"result_strip": { "label": "goal reached", "text": "The agent was 17.9 runs out, the TV 21.4." }
```

`label` is one of "goal reached", "short of the goal", "goal missed", "search only" (no language model), chosen by the same case and one-decimal misses as `hero_h1`; the page writes "Result: {label}." then `text`.

## Removed

`/recorded-run.json` (a static file) is gone; the `vercel.json` header for it is removed.
