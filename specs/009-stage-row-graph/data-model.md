# Data Model: Stage Rows in the Agent Graph

No stored data; types live in `layout.ts`.

**Row** (replaces `Band`): `key` ("start", "end" or the stage id), `kind` ("start" | "stage" | "end"), `stage` (id or null), `number` (or null), `name`, `x` (0), `y`, `w` (full width), `h`, `label` ({x, y}: badge centre, vertically centred on the row's node line), `nodes` (ids).
Rules: order is Start, `stages` order, End; `y[i+1] = y[i] + h[i]`; one row per stage even when empty; `h` is at least the base height.

**Layout**: `{ nodes, edges, rows, width, height }` (`bands` removed).

**LaidNode**: same shape; `w` is 18 wider for LLM steps; `row` (index into `rows`) added.

**LaidEdge**: same shape; `points` is an axis-aligned polyline; `label` sits at the midpoint of the longest segment.

**Visit tick**: derived from the visit count n: `visitTick(n)` is `✓n` when n > 0, otherwise empty.
