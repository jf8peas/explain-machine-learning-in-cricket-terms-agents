# Research: Goal First

Decisions taken while planning feature 022 on top of features 020 and 021 (commit `bf9d390`). Paths are under `apps/linear_regression/`.

## R1. Telling the page which node is running (gap A)

**Finding.** `graph_api.run_events` yields one `step` per completed node (it pairs an `updates` chunk with the next `values` chunk). Nothing says a node has begun, so the page cannot ring the node in progress: the long wait inside `propose_features`, or the node chosen after the conditional edges from `check_proposal` and `evaluate`, is invisible.

**Checked on the shipped LangGraph (1.2.12).** `app.stream(..., stream_mode=["updates", "values", "tasks"])` also yields `tasks` chunks: one when a task starts (a dict with `id`, `name`, `input`, `triggers`) and one when it ends (`id`, `name`, `result`, `error`, `interrupts`). For this graph the order is: start(A), updates(A), values, end(A), start(B). `__start__` and `__end__` produce no task.

**Decision.** `run_events` adds `"tasks"` to the stream modes and emits `event: start` with `{"step": n + 1, "node": name}` for every task-start chunk (a chunk with `input` and no `result`). The existing `step`, `done` and `error` events are unchanged, so nothing that reads them changes. `graph_api.py` stays generic (it names no node and no app). Task-end chunks are ignored: a failure still arrives as the exception that ends the stream, which becomes the existing `error` event.

**Consequences.**
- The browser's `sse.ts` gets an optional `onStart` handler; a client that ignores `start` still works.
- Vercel streaming is unchanged (more small events, a few hundred bytes each).
- A step's `start` is sent after the previous `step` in the same moment, so the page sees them in one read in practice; the instant between two nodes (no ring) can be one paint at most. SC-004 says exactly that.
- Tests that count events (`test_graph_api`, the other-app fixture) gain a `start` per node; a new test asserts the order start, step, start, step for the real graph and for the generic fixture graph.

**Alternatives rejected.** Inferring "next node" in the page from the edges (wrong after a conditional edge, and blind inside `propose_features`); a heartbeat event (carries no node); calling `stream_mode="debug"` (same data in a heavier shape, and its shape is less stable).

## R2. A live run is shown as it arrives, not paced

`graph-replay` plays every run, saved or streaming, through `ReplayBuffer` at a paced speed (1.5 s a step by default, `?interval=` to change it). For a recorded run that was right. For the reader's own live run, pacing makes the graph lag the real work and, with a fast model, replays a run that already finished.

**Decision.** While a run is streaming, the replay follows arrival: the cursor moves to each step as it arrives and the node that has started is ringed. The pace, the Speed control and Back/Step/Reset apply to **Watch it again** and to stepping through a finished run. `buffer.ts` gains a `follow` flag (true from a live start until `done`/`error`), and `ReplayBuffer.push` moves the cursor when it is set. `?interval=` keeps working for replays, so tests stay fast.

**Graph states.** Each drawn node has one of: not reached; ringed (running); done; error. Rules:
- Streaming: ringed = the started node that has not completed; done = every node with a received `step`.
- Replaying (cursor at step *i*): ringed = the node of step *i* while *i* is not the last step; done = nodes of steps before *i*; at the last step every visited node is done and none is ringed.
- Stopped part-way: the node that was running takes the error style (R7).
- The existing "active" highlight (cursor) is replaced by this; the stage filter, dimming and item buttons are kept.

## R3. One page-level run state

Today `run-source.ts` holds the recorded run, the visit's live run and a pending flag, and `player-state.ts` derives one button label from the replay. Both are built around a recorded default and are replaced.

**Decision.** A pure `run-state.ts`:

```
phase:   idle | running | finished | failed
current: { events, state, modelName } | null      # the run in progress, or just ended
last:    { events, state, modelName } | null      # the visit's last run that reached its final test
message: string | null                           # a refusal or a failure to show beside the player
```

Transitions: `press(model)` → running (keeps `last`); `opened` (server accepted); `step(event)` / `start(event)`; `finalTest` (the state now has `final`) → `last` becomes this run's (updated on each later step until `done`); `done` → finished; `refused(message)` → back to the previous phase with the message; `failed(reason)` → failed (keeps `last`); a reload makes a new state: idle, nothing kept. "Watch it again" does not change the phase.

**Derived (all pure, unit tested).**
- `shownRun` = `last` (the run whose results the verdict, Your turn, goal-card strip and Scorebook show).
- `locks`: `verdict` / `tryit` / `scorebookRun` are `locked` when `last` is null, with the variant `before` (idle), `during` (running) or `failed` (failed first run); unlocked otherwise (FR-014a).
- button: `Play` (idle, or failed), `Running…` (running), `Run again` + `Watch it again` (finished, and failed with a `last`).
- status line text for each phase.

`last` unlocks at the final test (FR-014), not at `done`: its state keeps growing until `done` (the explanation steps follow the final test), and the renderers redraw on every change so the takeaways fill in when they arrive.

**Kept from the old code:** the idea of folding events into a state (`foldState` in the buffer). **Dropped:** `recorded`, `live`, `pending`, `runLabel`, `originLine`.

## R4. Step descriptions ("doing" lines)

**Decision.** `wording.doing_lines(test_year)` returns one plain-words line per node, using 021's term list and the test season; `stage_info.structure_extras` adds `"doing": {node: line}` to `/api/structure` (next to `rows`), with the test year read from the same rolling checks `general_note` already reads (no test rows are read: only the year; a missing year falls back to "the test season"). `test_stage_info` gets a check that every node of the graph has a line and none has a banned name. The graph component stays generic: it exposes the structure it loaded (a `structure` getter, and the existing `structureready` event) and the page reads `doing` from it.

Lines (final wording at build time, all checked by the banned-term test):

| Node | Doing |
|---|---|
| load_data | Code is loading the innings |
| split | Code is splitting the seasons: learn, check, test |
| explore | Code is summarising the past seasons for the AI agent |
| baseline | Code is scoring the TV projection and the average-total guess |
| propose_features | The AI agent is choosing its clues |
| check_proposal | Code is checking the idea |
| fit_model | Code fits the regression |
| evaluate | Code scores it on the check seasons |
| grid_search | The brute-force search tries every combination of settings |
| final_test | Unlocking {test year} and scoring once |
| explain_in_cricket_terms | Code builds the facts for the explanation |
| write_in_cricket_terms | The AI agent words the explanation; code fills in every number |

## R5. Model fallback (gap E)

`RunGate._model` calls `options.resolve(None)` when no `model` parameter is sent, and `resolve(None)` returns the default option. So `/api/run` already uses the default model when none is given, and the page's `runUrl(null)` is `/api/run`. **Decision:** no code change; add tests: a backend test that `/api/run` with no model uses the default (the run's `model_name` is the default's), and an end-to-end test that with `/api/models` failing the select shows "Default model", Play works, and the run uses the default.

## R6. Run length (gap B)

The deadline (90 s on Vercel, 80 s in tests) is a ceiling, and a typical run is shorter. **Decision:** fixed copy "A live run · usually under a minute · runs can differ each time" (no figure from settings; `limitsText` is no longer used in the player). A per-model typical time in `model_options` is not added: it would be a number the owner must keep true.

## R7. A run that stops part-way (gap D)

**Decision.** On an `error` event or a lost connection, the page: sets the phase to failed with the reason (the server's redacted message, or the connection message); asks the graph to mark the node that was running (`inProgress` at that moment) with the error style (`data-state="error"`, a different border colour and shape as well as colour); shows "Stopped: {reason}" in the Right now card; and leaves the rounds already received in the feed. The verdict keeps the 020/021 `failed` wording for a first run (locked) and keeps the earlier results for a later run (FR-014a). The button returns to "▶ Play" (first run) or "▶ Run again".

## R8. Goal card and result strip words (gap C)

- **Goal card.** `/api/reference` already sends `goal` (margin, sentence), `figures.broadcaster.average_miss` (the TV's miss on past innings) and `training` (`first_year`, `last_year`, `innings`). It lacks the test season and its innings count. **Decision:** `hero_text.goal_card(goal, figures, training, test)` builds the card's words (sentence, the two figure labels, the "Judged on {n} innings from {year}…" line) and `/api/reference` sends it as `goal_card`, with `test: {year, innings}` read from the rolling checks (`rolling.test_year`, `rolling.n_test`: counts the split step already shows, no test rows read). On the failure path the card falls back to the goal sentence only. The TV figure's label is "runs: how far out the TV usually is, on past innings ({first year}–{last year})".
- **Result strip.** `headlines.build` already derives the agent's case (beat, edged, held, no_llm). **Decision:** it adds `result_strip` = `{label, text}` ("goal reached" / "short of the goal" / "goal missed" / "search only", and "The agent was 17.9 runs out, the TV 21.4.") from the same one-decimal misses, so the strip never claims more than the verdict does. No agent figure appears before a run because the strip is only drawn from `last`.

## R9. What happens to the recorded-run code (FR-001)

Every file's fate is in plan.md. Two decisions beyond deletion:

1. **Tests that injected a run now inject a stream.** Several end-to-end tests built cases (beat, edged, held, no model) by routing `/recorded-run.json`. They will route `/api/run` with a server-sent-events body instead (the `serveRun` helper exists), built from a test fixture of scripted fake-model events.
2. **One fixture stays, as a test fixture.** `web/tests/fixtures/recorded-run.fake.json` becomes `web/tests/fixtures/fake-run.json`: the events a scripted fake-model run streams, used only by unit tests and by tests that need a specific case. It is not recorded by a product tool: `tests/make_fake_run.py` (test helper, not in `scripts/`) rebuilds it in process from the fake model, and `test_fake_run_fixture.py` fails if it is stale. Tests that only need "a finished run" drive a real fake-model run through the page instead (R10), so the fixture is the exception, not the rule.

`terms_version` stays in `/api/reference` (it is part of the glossary payload); the recorded run's `wording_version` and the reword script go. `wording.py` stays (the nodes use it); its docstring stops mentioning the script.

## R10. Driving a fake-model run in tests

Playwright already starts the API with the scripted fake model (`LLM_PROVIDER=fake`, ids `fake/steady`, `fake/quick`, `fake/slow`, `fake/markup`, `fake/broken`, `fake/timeout`) and each test is its own visitor (a unique `X-Forwarded-For`), so the per-hour limit (5) is never shared.

**Decision.** A helper `runToEnd(page)` opens the page, presses "▶ Start the experiment" then "▶ Play" (default fake model) and waits for "Finished with …"; `fakeRun(request, visitor)` fetches `/api/run` directly (a separate visitor id) and returns `{events, state}` for tests that need the expected figures. The first run of a server process is the slowest (the grid search is memoised per process), so the helper's timeout is generous and tests that need several runs use `fake/quick`.

## R11. Word counts

Before a run the page shows the hero, the goal card, the problem, the player, the locked cards and the Scorebook cards; after a run it adds the verdict, results strip, Your turn and the finished player. 021 left main at 495 (simple) and 1,195 (everything) of 500 and 1,200, so the new copy is the risk. Added: goal card (~50 words), "What makes it an agent?" and legend (~60), the Right now card (~20), the status and controls (~30), three locked cards (~60), the result strip (~20). Removed: the Scoreboard card and its lines (~45), the recorded label and origin line (~25), the live toggle and panel text (~40, Commentary), and the verdict content before a run (~110).

**Decision.** Measure both states (before a run, after a fake-model run) in the same test, at 390 px, and print them. If either is over, cut in this order and record each cut in quickstart.md: (1) the hero lead's second sentence is fixed by the design and is not cut; (2) the locked cards' second sentence; (3) the legend's repetition of "Purple dashed" in the explanation; (4) the round-feed empty line; (5) "Judged on…" shortened. The goal sentence, the question, the status wording and the controls' labels are fixed by the design and are not cut.

## R12. Focus and announcements

- "▶ Start the experiment" is a link to `#watch`; its click handler also scrolls and moves focus to the "Choose the AI" select (so a keyboard user lands on the first control; `scroll-margin-top` clears the sticky header).
- The status line is shown text that follows the run (it may change at every node: "Live with {model} · {doing}") and is **not** a live region. A separate visually hidden `role="status"` `aria-live="polite"` element (`player-announce`) speaks only changes of phase (ready, started, finished, stopped) and changes between an AI step and a code step, never every node. The 020 per-round announcement element is kept as the existing visually hidden live region. The refusal and failure messages are `role="alert"`.
- The Right now card is not a live region (it changes every node).

## R13. Preview tags and the other page

`index.html` title and description change (R-FR-018). `under-the-hood.html` and its tests have the recorded-run mentions removed (the page text, the counts of figures, and `vercel.json`'s `/recorded-run.json` header go). `test_preview_tags.py`, `test_static_terms.py` and `preview-tags.spec.ts` are updated for the new title.

## Open points

1. **Pace on a very fast model.** With the live display following arrival, a model that answers in under a second makes rounds appear almost at once, and the whole run can finish in a few seconds. That is honest, and "Watch it again" replays at pace; if testers find it too quick, a minimum dwell per node (about half a second) can be added in `ReplayBuffer` without changing the contract.
2. **The graph's "language model step" label** (event panel, shared component) stays as 021 left it; it is generic ML vocabulary.
