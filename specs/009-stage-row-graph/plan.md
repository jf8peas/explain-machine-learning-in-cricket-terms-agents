# Implementation Plan: Stage Rows in the Agent Graph

**Branch**: `009-stage-row-graph` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)
**Input**: The specification and the planning brief. Design reference: [design/stage-rows-1a.html](design/stage-rows-1a.html) and [design/README.md](design/README.md). Choices the brief left open are in [research.md](research.md).

## Summary

`<graph-replay>` stops drawing bordered bands around runs of nodes and draws one full-width, borderless, tinted row per stage: Start, the stages in structure order, Finish. Layout keeps dagre only to order nodes within a row; each node's row comes from its stage, y from the row, and x from a small column-assignment pass that keeps the main sequence on one vertical line and puts a node under its predecessor (this is what places `fit_model` under `check_proposal`). Edges become orthogonal polylines: straight vertical between aligned nodes, one elbow otherwise, arcs above the row for same-row loop-backs and skips, the right margin for edges that would cross intermediate rows. `computeBands` is replaced by a pure `computeRows`. The blue visit-count circle goes; the tick becomes `✓N` from the first visit. Front-end only, no new dependency, no change to the structure response.

## Technical Context

**Language/Version**: TypeScript, no framework (vanilla web component, SVG)
**Primary Dependencies**: existing only (`@dagrejs/dagre`). No new dependency
**Storage**: None
**Testing**: Vitest (`tests/unit/layout.test.ts`, `tests/unit/bands.test.ts`, `tests/unit/stages.test.ts`), Playwright (`tests/e2e/stages.spec.ts`); real structure fixture `tests/fixtures/linreg-structure.json`
**Target Platform**: evergreen browsers, light and dark themes
**Project Type**: web component in `apps/linear_regression/web/src/graph-replay/`
**Performance Goals**: layout stays synchronous and imperceptible (about 14 nodes); no animation added
**Constraints**: generic component, no stage names or app knowledge; colours only through existing `--gr-*` tokens; existing test ids and `data-*` hooks kept; playback, timeline, legend and panels untouched
**Scale/Scope**: one structure of 13 nodes, 1 item, 8 stages; must also work for any stage count or order

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates. Principles applied from the brief and earlier features:

| Principle | How the plan meets it |
|---|---|
| Component stays generic | Rows derive from `structure.stages`; placement rules use only graph shape (edges, rows, widths) |
| Pure, tested layout | `computeRows`, placement and routing are pure functions, unit-tested on synthetic and real structures |
| One source for each fact | Row order from `stages`; colours from existing tokens; tick text from one helper `visitTick` |
| No new dependencies | dagre only for in-row order |

**Re-check after design**: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-stage-row-graph/
├── plan.md
├── research.md          # decisions: placement, routing, row height, count, unassigned nodes
├── data-model.md        # Row, Layout, LaidNode changes
├── quickstart.md        # how to verify by hand and by test
├── contracts/dom.md     # test ids, classes, data attributes, tokens that must hold
├── checklists/requirements.md
└── tasks.md             # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/web/`)

```text
src/graph-replay/
├── layout.ts       # CHANGED: layoutGraph assigns rows and columns, routes orthogonal edges, returns rows;
│                   #          computeRows replaces computeBands; nodeSize +18 for LLM nodes
├── bands.ts        # CHANGED: drawBands becomes drawRows (bottom layer, label column, no stroke)
├── stages.ts       # CHANGED: visitTick(n) helper
├── graph-replay.ts # CHANGED: drawGraph (no count circle, tick with count, LLM label shift, items in Start row),
│                   #          updateGraph (✓N from 1, data-visits), applyFilter (rows)
├── styles.ts       # CHANGED: .band rules become .stage-row rules; remove .count and .count-bg; tick sizing
└── README.md       # CHANGED: Stages section, Files table
tests/unit/layout.test.ts, bands.test.ts, stages.test.ts   # CHANGED / NEW cases
tests/e2e/stages.spec.ts                                    # CHANGED: rows and count
```

**Structure Decision**: keep the existing files; `bands.ts` keeps its name (the brief says so) but now draws rows.

## Design

### Rows (`computeRows`)
Input: placed nodes (each with a row index), the stage list, row heights, graph width and label column width. Output: one `Row` per row, `{ key, kind: "start" | "stage" | "end", stage, number, name, x: 0, y, w, h, label: {x, y}, nodes }`, stacked with no gaps, full width. Order: Start, `stages` order, Finish. A stage with no nodes still gets a standard-height row. Testable without dagre.

### Placement (in `layoutGraph`)
1. Run dagre as today (nodes, items, edge labels) for relative order only.
2. Row of a node: Start for `start`, Finish for `end`, its stage's row if the stage is in `stages`; an unassigned node takes the row of its nearest staged predecessor (else Start) and keeps its "–" badge.
3. Within a row sort by dagre x. **Anchor**: a node with a forward predecessor in an earlier row takes that predecessor's x (rows processed top to bottom; Start sits at the spine x). If a node has several forward predecessors in earlier rows (the end node has two), it takes the x of the one in the nearest earlier row; ties go to the first in edge order. Remaining nodes pack left and right of the anchor in dagre order with a fixed gap. If no node is anchored, the first takes the spine x.
4. Normalise: shift x so the leftmost node clears the label column (about 200px) plus margin. Items sit left of Start in the Start row, so the spine x is at least label column + item width + gap. Width = rightmost node plus a right margin reserved for margin-routed edges.
5. y: row top plus the row's arc padding plus half a node line (64px base line; Start has 8px more for the item tag).

### Edge routing
In order: same x, different rows → one vertical segment; adjacent in the same row with no opposite edge → one horizontal segment; any other same-row edge (loop-back, or skipping a neighbour) → arc above the row on a track chosen by span (longer spans higher), which sets the row's extra top height; forward cross-row with different x → down, across in the target row's top channel, down; backward cross-row → leave the side facing the target, one turn, enter the target from below; a forward edge spanning more than one row whose straight path would meet a node → out of the source's right side, down the right margin (offset per edge), into the target's right side. Item connector: horizontal, dotted, into Start. Labels at the midpoint of the longest segment. Loop pills keep their existing mid-point rule.

### Long names and large counts
The label column is 200px by default and widens to fit the longest stage name (at the existing label character width); a name is never truncated. The tick is right-anchored, so a two-digit count grows leftward within the node, which is wide enough (minimum 96px).

### Drawing
`drawRows` makes `g.stage-row[data-testid="stage-band"][data-stage][data-stage-number]` with a full-width `rect` (fill `var(--stage-colour)`, `fill-opacity .1`; Start and Finish use `--gr-stage-none` at `.06`), no stroke or radius, then a label group (badge circle r 8, number, name) at the row's label position. Start and Finish: muted name, no badge, `data-row="start|end"`. Rows stay the first layer. Legend selection toggles `dim` on rows as on nodes (`.stage-row.dim { opacity: .3 }`, selected row `fill-opacity .2`).

### Visit tick
`visitTick(n)` returns `""` for 0 and `✓N` otherwise. Node tick: `text.tick` at `x = w/2 - 5`, `y = -h/2 + 10` (LLM nodes: `y = 0`, since the tag holds the top right), 10px, `--gr-visited-border`, the number in a bold `tspan` with `dx=2`. LLM nodes are 18px wider and their label shifts 9px left. `.count`, `.count-bg` and their update code are removed. `data-visits` is unchanged (set from the second visit).

## Complexity Tracking

| Departure | Why |
|---|---|
| `layout.ts` grows (placement and routing) | Kept pure and in one file; split into a module if it passes about 400 lines |

## Testing

- Unit `bands.test.ts`: `computeRows` order (Start, stages in structure order, Finish), full width, no gaps, label position, an empty stage still gets a row, taller row when arcs need room, unknown stage gets no row.
- Unit `layout.test.ts`: Finish shares x with the node just above it when it has several predecessors; every node's y inside its row; spine nodes share x; `fit_model` has the x of `check_proposal` and a later row; the item is in the Start row left of start with its connector into Start; same-row loop-back arcs stay within the row; no two nodes overlap; edge points are axis-aligned; a 3-stage structure in a different order lays out in that order; a structure without `stages` still lays out.
- Unit `stages.test.ts`: `visitTick` is `""` at 0, `✓1` at 1, `✓6` at 6.
- E2E `stages.spec.ts`: 10 rows in order, names and badges in the label column, no stroke, rows are the first SVG layer, nodes inside their row, legend dims rows, item within the Start row, tick text from the first visit, tick/badge/LLM tag do not overlap, no `.count-bg`, dark theme legibility check kept.

## Changes made while implementing

- **Page layout**: the graph stays in the left column at the width it had before (about 560px at a 1280px window), with the legend and panels on the right and the old minimum height. The rows are about 930px wide at natural size, so the drawing is scaled to about 0.59 there. On a phone it keeps its natural size and scrolls sideways.
- **Row line** is 64px (not 60) so a loop-round pill fits between two stacked nodes; arcs run 24px above their nodes so they clear a step's LLM tag.
- **Tick**: one text `✓N` (no separate bold tspan); styled bold at 10px.
- **Ordering**: within a row, nodes are ordered by trying every order (up to 7 nodes) and keeping the one with the shortest edges and fewest leftward ones, with dagre's order breaking ties; this gives evaluate, propose_features, check_proposal, grid_search.
- **Fills the column height**: the drawing is stretched to the height of the right-hand column (legend and panels), now and as the panels grow. The extra height is shared equally between the rows (`layoutGraph(structure, minHeight)`); nodes keep their size and edges lengthen. A resize observer moves the existing elements to the new layout (`moveGraph`) rather than redrawing, so focus, selection, the open item and a marker in flight are kept. On a phone (one column) the drawing keeps its natural height.
- **No fixed label column**: the 200px label column was most of the drawing's width (about 930 units). Labels now sit on the node line only where nothing covers them, and move to the top-left corner of their row where a step, the item or an edge would (Start, Choose the setup, Fit the model on the real graph). The drawing is about 720 units wide, so it scales to about 0.76 in the half-width column (was 0.59).
- **Two-line rows and a narrower drawing**: a row with more than three steps puts the steps a later row loops back to on a second line (Choose the setup: evaluate sits under propose_features). A lone step never reaches further right than the widest line above it, and a long item label wraps to two lines. The drawing is about 615 units wide, so it scales to about 0.89 in the half-width column (node text about 11px, labels about 10px).
