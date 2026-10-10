# Data Model: Results in Tabs

No stored data. In-page types only.

**ReplayChangeDetail** (extended): existing fields (`cursor`, `steps`, `finished`, `atEnd`, `state`, `finalState`) plus `run: number` (up by one each time a new run starts, starting at 0 or 1 before any run) and `failed: boolean` (true when the stream ended with an error event).

**Readiness state**: `{ run: number; ready: { found: boolean; final: boolean; tryit: boolean }; switched: boolean }`.
- Initial: run 0, nothing ready, not switched.
- A larger `run` than recorded: everything not ready, `switched` false, `run` updated.
- found ready: the displayed state has an attempt or a reasoning round.
- final ready: the displayed state has `final`.
- tryit ready: `finalState` holds a model.
- `switched` is set when the switch action is emitted for the current run and stays set until the next run.
- `ready` is what the display shows now (it can fall when stepping back, except `tryit`, which follows `finalState`); a marker, once set, is held outside it and cleared only by showing the tab.

**Actions** (output of the machine): `{ type: "switch", tab: "found", focus: true }`, `{ type: "marker", tab, on }`, `{ type: "notReady", tab, show }`.

**Tab**: id (`data`, `working`, `found`, `final-test`, `try-your-own`), label, heading (`h2`, `tabindex="-1"`), optional marker (dot plus hidden text), and for result tabs a not-ready paragraph and a content container.

**Summary line**: either the pre-run sentence, the leader line (average miss, proposer, link to `#found`), or the data error.

Rules: markers are set only for a tab that is not showing; showing a tab clears its marker; the switch happens at most once per run number.
