# Research: Machine Learning Stages on Every Step

Date: 2026-10-06. Contrast and colour-difference numbers were computed on this date with a small script (WCAG 2.x contrast ratio; CIEDE2000 colour difference) against the visualiser's real tokens in `web/src/graph-replay/styles.ts`. No new dependency is needed for any decision here.

## Decision 1: The stage ids and descriptions

Eight stages, ids in this order (the number is the position). The order is the order a run first reaches each stage, which the owner chose on 2026-10-06 after seeing the first order (frame, prepare, understand, split, fit, choose, final, interpret) give badges that ran 2, 4, 3, 1 along the graph:

| # | id | Name | One-sentence description |
|---|---|---|---|
| 1 | `prepare` | Prepare the data | Clean the data and turn what was recorded into measurements a model can use. |
| 2 | `split` | Split the data | Set aside data to learn from, data to choose with, and data to mark the final answer on. |
| 3 | `understand` | Understand the data | Look for patterns in the data before fitting anything. |
| 4 | `frame` | Frame the problem | Say what we are predicting and what counts as a good answer, so we know the score to beat. |
| 5 | `choose` | Choose the setup | Decide which features, model type and hyperparameters to use, judged on data the fit never saw. |
| 6 | `fit` | Fit the model | For one chosen setup, find the parameters that fit the learning data best. |
| 7 | `assess` | Final assessment | Score the chosen model once, on data it has never seen. |
| 8 | `interpret` | Interpret and communicate | Explain in plain words what the result means. |

The questions are the ones in the spec. The descriptions are generic on purpose: the same set is used by all eight algorithm apps, so they mention no sport and no algorithm. The ids are short words, stable, and used in the structure response; the visualiser never interprets them. It uses only the order and the numbers.

**Alternative considered**: numbers only as ids. Rejected: ids are easier to read in tests and in the response, and the number is derived from position so it cannot disagree with the order.

## Decision 2: Where the set lives and how it reaches the page

A new backend module `backend/linreg/stages.py` (a shared-library candidate, no cricket or regression words) holds the tuple of stages, the two loop stage ids (`FIT_STAGE = "fit"`, `CHOOSE_STAGE = "choose"`), `stage_set()` (JSON-ready), and `check_stages` (Decision 5). `graph_api.py` stays generic: `create_router` gets one new optional argument, `structure_extras`, a function returning extra top-level fields, and merges them into the structure response. The page reads `stages`, `loop`, `notes` and `items` from `/api/structure` only; `<graph-replay>` holds no stage name, question or description.

**Alternative considered**: a second endpoint `/api/stages`. Rejected: the brief fixes the structure response, and a second request would let the stage set and the node assignments disagree.

## Decision 3: Stage per node, and the generic check

`NODE_STAGES` in `graph.py` beside `NODE_ACTORS`, passed through the existing `node_meta` so each node carries `"stage"` next to `"actor"`:

| Stage | Nodes |
|---|---|
| `prepare` | `load_data` (and the display-only done-beforehand item) |
| `split` | `split` |
| `understand` | `explore` |
| `frame` | `baseline` |
| `choose` | `propose_features`, `check_proposal`, `evaluate`, `forward_selection` |
| `fit` | `fit_model` |
| `assess` | `final_test` |
| `interpret` | `explain_in_cricket_terms` |

All 11 nodes of the compiled graph are covered, so no node needed an extra assignment (FR-004). `check_stages(app, mapping, stages=STAGES)` takes a compiled graph and a node-to-stage mapping, ignores the `__start__` and `__end__` nodes, and raises `StageError` listing every problem: a node with no stage, a stage id that is not in the set, and (a small addition to the brief) a mapping key that is not a node, which would otherwise hide a typo. A pytest test for this app calls it, and other apps call the same function.

## Decision 4: How a node shows its stage (colour and cue)

The node's fill and border already carry the run state and the language-model marking, so they do not change. The stage is a **numbered badge**, a small filled circle with the stage number, on the node's **bottom-left corner**. The other corners are taken: the visit count sits top-left, and the tick and the "LLM" tag sit top-right. The badge uses the stage colour for its fill and a fixed text colour for the number. The group band (Decision 6) uses the same colour for its outline and tint and shows the number and name in the page's text colour. A node with no stage, or an unknown stage id, gets a neutral badge (no number, a dash) and the legend flags it as unassigned.

## Decision 5: The eight colours, and the contrast check

Eight tokens `--gr-stage-1` to `--gr-stage-8` (keyed by number, so they stayed with their numbers when the stage order changed), each with a light and a dark value, plus `--gr-stage-text` (the number colour: white in light, the dark page colour in dark). They sit in the existing token block of `styles.ts`, keyed by stage number. A stage number above 8 (another app with more stages) falls back to the neutral token.

Rules I checked, per theme:

- The number text on the badge fill has at least **4.5:1** contrast (text).
- The badge fill against the page background and against the panel background has at least **3:1** (non-text contrast).
- The colour differs from the three existing semantic colours (visited green, language-model purple, error red) by a CIEDE2000 colour difference (ΔE) of at least **15**, and from the accent blue (active node) and the changed amber by at least **10**, and from the neutral grey by at least **15**. A ΔE under about 10 looks alike at a glance.
- The colour never carries the meaning alone: the number badge is the primary cue.

I first let a search pick the most spread-out colours that met the rules. It chose garish extremes (near-black maroon, near-black navy), so I picked by hand and checked. The slate-blue I first chose for stage 4 was within ΔE 6 of the neutral grey, so it became a plum.

**Light theme** (page `#ffffff`, panel `#f6f7f9`; number text `#ffffff`):

| # | Stage | Colour | Text | vs page | vs panel | ΔE green | purple | red | accent | amber | neutral |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | prepare | `#8a5a00` | 5.9 | 5.9 | 5.5 | 37 | 55 | 26 | 53 | 21 | 33 |
| 2 | split | `#5f7a00` | 4.9 | 4.9 | 4.6 | 18 | 75 | 52 | 63 | 27 | 38 |
| 3 | understand | `#00798a` | 5.1 | 5.1 | 4.8 | 26 | 30 | 60 | 23 | 46 | 18 |
| 4 | frame | `#8a4f7d` | 6.0 | 6.0 | 5.6 | 58 | 16 | 28 | 29 | 53 | 22 |
| 5 | choose | `#bb5400` | 4.8 | 4.8 | 4.5 | 49 | 49 | 16 | 50 | 23 | 36 |
| 6 | fit | `#a3246b` | 6.9 | 6.9 | 6.5 | 69 | 20 | 25 | 36 | 58 | 29 |
| 7 | assess | `#00695c` | 6.6 | 6.6 | 6.2 | 17 | 39 | 54 | 35 | 44 | 23 |
| 8 | interpret | `#7a5c46` | 6.1 | 6.1 | 5.7 | 34 | 39 | 20 | 39 | 28 | 23 |

**Dark theme** (page `#12161d`, panel `#1b212b`; number text `#12161d`):

| # | Stage | Colour | Text | vs page | vs panel | ΔE green | purple | red | accent | amber | neutral |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | prepare | `#b8863f` | 5.6 | 5.6 | 5.0 | 36 | 49 | 27 | 48 | 15 | 32 |
| 2 | split | `#b5cf4a` | 10.4 | 10.4 | 9.2 | 20 | 70 | 52 | 62 | 20 | 40 |
| 3 | understand | `#4fd0e0` | 9.9 | 9.9 | 8.8 | 25 | 35 | 64 | 24 | 43 | 22 |
| 4 | frame | `#cf9bc2` | 7.9 | 7.9 | 7.0 | 55 | 15 | 22 | 30 | 47 | 21 |
| 5 | choose | `#ff9a3c` | 8.6 | 8.6 | 7.7 | 46 | 49 | 22 | 50 | 16 | 36 |
| 6 | fit | `#f06ab0` | 6.4 | 6.4 | 5.7 | 72 | 20 | 21 | 39 | 56 | 28 |
| 7 | assess | `#3fd0c8` | 9.6 | 9.6 | 8.5 | 16 | 39 | 55 | 30 | 40 | 24 |
| 8 | interpret | `#d8b59a` | 9.5 | 9.5 | 8.5 | 33 | 37 | 19 | 37 | 18 | 24 |

Existing tokens compared against (light / dark): visited green `#3f8f5f` / `#5fbf86`, language-model purple `#7a3fc0` / `#b794f4`, error red `#b3261e` / `#ff8a80`, accent blue `#1d6fe0` / `#6ea8ff`, changed amber `#c58f00` / `#e0b030`, neutral grey (muted text) `#5b6678` / `#98a3b5`.

**Results**: every row passes all the rules (the smallest ΔE to the three named colours is 15, stage 4 dark against purple; to the accent blue, 23; to the changed amber, 15 at the lowest, stage 1 dark; to the neutral grey, 18 at the lowest, stage 3 light). ****Known near misses**, accepted because the number badge is the primary cue: numbers 4 and 6 (Frame the problem and Fit the model) are only ΔE 10 apart in the light theme (plum and raspberry), and numbers 3 and 7 (Understand the data and Final assessment) are ΔE 9 apart in the dark theme (cyan and teal). With 8 colours that must also avoid green, purple, red, blue and amber, some pairs have to be close. SC-003's automated check covers what can be computed: the eight numbers differ and the eight colours differ; the "colour removed" check is a manual look.

Band labels use the page text colour on a tint of the stage colour at low opacity, so label contrast is the text colour's, not the stage colour's.

## Decision 6: Group bands

Bands are computed from node positions after layout, in `layout.ts`, as a pure function `computeBands(nodes, stageOf)`:

1. Order the nodes that have a stage along the main direction (top to bottom, then left to right). Unassigned nodes, `__start__` and `__end__` are not in this order, so they do not break a run.
2. Walk the order and start a new group whenever the stage changes, so a group is a run of neighbours in one stage.
3. Take each group's bounding box, padded. If the box would enclose any node that is not in the group and is either a node of another stage (a done-beforehand item counts as a node of its stage) or an unassigned node, split the group in two at the largest gap along the order and test again, until no box encloses such a node. `__start__` and `__end__` are not steps and are exempt, so a band may surround them. This matters for the done-beforehand item, which sits on the same rank as `__start__` just above `load_data`: if the start marker lands between the item and `load_data`, they must still share one band.
4. Each band records its stage, its nodes and its box.

For this app the order along the main direction gives: done-beforehand item and `load_data` (prepare), `split`, `explore`, `baseline`, then `propose_features` and `check_proposal` (choose), `fit_model` (fit), `evaluate` and `forward_selection` (choose), `final_test`, `explain_in_cricket_terms`. So Choose the setup gets two bands with Fit the model between them (FR-006), without the enclose test having to fire. The test still covers a layout where it does.

Bands are drawn first in the SVG (the bottom layer), so they never hide an edge or a node. The label (number badge and name) sits inside the band at its top-left. `ranksep` grows from 46 to 58 so a band's label never touches the node above; the existing layout unit tests check shape, not exact positions, so they keep passing.

**Alternative considered**: bands as dagre clusters (compound nodes). Rejected: a stage that is split by another stage cannot be a single cluster, and clusters change the layout of every graph.

## Decision 7: The legend, and how selection is kept

The legend is built inside `<graph-replay>` by a new module `legend.ts` from the structure's `stages`. Every stage name, question, description, note and reason is set with `textContent`, like all other server text. Each stage is a real `<button aria-pressed>` showing the badge, name and question; an "All" button clears the filter. A visually hidden polite live region announces the choice ("Highlighting stage 6, Fit the model. Other steps are dimmed." and "Highlight cleared."). Focus is visible with the existing focus ring. The existing global ← and → keys still step the replay; the legend needs no other keys.

The selected stage is one field on the component, **separate from the playback buffer** (`ReplayBuffer` is untouched). Play, Pause, Step, Back, Reset and a new run never read or write it; only the legend buttons do, so it persists as the spec requires.

Dimming is a data attribute on the graph element (`data-filter="5"`) and CSS: nodes and bands whose stage number differs get reduced opacity, except the active node, which is never dimmed. No animation or transition. Edges are not dimmed (the spec says the other stages' nodes and bands are dimmed). Dimmed nodes keep their text legible at reduced opacity (inactive elements are exempt from the contrast rules).

**Narrow screens** (below the existing 760 px breakpoint): the legend becomes a wrapping row of numbered chips above the graph, each chip a button; the selected chip's name and question appear in a detail line under the row. The same buttons, restyled by CSS, so keyboard and screen-reader behaviour is identical.

**Placement on wide screens**: a first panel in the right-hand column, above the Event panel, with the general note under it. The graph keeps its column. I judged this the least disruptive place; it is easy to move if it looks wrong in the first look.

## Decision 8: App-supplied notes

The structure response may carry `notes`: `{ "general": "<text>", "stages": { "<stage id>": "<text>" } }`, plain text only, inserted with `textContent`. The visualiser shows the general note under the legend, and a stage's note under that stage's legend entry (in the detail line on narrow screens) and in the detail panel when a step of that stage is current. For a stage with no node, the stage's note is the reason, and the legend marks it "Not a step in this agent".

For this app the backend supplies:

- `stages.choose`: "In this app, Choose the setup means feature selection only. Plain linear regression has no hyperparameters to tune; hyperparameter tuning appears in later apps." (FR-021)
- `general`: "Every time the agent tries a new setup (stage 5) it fits the model again (stage 6), so the two stages form a loop. Parameters are learned from the training years ({first} to {last}). The setup is chosen using the validation year ({validation}). The test year ({test}) is used once, at the end." (FR-020)
- a reason for any stage with no node: none today, because all eight stages have a node. A pytest test makes sure every stage without a node has a reason, so the case works as soon as an app has one.

The years come from `split_three_ways` on the loaded data (the same call the agent and the Data tab use), computed once per process and cached. If the data cannot be loaded, the general note is sent without the years sentence, never with invented years.

## Decision 9: Loop emphasis

Generic, from the structure's `loop: { fit, choose }` (stage ids). The emphasised edges are those joining a node in the `fit` stage to a node in the `choose` stage, in either direction (here: `check_proposal` to `fit_model` and `fit_model` to `evaluate`; the `evaluate` to `propose_features` edge joins two Choose steps, so it is not one). The round number is the count of events, up to the current replay position, whose node is in the `fit` stage. Both come from the buffer's current position, so Back lowers the count, jumping recomputes it, and Reset clears it.

Per Clarifications: before the count reaches 2 the edges look like any others; from 2 they are drawn emphasised (heavier stroke plus a "↻ round N" pill beside the edge, so it is not colour alone) with N shown. Static styling, no animation. The count is a pure function (`roundAt(events, cursor, stageOf, fitStage)`) so Vitest covers it at several positions.

## Decision 10: The done-beforehand item

The structure response may carry `items`: display-only entries `{ id, label, stage, before, summary }`. `summary` is `{ text?, rows?: [{label, value}], link?: {label, href} }`. The visualiser lays an item out as a node (id prefixed `item:` so it cannot clash with a graph node) joined to its `before` node by a dotted connector, drawn dashed and muted with a "done beforehand" tag and its stage badge. It joins the stage bands like any node of its stage. It is never part of the playback buffer, never gets an active, visited or count state, is never a timeline entry, and the step count ignores it.

It is a button: tabbable, opens by Enter, Space or a click or tap, with a `Close` button. Its summary opens in a small **separate panel** in the side column, above the Event panel, not in the Event panel itself, because a running replay rewrites the Event panel at every step and would close the summary under the visitor's eyes. Opening or closing it never touches playback. The link is rendered only if its `href` starts with `#` (a same-page link such as `#data`); anything else is shown as plain text, so a response can never inject a navigation to another site.

The backend builds the summary in `backend/linreg/stage_info.py` from `data/manifest.json` and the feature catalogue: the exclusion counts with their reasons, and the columns the script created (the measured features, the derived features, and the two competition columns, counted from the catalogue and `competition_dummies.py`). The exclusion aggregation moves out of `data_table._summary` into one small public helper (`exclusion_rows(manifest)`) that both the Data tab and this summary call, so the two can never disagree; the Data tab's output does not change. If the manifest cannot be read, the item is still sent, with a "details could not be loaded" text and the `#data` link.

## Decision 11: Detail panel and timeline

The Event panel gets a stage line under the step name and actor pill: the badge, the name and the question, with the stage's note if the app supplied one. Each timeline entry gets the badge before its text. All existing `data-testid` values stay (`timeline-item`, `event-node`, `event-actor`, `event-summary` and the rest); new ones are added for the stage elements (listed in the plan).

## Decision 12: Module layout

`graph-replay.ts` is 431 lines and grows if it takes all this, so the new code goes in the same folder as small modules, and `graph-replay.ts` only wires them:

| Module | Contents |
|---|---|
| `stages.ts` | types for `stages`, `loop`, `notes`, `items`; resolve a node's stage (known, unknown or none); `roundAt`; `loopEdges`; pure |
| `layout.ts` | adds `stage` to nodes, items as nodes, `computeBands` (pure), larger `ranksep` |
| `bands.ts` | draws the bands as the bottom SVG layer |
| `legend.ts` | builds the legend, the note, the live region and the item panel; reports the selected stage |
| `styles.ts` | the eight stage tokens (light and dark), badge, band, legend, dim and loop styles |

No node function, step event, leaderboard or result changes.

## Decision 13: Reuse proof

`web/tests/fixtures/other-structure.json` is extended with its own `stages` (a different, smaller set with different names), a `stage` on each node, a `loop`, a note, and one item. The existing `reuse.spec.ts` is extended to show the legend, badges, bands, highlight, loop emphasis and item for it with no visualiser change. A Vitest test and an e2e case (the fixture served with one node's stage removed) cover the unassigned node: neutral badge, flagged in the legend. A pytest boundary test checks that no stage name appears in the visualiser's source.

## Decision 14: Caching

`/api/structure` now depends on committed data, so its extras are computed on first use and cached for the life of the process; a failed attempt is not cached, so a later request retries. No `vercel.json` header change: the structure response was not cached at the edge before and stays that way.

## Open questions

None blocking. Two judgement calls to check when you first look at the page: where the legend sits on wide screens (Decision 7) and where the done-beforehand summary opens (Decision 10).
