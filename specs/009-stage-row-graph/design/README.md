# Handoff: Agent graph drawn as one row per stage (option 1a)

## Overview
Replace the stage bands in `<graph-replay>` (bordered boxes around runs of nodes, laid out by dagre) with full-width horizontal rows: a Start row, one row for each of the eight stages in structure order, and a Finish row. Each node sits in its stage's row. The rows are tinted with the stage colour and have no borders, so colour alone separates them and there are fewer lines.

## About the design files
`stage-rows-1a.html` is a **design reference in HTML** (inline SVG attributes for portability), not production code. It shows the end of a run (round 6, `explain_in_cricket_terms` active), with hand-placed coordinates. Rebuild it in `apps/linear_regression/web/src/graph-replay/` using the existing CSS classes and tokens in `styles.ts`, so dark mode keeps working.

## Rows
- Full width of the SVG, stacked top to bottom: Start, stages 1 to 8 (structure `stages` order), Finish.
- Fill: `var(--gr-stage-N)` at `fill-opacity: .1`. Start and Finish: `var(--gr-stage-none)` at `.06`. No stroke, no radius, no gap between rows.
- Label column on the left (about 200px): the stage badge (circle r 8, `--gr-stage-text` number, 10px 700) and the stage name (11.5px 600, `--gr-text`), vertically centred on the row's node line. Start and Finish have a muted text label and no badge.
- Row height: about 60px for a single line of nodes. A row grows when it needs room for edges that loop back within it (stage 5 is about 120px, nodes on its lower line).
- Selecting a stage in the legend dims the other rows (`.band.dim` behaviour moves to rows).

## Node placement
- The main spine (load_data, split, explore, baseline, propose_features) is one vertical line, so most edges are straight and short.
- Within a row, nodes are ordered left to right to keep loop-back edges short: in stage 5, `evaluate → propose_features → check_proposal → grid_search`.
- `fit_model` (stage 6) sits directly under `check_proposal`. The `check → fit → evaluate` loop runs down, left along the stage 6 row, and up.
- `explain_in_cricket_terms` sits directly above Finish. `load_data`'s `stop` edge runs along the right-hand margin down to Finish.
- Display-only items (`structure.items`) go in the Start row, to the left of the start circle, with the dotted item connector pointing into Start. This shows they are done before the run. They keep their stage badge.

## Run count (replaces the blue count circle)
- Remove `.count-bg` / `.count` (the blue circle top-left), which was easy to confuse with the stage badge.
- The visited tick now carries the count: `✓N`, where N is the node's visit count, shown from the first visit (`✓1`), hidden at 0.
- Position: top-right corner, `x = w/2 - 5`, `y = -h/2 + 10`, 10px, `--gr-visited-border`, number 700 with 2px left spacing. Keep `data-visits` on the node.
- For LLM nodes the tag occupies the top-right, so the node is 18px wider, the label shifts 9px left, and `✓N` sits on the label's line at the right edge.

## Unchanged
Node, edge, label, loop-pill, marker, LLM-tag and item styles; stage badges on nodes (the number stays the primary cue); playback, timeline, legend and panels; `data-testid`s used by `web/tests/e2e/stages.spec.ts` (`stage-band` should move to the row elements).

## Tokens (light)
`--gr-surface #f6f7f9`, `--gr-text #1b2230`, `--gr-muted #5b6678`, `--gr-accent #1d6fe0`, `--gr-visited #e4f3ea`, `--gr-visited-border #3f8f5f`, `--gr-llm #7a3fc0`, stages 1–8: `#8a5a00 #5f7a00 #00798a #8a4f7d #bb5400 #a3246b #00695c #7a5c46`.

## Files
- `stage-rows-1a.html`: standalone reference
- Source being changed: `graph-replay/layout.ts` (layout and `computeBands`), `bands.ts`, `graph-replay.ts` (`drawGraph`, `drawItem`, `updateGraph`), `styles.ts`
