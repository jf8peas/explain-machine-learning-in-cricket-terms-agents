# Contract: tabs, events and test ids

| Item | Rule |
|---|---|
| Tab ids (links) | `#data`, `#working`, `#found`, `#final-test`, `#try-your-own`, in that order; default `working` |
| Tab labels | Data, Working, What the agent found, The final test, Try your own innings |
| Tab buttons | `data-testid="tab-<id>"`, `role="tab"`, `aria-selected`; marker inside the button: a dot plus visually hidden "new results" |
| Panels | `role="tabpanel"`, hidden not removed; first child an `h2` with `tabindex="-1"` |
| `tabSet.select(id, { focus })` | Switches via the hash; with `focus`, focuses the panel's first `[tabindex="-1"]` heading |
| `tabSet.setMarker(id, on)` | Shows or hides the tab's marker; `tab-show` clears it |
| Live region | Polite, inside `<tab-set>`; "Now showing: <label>" on programmatic switches |
| `replaychange` detail | Existing fields plus `run` and `failed` |
| Test ids kept | every existing id moves with its element; `results` stays on the What the agent found container; The final test container `results-final`; summary line `run-summary`; each result panel's not-ready paragraph `not-ready` |
| Results routing | found: model line, notice, leaderboard, grid, reasoning, link to `#final-test`; final: comparison, accuracy table and chart, best-setup lines, explanation, no-perfect-method note; Try your own innings: the form and result; Working: intro, catalogue, picker, variation note, graph, summary line (and the data error) |
