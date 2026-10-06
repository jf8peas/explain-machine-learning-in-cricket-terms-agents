# Contract: `GET /api/structure` (extended)

Builds on `specs/001-linear-regression-agent/contracts/structure.schema.json` and `specs/004-llm-feature-selection/contracts/api.md`. Every new field is **optional**, so a structure without them (an older app, or a test fixture) draws and replays exactly as before and shows no legend.

## Response

```json
{
  "nodes": [
    { "id": "__start__", "kind": "start" },
    { "id": "load_data", "kind": "node", "actor": "code", "stage": "prepare" },
    { "id": "propose_features", "kind": "node", "actor": "llm", "stage": "choose" },
    { "id": "fit_model", "kind": "node", "actor": "code", "stage": "fit" }
  ],
  "edges": [ { "source": "check_proposal", "target": "fit_model", "conditional": true, "branch": "fit" } ],

  "stages": [
    { "id": "prepare", "number": 1, "name": "Prepare the data",
      "question": "Is the data clean and in a usable form?",
      "description": "Clean the data and turn what was recorded into measurements a model can use." }
  ],
  "loop": { "fit": "fit", "choose": "choose" },
  "notes": {
    "general": "Every time the agent tries a new setup (stage 5) it fits the model again (stage 6) …",
    "stages": { "choose": "In this app, Choose the setup means feature selection only. …" }
  },
  "items": [
    { "id": "prepare_data", "label": "data preparation script", "stage": "prepare", "before": "load_data",
      "summary": {
        "text": "Done once, before the agent runs, by scripts/prepare_data.py.",
        "rows": [ { "label": "Excluded: no result", "value": "97" }, { "label": "Columns created", "value": "16 features and 2 competition columns" } ],
        "link": { "label": "See the Data tab", "href": "#data" } } }
  ]
}
```

(`stages` shows one of the eight for brevity; the response always carries all eight, in order.)

## Field rules

| Field | Rule |
|---|---|
| `nodes[].stage` | optional; a stage `id` from `stages`. A missing or unknown value makes the node unassigned (neutral badge, flagged in the legend). `start` and `end` nodes carry none |
| `stages` | ordered list; `number` is the 1-based position; with no `stages` the page draws no legend, badges or bands |
| `loop` | optional; `fit` and `choose` are stage ids; with no `loop` there is no loop emphasis |
| `notes.general` | optional plain text, shown under the legend |
| `notes.stages` | optional map from stage id to plain text; for a stage with no node it is the reason shown with "Not a step in this agent" |
| `items[]` | optional display-only entries; never in the replay, the step count or the timeline |
| `items[].before` | a node id; the item is joined to it by a dotted connector |
| `items[].summary.link.href` | used as a link only if it starts with `#`; otherwise shown as text |

All text is plain text. The page inserts it with `textContent`; none of it is interpreted as markup.

## Server rules

- `stages`, `loop`, `notes` and `items` are produced by `structure_extras`, a function given to `create_router`; `graph_api.py` merges its result and knows nothing of what is in it.
- `stages` and `loop` come from `backend/linreg/stages.py` (the same for every app); `notes` and `items` come from `backend/linreg/stage_info.py` (this app).
- The years in `notes.general` come from `split_three_ways` on the loaded data. If the data cannot be loaded, `notes.general` is sent without the years sentence.
- The item's rows come from `data/manifest.json` and the feature catalogue, using the same exclusion helper as the Data tab. If the manifest cannot be read the item is still sent with `summary.text` "Details could not be loaded." and the link.
- The extras are computed on first use and cached for the life of the process; a failed attempt is not cached.

## Schema change

`specs/001-linear-regression-agent/contracts/structure.schema.json` has `additionalProperties: false` at the top level and on nodes, so it is updated to allow the five new fields and `nodes[].stage`, each optional.

## What does not change

`GET /api/run` and its step events, `/api/data`, `/api/catalogue`, `/api/models`, the leaderboard and the results.

## Changes made while building

- The timeline's stage cue is a number drawn by CSS from `data-stage-number` on the timeline button (with `data-stage` and the stage in the `aria-label`), not an element with its own test id, so the button's text stays "3. explore" and existing tests keep passing.
- `notes.general` is sent without any year (the rest of the text is unchanged) if the data cannot be read.
- Steps with no stage, or an unknown stage, are listed in the legend under "No stage assigned: ..." (FR-003).
- `GET /api/structure` is built from `stage_info.structure_extras()` on first use and kept for the life of the process; a failure is not kept.
