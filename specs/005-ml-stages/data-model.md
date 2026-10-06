# Data Model: Machine Learning Stages on Every Step

Nothing is stored. These are the shapes sent in `GET /api/structure` and the values the page derives from them. Field-level wire detail is in `contracts/structure.md`.

## Stage (shared, defined once in `backend/linreg/stages.py`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `frame`, `prepare`, `understand`, `split`, `fit`, `choose`, `assess`, `interpret` |
| `number` | integer 1 to 8 | the position in the set; shown on badges; keys the colour tokens |
| `name` | string | for example "Fit the model" |
| `question` | string | the question the stage answers |
| `description` | string | one plain sentence |

Rules: the set is fixed, ordered, and the same for every app; `number` equals position; ids and numbers are unique. Two more constants: `FIT_STAGE = "fit"` and `CHOOSE_STAGE = "choose"`, sent as `loop`.

## Node stage (per app, `NODE_STAGES` in `graph.py`)

A mapping `node id → stage id`, passed through `node_meta` so each node in the response has `stage`. Rules: every node except `__start__` and `__end__` has exactly one stage id that is in the set; every key is a node (checked by `check_stages`).

| Node | Stage |
|---|---|
| `baseline` | `frame` |
| `load_data` | `prepare` |
| `explore` | `understand` |
| `split` | `split` |
| `fit_model` | `fit` |
| `propose_features`, `check_proposal`, `evaluate`, `forward_selection` | `choose` |
| `final_test` | `assess` |
| `explain_in_cricket_terms` | `interpret` |

## Stage resolution on the page (derived)

For each node, the page resolves one of: **assigned** (a known stage: number, name, colour token) or **unassigned** (no `stage`, or an id not in `stages`: neutral badge showing "–", flagged in the legend). `__start__` and `__end__` are neither: they carry no badge.

## Notes (optional, per app)

| Field | Type | Notes |
|---|---|---|
| `general` | string | shown under the legend |
| `stages` | object `stage id → string` | shown with that stage; for a stage with no node it is the reason ("Not a step in this agent") |

Plain text only. This app's `general` note holds the training, validation and test years from the loaded data; its `stages.choose` note is the feature-selection-only statement.

## Done-beforehand item (optional list, per app)

| Field | Type | Notes |
|---|---|---|
| `id` | string | unique among items; the page's graph id is `item:<id>` |
| `label` | string | shown on the node, for example "data preparation script" |
| `stage` | stage id | `prepare` here |
| `before` | node id | the node it is joined to, `load_data` here |
| `summary.text` | string, optional | a sentence or two |
| `summary.rows` | list of `{label, value}`, optional | exclusion counts with reasons, and the columns created |
| `summary.link` | `{label, href}`, optional | `href` is only used if it starts with `#` |

Rules: an item is never a step; it has no run state; it is absent from the replay buffer, the step count and the timeline.

## Loop (derived on the page)

| Value | Definition |
|---|---|
| loop edges | graph edges joining a node of stage `loop.fit` and a node of stage `loop.choose`, either direction |
| round | the number of events up to the current cursor whose node is in stage `loop.fit` |
| emphasised | round is 2 or more; loop edges are then drawn heavier with a "round N" pill; before that they look like any edge |

The round is recomputed from the buffer position every update, so it has no state of its own.

## Band (derived in layout)

| Field | Notes |
|---|---|
| `stage` | stage id |
| `nodes` | node ids in the band (a run of neighbours in one stage) |
| `x, y, w, h` | padded bounding box; never encloses a node of another stage or an unassigned node; may surround `__start__` or `__end__`, which are not steps |

A stage can have several bands. Items take part like nodes.

## Legend selection (view preference)

One value on the component: a stage number or none ("All"). Not part of the replay buffer; not changed by Play, Pause, Step, Back, Reset, a new run or a refusal.

## Selected item (view preference)

One value on the component: an item id or none. Opens the item panel; closed by its Close button or by selecting the item again. Not part of the replay buffer.
