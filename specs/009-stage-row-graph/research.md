# Research: Stage Rows in the Agent Graph

**Decision 1 - Keep dagre for in-row order only.**
Rationale: it already handles items, labels and cycles, and its x order is a good left-to-right order. Its y and edge points are discarded. Alternatives: hand-rolled ordering (more code, no gain); fixed per-app coordinates (breaks the generic rule).

**Decision 2 - Column assignment by anchoring to the forward predecessor.**
A node with a forward predecessor in an earlier row takes its x; the rest of the row packs around it in dagre order. This gives one spine (load_data to propose_features), puts `fit_model` under `check_proposal` (its only predecessor) and `final_test` under `grid_search`, with no node names in code. Alternatives: dagre x directly (it averages positions and bends the spine); a per-app column table (not generic).

**Decision 3 - Unassigned nodes take the row of their nearest staged predecessor (else Start).**
The spec says unassigned steps keep their "–" badge and must not be lost. Alternative: an extra "No stage" row (adds a row the spec does not list).

**Decision 4 - Edge routing rules** (see plan). Margin routing is chosen by geometry (a forward edge spanning more than one row that would meet a node), so `load_data → __end__` runs down the right margin as in the design. Alternatives: dagre's points (diagonals across rows); a full grid router (overkill).

**Decision 5 - Row height.** Base 60 for one node line, Start 64 (item tag), plus 22 per arc track above the nodes. This reproduces the design (stage 5 about 120 with two tracks). Rows gain no other height.

**Decision 6 - Tick with count.** One `text.tick` holding `✓` and a bold `tspan` for N, from the first visit. `data-visits` keeps its meaning (set from the second visit, absent for a step visited once), because existing tests rely on it; the tick alone shows 1. Alternative: set it from 1 (changes an existing, tested behaviour for no gain).

**Decision 7 - LLM node.** `nodeSize` adds 18 to the width when `actor === "llm"`; the label shifts 9px left; the tick sits at y 0 on the label line so the top-right tag stays clear.

**Decision 8 - Row class and test id.** Rows use class `stage-row`; `data-testid="stage-band"` and `data-stage` are kept so legend and e2e hooks keep working. Start and Finish rows carry the test id too (10 rows in total) with `data-row`.

**Decision 9 - Theme.** Row fills use `var(--stage-colour)` set per row from the existing token, so dark values are inherited; label text uses `--gr-text` and `--gr-muted`. No new tokens.
