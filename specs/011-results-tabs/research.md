# Research: Results in Tabs

**Decision 1 - Reuse `<tab-set>` and its hash links.** It already gives links, Back/Forward, arrow-key navigation and hidden-not-removed panels, which is exactly what keeps a run, inputs and scroll positions alive. It is extended, not replaced. Alternative: a second tab component (two ways to do one thing).

**Decision 2 - Panels are hidden, not removed.** `tab-set` sets `hidden` on panels, so `<graph-replay>` keeps running while Working is hidden. Risks to test: (a) the graph's marker animation reads `getTotalLength()` from SVG paths, which can be 0 or throw in a `display: none` subtree; (b) its resize observer sees width 0 while hidden and must not redraw to nonsense. Plan: a Playwright case that plays with Working hidden and confirms the replay still advances to its end, and a guard (skip the fit and the animation when the graph has no size) if that case fails.

**Decision 3 - Readiness follows the replay on screen, as clarified.** What the agent found is ready from the first attempt or reasoning round at the step on display; The final test when the step on display has the final state; Try your own innings when `finalState` holds a model. The machine takes the replay's own detail, so Back lowers readiness (the content shown) while the marker, once shown, stays until opened.

**Decision 4 - One pure state machine.** `step(prev, detail) -> { state, actions }` keeps every rule testable without a browser, and `main.ts` stays wiring. Alternative: logic spread over event handlers (hard to test the "once per run" rule).

**Decision 5 - Run number and failed flag from the component.** The page cannot tell a new run from stepping back by looking at state alone; a run counter from `<graph-replay>` is the simplest honest signal, and `failed` distinguishes an errored stream. Both are app-free.

**Decision 6 - Summary uses the leaderboard's ordering function.** Exporting it makes the leader the same by construction; a test compares both over several attempt sets.

**Decision 7 - Data error moves to the Working tab.** It is a failure of the run, so it stays where the run is watched (FR-014), in the summary line's place; the results tabs show their not-ready sentences.

**Decision 8 - Markers are a dot plus hidden text.** Colour is never the only cue. The marker clears when the tab is shown; it is set only for a tab that is not showing when it becomes ready.

**Decision 9 - Self-scrolling tab list on phones.** `overflow-x: auto` inside the tab list with the selected tab scrolled into view; no wrapping, no page-level horizontal scroll. Alternative: wrapping (changes the bar's height as markers appear).

**Decision 10 - Failure for the switch.** `failed` is true for an error event and for a lost connection, because both leave a message on the Working tab that the visitor should see; the steps already received can still be explored, but the page does not move on their behalf.

**Decision 11 - What latches and what follows the display.** The marker latches (it means "something new is there for you") until the tab is opened. The not-ready sentence and the content follow the step on display, so stepping back to before a tab's content shows its sentence again; this keeps the page honest about what the replay has shown.
