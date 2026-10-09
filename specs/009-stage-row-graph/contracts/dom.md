# Contract: what the rendered graph exposes

| Hook | Rule |
|---|---|
| `data-testid="stage-band"` | One per row (Start, each stage, Finish); in the first SVG layer (`g.bands`) |
| `data-stage`, `data-stage-number` | On stage rows; Start and Finish carry `data-row="start"` / `"end"` instead |
| `data-nodes` | Removed (it listed a band's nodes); tests check containment by position instead |
| `.band-label`, `.band-name`, `.band-badge`, `.band-number` | Label column parts, kept for tests |
| `.stage-row.dim`, `.stage-row.stage-selected` | Legend selection state on rows |
| `.node .tick` | Text `✓N` from the first visit, hidden at 0; no `.count` or `.count-bg` |
| `data-visits` | Unchanged: the visit count, set from the second visit only |
| Other `data-testid`s (nodes, edges, items, badges, loop pills, legend, timeline, marker) | Unchanged |
| Tokens | `--gr-stage-1..8`, `--gr-stage-none`, `--gr-stage-text`, `--gr-visited-border`; no new tokens |
| Structure response | Unchanged |
