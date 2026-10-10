# Contract: the explanation in the run state, the model reply, the DOM

## Run state

| Key | Rule |
|---|---|
| `explanation` | Set by `explain_in_cricket_terms` (template wording), then replaced by `write_in_cricket_terms` when the model's wording passes every check; same key as before; new shape in data-model.md |
| `explanation.source` | `"template"` or `"language model"` |
| `explanation.model` | the model's name when `source` is `"language model"` |
| `explanation.fallback_reason` | one short line when the template wording is used because the model did not take part, failed, timed out, had no budget, or its reply was rejected; null otherwise |

## Graph structure (GET /api/structure)

`write_in_cricket_terms` is a node (stage `interpret`, actor `llm`) after `explain_in_cricket_terms`, which stays code; the edge `explain_in_cricket_terms → write_in_cricket_terms` and `write_in_cricket_terms → __end__` replace `explain_in_cricket_terms → __end__`.

## The writing request and reply

The request carries: fact ids with meanings, units and display values; the fixed blocks and what each shows; the placeholder rule; the length limits; the instruction to write no digit and no invented statistic and to add no block. The reply is JSON (data-model.md). Rejected as a whole: not valid JSON in the shape; any digit anywhere in any title or sentence; a placeholder that is not a fact id; a title or sentence over its limit. Applied part by part: a block missing a title or sentences keeps its template for that block; an order or lead fact outside the fixed lists falls back to the default.

## DOM and test ids (The final test tab)

| Item | Rule |
|---|---|
| `data-testid="explanation"` | the section container (was the list) |
| `data-testid="cricket-block"` with `data-block="<id>"` | one per block, in order |
| `data-testid="verdict-badge"` | the goal badge, with the words "Goal reached" or "Goal missed" and a shape |
| `data-testid="drivers-chart"` | the bar chart (SVG) and its hidden table `drivers-table` |
| `data-testid="wicket-figure"` | the large wicket figure |
| `data-testid="years-strip"` and `years-table` | the year strip and its text equivalent |
| `data-testid="writer-label"` | "Wording written by the language model (<name>)"; absent for template wording |
| `data-testid="writer-fallback"` | the one-line reason when template wording is shown because of a fallback |
| Other final-test test ids (comparison, accuracy table and chart, winner, verdict, best-setup lines) | unchanged |
