# Implementation Plan: Machine Learning Stages on Every Step

**Branch**: `005-ml-stages` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification (with its three Clarifications) plus the technical decisions supplied with `/speckit-plan`. Every decision in the brief is followed; where it left a choice open (the exact colours, where the legend and the item summary sit, the round-count rule, the shape of the notes and items) the choice and its reason are in [research.md](research.md).

## Summary

Every step of the agent gets one of eight machine learning stages, shown as a numbered, coloured badge on each node, grouped in labelled bands, listed in a legend that can highlight one stage, and repeated in the step detail panel and the timeline. The stage set (names, order, questions, descriptions) is defined once in a new generic backend module and travels inside the existing `/api/structure` response; the visualiser reads it from there and holds no stage name of its own. The backend adds each node's stage, optional notes (feature selection only in this app; the inner and outer loop explanation with the real years), and a display-only "done beforehand" item for the data preparation script. The visualiser draws the item, the bands, the legend and the loop emphasis generically. No node, step event, leaderboard or result changes, and there are no new dependencies.

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript (web)
**Primary Dependencies**: Existing only: FastAPI, pandas, LangGraph, dagre, Vitest, Playwright. No new dependency
**Storage**: None new. Reads the committed `data/innings.csv` (years) and `data/manifest.json` (the item's figures)
**Testing**: pytest, Vitest, Playwright (against the fake model and in-memory store, as in 004); no test reaches the network
**Target Platform**: Vercel (static plus the Python function); evergreen browsers; phone widths
**Project Type**: Web app inside the uv-workspace monorepo (as 001 to 004)
**Performance Goals**: `/api/structure` adds one cached read of the data on first use; drawing eight badges and a few bands is negligible
**Constraints**: Run states and the language-model marking must stay readable (the stage never uses a node's fill or border); no animation for stage features; the visualiser knows nothing about cricket, regression or stage names; all existing testids and tests keep working
**Scale/Scope**: 11 nodes, 8 stages, 1 item; the design must hold for the other seven apps' graphs

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates to evaluate. Principles applied from the brief: one definition of the stage set, shown everywhere from that one source; the visualiser stays generic; colour is never the only cue.

**Re-check after design**: no violations. Departures from, or additions to, the brief are listed under Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-ml-stages/
├── plan.md
├── research.md          # 14 decisions, including the eight colours and their contrast checks
├── data-model.md
├── quickstart.md
├── contracts/
│   └── structure.md
├── checklists/requirements.md
└── tasks.md             # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
backend/linreg/
├── stages.py            # NEW, generic: the eight stages, FIT_STAGE, CHOOSE_STAGE, stage_set(), check_stages(), StageError
├── stage_info.py        # NEW, app-specific: structure_extras(): notes (years from the split) and the done-beforehand item
├── graph.py             # CHANGED: NODE_STAGES beside NODE_ACTORS
├── graph_api.py         # CHANGED, still generic: graph_structure/create_router accept structure_extras and merge it
├── data_table.py        # CHANGED: the exclusion aggregation becomes a public helper, exclusion_rows(manifest); Data tab output unchanged
api/index.py             # CHANGED: node_meta carries stage; create_router gets structure_extras
tests/
├── test_stages.py               # NEW
├── test_structure_stages.py     # NEW
├── test_stage_info.py           # NEW
├── test_boundaries.py           # CHANGED: stages.py shared, stage_info.py app-specific, no stage names in the visualiser
web/src/graph-replay/
├── stages.ts            # NEW: types, stage resolution, roundAt, loopEdges (pure)
├── bands.ts             # NEW: draws bands as the bottom layer
├── legend.ts            # NEW: legend, notes, live region, item panel
├── layout.ts            # CHANGED: stage on nodes, items as nodes, computeBands (pure), ranksep 46 to 58
├── graph-replay.ts      # CHANGED: wiring only (badges, legend, selection, dim, loop pills, panel stage line, timeline badge)
├── styles.ts            # CHANGED: eight stage tokens (light and dark), badge, band, legend, dim, loop, item styles
└── README.md            # CHANGED: stages, notes, items, legend, loop, what the host app must supply
web/tests/
├── unit/{stages.test.ts,bands.test.ts}   # NEW (bands tests may sit in layout.test.ts)
├── unit/layout.test.ts                   # CHANGED
├── fixtures/other-structure.json         # CHANGED: its own stages, loop, note, item
├── e2e/{stages.spec.ts}                  # NEW
└── e2e/reuse.spec.ts                     # CHANGED
specs/001-linear-regression-agent/contracts/structure.schema.json   # CHANGED: new optional fields
```

## Design Notes

Decisions are in `research.md`; the points that matter when building:

- **One source.** `stages.py` owns the set. `graph_api.py` merges `structure_extras()`; the page reads `stages`, `loop`, `notes` and `items` from the response. A test fails if a stage name appears in `web/src/graph-replay/`.
- **Colours** are eight tokens keyed by stage number in `styles.ts`, light and dark, with the number text colour and a neutral fallback; values and checks are in research.md Decision 5.
- **Badge** at the bottom-left corner of each node (the other corners are taken); `data-stage` on the node group for tests and for dimming.
- **Bands** from `computeBands` (pure, in `layout.ts`) after dagre runs; drawn first in the SVG; a stage split by another stage's node gets several bands.
- **Legend** inside `<graph-replay>`: real buttons with `aria-pressed`, "All", a polite live region, visible focus; chips on narrow screens. The selected stage is one field, never in the buffer.
- **Dimming** by a `data-filter` attribute and CSS; the active node is exempt; no transitions.
- **Loop emphasis** from `loop` and the buffer position: edges between `fit` and `choose` nodes, round = events in `fit` nodes up to the cursor, emphasised from round 2 with a "round N" pill.
- **Item** laid out as a dashed, muted node (id `item:<id>`) with a dotted connector; keyboard and touch operable; its summary opens in its own panel; the link works only for `#` targets.
- **Detail panel and timeline** show the badge; the panel also shows the name, the question and the stage's note.
- **Structure extras** are cached per process on first success; the years come from `split_three_ways`.

## Testing Strategy

- **pytest**
  - every node of the real graph has a valid stage (`check_stages` on the compiled graph and `NODE_STAGES`);
  - `check_stages` fails for a missing stage, an unknown stage and a mapping key that is not a node, and ignores start and end;
  - `/api/structure` includes the eight stages in order, each node's stage, `loop`, the notes and the item;
  - the item's figures equal the manifest's (exclusion counts by reason, and the column counts);
  - the years in the general note equal the three-way split of the loaded data;
  - the manifest-unreadable case (item with "details could not be loaded" and the link) and the data-unreadable case (note without years);
  - every stage with no node has a reason (vacuous today);
  - boundaries: `stages.py` imports nothing app-specific; no stage name in the visualiser source.
- **Vitest**
  - `computeBands`: runs of neighbours, a stage split by another stage's node (Choose the setup around Fit the model), a band that would enclose a node of another stage or an unassigned node is split, items take part like nodes of their stage (and share a band with the node they sit before even when `__start__` is between them), start and end are exempt;
  - `roundAt` and `loopEdges` at several buffer positions, including after Back, after jumping and after Reset;
  - an unassigned node resolves to the neutral style and the legend flag; a stage number above 8 resolves to neutral;
  - the unchanged parts keep their existing tests.
- **Playwright**
  - every node shows a badge and the eight badges differ;
  - legend selection by keyboard, highlight and clear (stage again, and "All");
  - selecting a stage mid-run does not interrupt the run and the active node stays undimmed; the selection survives Reset and a new run;
  - the done-beforehand item never becomes active, is absent from the timeline and the step count, and opens its summary with a working `#data` link by mouse and by keyboard;
  - the stage in the graph, the Event panel and the timeline agrees for every step of a run;
  - the loop emphasis appears from round 2, its count rises with each return to Fit the model, and Back lowers it;
  - a second fixture graph with its own stages renders the legend, badges, bands, highlight, loop and item with no visualiser change; with one node's stage removed it shows a neutral badge and the legend flag;
  - at phone width there is no horizontal page scroll and the legend is the chip row.
- **Existing** unit and e2e tests keep passing; the `ranksep` change and the extra timeline content are the two places that could disturb them, and are checked first.
- **Manual (SC-001)**: after one run, someone with no machine learning background names the stage of any step shown and says which stage fits parameters and which chooses the setup. Listed in `quickstart.md`.

## Risks

- **Crowded nodes**: a badge, a visit count, a tick and an LLM tag on one node. They are on different corners; Playwright checks the badge and the count do not overlap on the busiest node.
- **Close colour pairs**: two light-theme stages (4 and 6) and two dark-theme stages (3 and 7) are within ΔE 10 of each other; accepted because the number is the primary cue (research.md Decision 5). Worth a look by eye in both themes.
- **Dim contrast**: dimmed nodes fall below normal text contrast by design; inactive elements are exempt, and the active node is never dimmed.
- **Band labels at the graph's edge**: a label at a band's top-left could be clipped if the band is at the SVG edge; the layout margin is raised if so.
- **Legend placement** and **item panel placement** are judgement calls to confirm on first look.

## Complexity Tracking

Additions or departures, each with its reason:

| Departure or addition | Reason |
|---|---|
| Badge on the bottom-left corner | The visit count (top-left) and the tick and LLM tag (top-right) already use the other corners |
| `ranksep` 46 to 58 | Room for band labels between ranks; existing layout tests check shape, not exact positions |
| Item summary opens in its own panel, not the Event panel | A running replay rewrites the Event panel at every step and would close the summary |
| Round count is the number of `fit`-stage events, emphasised from 2 | The brief says "count of visits"; showing the emphasis only after the first return matches the Clarification |
| `check_stages` also rejects a mapping key that is not a node | Catches a typo that would otherwise silently leave a node unassigned |
| `exclusion_rows` extracted from `data_table._summary` | The brief says to reuse the Data tab's summary code; extracting it keeps the two from disagreeing, and the Data tab output is unchanged |
| Item link works only for `#` targets | The structure is data from the server, and the visualiser is generic; it must never navigate away from the page |
| `structure.schema.json` (feature 001) updated | It forbids extra properties, so the new optional fields have to be added |
