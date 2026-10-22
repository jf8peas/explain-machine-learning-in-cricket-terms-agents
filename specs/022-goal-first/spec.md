# Feature Specification: Goal First: State the Goal, Press Play, Watch the Graph, See the Result

**Feature Branch**: `022-goal-first` (work is on `main`; no branch hook ran)
**Created**: 2026-10-22
**Status**: Draft
**Input**: Goal first: readers see the question and the goal, choose the AI and press play for a live run, watch the agent graph work through it, and see the result only when their run finishes. Removes the recorded run. Builds on features 020 and 021 as committed (`bf9d390`), following `specs/022-goal-first/design/`.

## Context

Today the main page opens on the result of a recorded run, and the recorded run plays by itself. A visitor (mostly a data scientist, analyst, marketer, sales or finance contact arriving from LinkedIn, often on a phone) sees the answer before they know the question, and never makes the agent do anything.

This feature turns the page into a short story the reader drives:

1. read the **question and the goal**;
2. **choose the AI and press play**, which starts a real live run, nothing recorded;
3. **watch the graph** work through the run, step by step;
4. **see the result**, which stays locked until their own run finishes.

`design/README.md` is the specification for copy, structure and behaviour; `design/canvas/AppPlay.dc.html` is a visual reference only, and **where they differ, the README wins**. As in 020, every number and data-dependent sentence comes from the backend, the build reuses the shipped classes and theme tokens (light and dark), and every visible word follows 021's glossary.

| Change | Where |
|---|---|
| The recorded run is removed entirely (file, scripts, loading and autoplay, labels, tests) | Main page, scripts, tests |
| The hero states the question and the goal, not a result | Main page |
| Play lives in "Watch it think": a model picker and a Play button; the separate live-run toggle and panel go | Main page |
| The agent graph is shown by default and lights up as the run moves | Main page |
| The verdict, "Your turn" and the run-dependent Scorebook cards are locked until the reader's run finishes | Main page |
| Preview tags become the question; recorded-run mentions are removed | Main page, "How this app was built" |

**Unchanged**: the header, "The problem", the loop strip and Commentary panels, the verdict's content once unlocked, "Your turn" once unlocked, the Scorebook's content, the footer, and "How this app was built" apart from recorded-run mentions. Out of scope: the agent's nodes, edges, prompts and scoring; the run gate's logic; the data; the recipe-agent app; the main site.

## Clarifications

### Session 2026-10-22

- Q: Run limits for the LinkedIn launch (every visit now costs a live run). → A: The limits stay as they are (per visitor per hour, and a site-wide daily limit), both set by environment settings the owner can change on launch day; this feature changes no limit logic. The design's open question is answered by the existing settings, not by new behaviour.
- Q: What do the verdict, "Your turn" and the run-dependent Scorebook cards show while a second run is going, or after it fails? → A: The previous finished run's results stay unlocked until the new run's final test replaces them (feature 020's behaviour); a new run that fails leaves them in place, with the failure message beside the player.
- Q: Does "Watch it again" keep a Pause control? → A: No. The replay is short, so there is no Pause; Back, Step, Reset and Speed are available after a run when "Show me everything" is on.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand the question and the goal first (Priority: P1)

A visitor opening the main page on a phone sees, without scrolling, the question ("Can an AI agent build its own prediction model and beat the TV?"), the goal in one sentence and a button to start the experiment. No result is shown.

**Why this priority**: It is the page's first impression and the reason for the change.

**Independent test**: Load the page on a 390 × 664 screen with no run; check the h1, the goal sentence and the button are visible without scrolling and that no result figure for the agent appears anywhere.

**Acceptance Scenarios**:

1. **Given** the page loads, **Then** with nothing pressed it shows the kicker "AN AI AGENT EXPERIMENT", the h1 "Can an AI agent build its own prediction model and beat the TV?", the lead sentence, the button "▶ Start the experiment" and the goal card.
2. **Given** the goal card, **Then** it shows the kicker "THE GOAL", the sentence "Beat the TV's projection by at least {goal margin} runs on average.", two figures (the TV's usual miss, labelled "runs: how far out the TV usually is, on past innings ({first year}–{last year})", and "{goal margin}+" runs closer) and "Judged on {n} innings from {test year}, a season the agent never sees while it works.", all numbers and years from the backend.
3. **Given** no run has finished, **Then** the page shows no agent result figure, no "Recorded …" label and no "From a recorded run…" line anywhere.
4. **Given** a phone-width screen of 390 × 664 px, **Then** the h1, the goal sentence and the Start button are visible without scrolling, with no horizontal scroll.
5. **Given** the visitor presses "▶ Start the experiment", **Then** the page moves to "Watch it think" and focus lands on the "Choose the AI" select.
6. **Given** the hero's Commentary (opened by "Show me everything"), **Then** it holds how good the TV is on past innings, why the test season stays unseen ("Any model looks good on the data it chose from. {test year} stays locked until the agent has picked its model, then it is used once.") and who does what.

---

### User Story 2 - Choose the AI, press play, and watch it work (Priority: P1)

A visitor chooses an AI from a list, presses Play, and watches the agent graph light up node by node, with a card saying what is happening now, while the agent's ideas appear one round at a time.

**Why this priority**: It is the core interaction, replacing a recorded run with the reader's own.

**Independent test**: With the scripted fake model, choose it, press Play, and check the select, button states, status line, ringed and done nodes, "Right now" card and round feed until the run ends.

**Acceptance Scenarios**:

1. **Given** "Watch it think" before a run, **Then** its h2 reads "Choose the AI, press play, and watch it work.", the player shows a labelled "Choose the AI" select (names and notes only, the default marked "(default)" and selected first, the chosen note linked to the select for assistive technology) and a "▶ Play" button at least 48 px tall, the status line reads "Ready. Choose the AI and press play.", and the round feed says "The agent's ideas appear here, one round at a time, once you press play."
2. **Given** the visitor presses Play, **Then** a real live run starts with the chosen model, the select is disabled, the button reads "Running…" and is disabled, and the status line reads "Live with {model} · {what is happening now}".
3. **Given** a run is going, **Then** the graph is shown (not inside Commentary), the node being worked on is ringed, nodes already done take the "done" style, language-model nodes keep their dashed purple style, and a "Right now" card shows the step (node name), what is being done in plain words from the backend, the round ("2 of up to 6" or "—") and the best score so far.
4. **Given** a run is going, **Then** the round feed adds a row per round exactly as in feature 020 (idea, the agent's reasoning as written, score, one status), and the live region announces per round, not per node.
5. **Given** the run finishes, **Then** every visited node shows done and none is ringed, the status line reads "Finished with {model} · {tries} tries · best {score} on the check seasons", the feed's closing line reads "Best idea: {clues}, learning from {seasons}." with a link "See how it did on {test year} ↓" to the verdict, and the button reads "▶ Run again" beside "Watch it again".
6. **Given** a finished run, **When** the visitor presses "Watch it again", **Then** the graph replays from the events already received, with no model call and no run limit used; "▶ Run again" starts a new live run with the chosen model.
7. **Given** a finished run and "Show me everything" on, **Then** Back, Step, Reset and Speed are available under the graph and step through the finished run's events; the eight-stage legend shows only with "Show me everything".
8. **Given** the graph, **Then** a "What makes it an agent?" explanation sits above it with the legend "Purple dashed: the AI decides · Solid: code · Green: done · Ringed: happening now", and its Commentary explains nodes, edges and the conditional edges after `check_proposal` and `evaluate`.
9. **Given** a run is streaming, **Then** each step appears as it arrives, with no pause added between steps; **given** the run has finished and "Watch it again" is pressed, **Then** the replay runs at the chosen pace.
10. **Given** the player, **Then** under the controls it says "A live run · usually under a minute · runs can differ each time".

---

### User Story 3 - See the result only when my run finishes (Priority: P1)

A visitor sees locked cards for the verdict, "Your turn" and the run-dependent Scorebook views until their own run has finished, then everything unlocks with that run's results.

**Why this priority**: The result must be earned by a real run; otherwise the story has no point.

**Independent test**: Load the page, check each locked card, run the fake model to its end, and check each unlocks with that run's figures; reload and check it is locked again.

**Acceptance Scenarios**:

1. **Given** no run, **Then** the verdict is a dashed locked card with the title "Press play to see how it does."; during a run its title reads "The result appears when the agent finishes."; both say "{test year} stays locked until the agent has chosen its model. Then it is used once, to judge it against the goal."
2. **Given** the run's final test arrives, **Then** the verdict unlocks with the content of features 020 and 021 unchanged, and the agent's bar label adds the model name: "AI agent ({model})".
3. **Given** a first run that fails or is stopped part-way, **Then** the verdict stays locked with "The run didn't finish: {reason}. Press play to try again, or choose another AI."; the no-language-model case keeps feature 020's behaviour.
4. **Given** a finished run and the visitor starts "▶ Run again", **Then** the verdict, "Your turn" and the Scorebook cards keep showing that run's results while the new run goes, the new run's final test replaces them, and a new run that fails leaves them in place with "The run didn't finish: {reason}. Press play to try again, or choose another AI." beside the player.
5. **Given** no finished run, **Then** "Your turn" is locked with "Run the experiment first. Your turn uses the model the agent builds." and a link to the player; after a finished run it is unchanged from feature 020.
6. **Given** no finished run, **Then** the Scorebook cards "Every idea tried" and "The agent graph, step by step" show "Available after a run" and do not open, while "The data" and "How this app was built" work as before.
7. **Given** a finished run, **Then** the goal card's foot shows a result strip worded by the backend's agent verdict, for example "Result: goal reached. The agent was 17.9 runs out, the TV 21.4. See the verdict ↓", linking to the verdict; it is gone again on reload.
8. **Given** a reload or a return visit, **Then** the page starts idle: nothing is stored about runs, and a link to the verdict or "Your turn" lands on the locked card.

---

### User Story 4 - A refused or failed run is clear and recoverable (Priority: P2)

A visitor whose run is refused by the gate or fails sees a clear message and can try again or choose another AI.

**Why this priority**: Every visit now costs a live run, so refusals and failures will be seen.

**Independent test**: Use the fake models that fail, time out or are refused, and check the messages and that the page stays usable.

**Acceptance Scenarios**:

1. **Given** the gate refuses the run, **Then** a `role="alert"` message under the button says, for example, "You've used your {n} live runs for this hour. Try again in {m} minutes." (or the daily-limit message), and the page stays usable.
2. **Given** a run that stops part-way, **Then** the ringed node takes an error style, "Right now" reads "Stopped: {reason}", and the rounds already shown stay.
3. **Given** a first run that ends before its final test, **Then** the verdict, "Your turn" and the run-dependent Scorebook cards stay locked and the failure reason is shown (User Story 3, scenario 3); after an earlier finished run they keep that run's results and the failure reason is shown beside the player (User Story 3, scenario 4).
4. **Given** the chosen model is no longer available, or the model list cannot be loaded, **Then** the default model is selected (a run started with no model uses the server's default) and the visitor is told to press play again.

---

### User Story 5 - The recorded run is gone (Priority: P2)

A maintainer finds no recorded run in the product: no file, no script, no loading code, no label, no test depending on it.

**Why this priority**: Removing it is half of the feature and avoids two sources of truth for the result.

**Independent test**: Search the repository for the recorded run's file and wording; run every suite.

**Acceptance Scenarios**:

1. **Given** the build, **Then** the recorded run's data file, the script that records it, the script that rewords it, the code that loads and autoplays it, the "Recorded {date} · {model}" label and the "From a recorded run…" line no longer exist, and the pages never request a recorded file.
2. **Given** "How this app was built", **Then** no mention of a recorded run remains and the page is otherwise unchanged.
3. **Given** the checks that used the recorded run (feature 021's banned-term check, feature 020's word count, the first-screen check), **Then** they run on a finished fake-model live run instead and still pass.
4. **Given** the fixed preview tags, **Then** the title is "Can an AI agent beat the TV at predicting a T20 score?" and the description invites the reader to choose an AI and watch it try.

### Edge Cases

- A visitor presses Play twice quickly: only one run starts; the button is disabled while running.
- The model list cannot be loaded: the default model is used and the select says so; the player still works with that default.
- The visitor opens a link to `#verdict`, `#try` or an old anchor before a run: they land on the locked card.
- A live run finishes while the visitor is scrolled elsewhere: the status line and the goal card's result strip announce it politely, and nothing jumps the page.
- A visitor changes "Show me everything" during a run: the graph and feed keep running; extra controls and Commentary appear or disappear without losing the run.
- A phone screen: the "Right now" card stacks below the graph, targets are at least 44 px, and there is no horizontal scroll.
- No language model could be reached (the run continues with the brute-force search only): the page keeps feature 020's wording for that case, and the verdict still unlocks when the final test arrives.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The recorded run MUST be removed entirely: its data file, the script that records it, the script that rewords it, the code that loads and autoplays it, the "Recorded {date} · {model}" label, the "From a recorded run…" line and the tests that depend on them. No page MUST request a recorded file. A scripted fake-model run MAY remain as a test fixture, rebuilt in process by a test helper and used only by tests.
- **FR-002**: The hero MUST show the kicker "AN AI AGENT EXPERIMENT", the h1 "Can an AI agent build its own prediction model and beat the TV?", the lead "Halfway through a T20 innings, where will it finish? The agent chooses the clues, code does the maths, and it is tested on a season it has never seen.", and one button "▶ Start the experiment" that goes to the player and moves focus to the "Choose the AI" select. The "Try your own innings" link MUST NOT be in the hero.
- **FR-003**: The hero MUST show a goal card (kicker "THE GOAL", the goal sentence with the goal margin, the TV's usual miss on past innings labelled with the years it was worked out on, "{goal margin}+ runs closer", and the "Judged on {n} innings from {test year}…" line), with every number and year from the backend. After a run finishes it MUST show a result strip worded by the backend's agent verdict, linking to the verdict, which is gone again on reload.
- **FR-004**: The hero's Commentary MUST hold how good the TV is on past innings, why the test season is never seen, and who does what.
- **FR-005**: "Watch it think" MUST have the h2 "Choose the AI, press play, and watch it work." and a player with a labelled "Choose the AI" select filled from the server's model list (names and notes only, the default marked "(default)" and selected first, the chosen note linked to the select, disabled during a run) and a "▶ Play" button at least 48 px tall that starts a real live run with the chosen model.
- **FR-006**: The button MUST read "▶ Play" before a run, "Running…" (disabled) during one, and "▶ Run again" after one; after a finished run "Watch it again" MUST replay the run from the events already received without a model call or a run-limit use. The separate "Run it live with your choice of AI" toggle and panel MUST be removed.
- **FR-007**: The player MUST show the fixed line "A live run · usually under a minute · runs can differ each time" under the controls, and MUST show the gate's refusal messages under the button as a `role="alert"` message while the page stays usable.
- **FR-008**: A status line MUST read "Ready. Choose the AI and press play." before a run, "Live with {model} · {what is happening now}" during one and "Finished with {model} · {tries} tries · best {score} on the check seasons" after one. What is spoken is separate from what is shown: a visually hidden polite live region speaks only changes of phase (ready, started, finished, stopped) and changes between an AI step and a code step, never every node, while the shown line may follow the node. The per-round announcement of feature 020 MUST be kept. For a run in which the agent did not take part, the status line says so instead of a count of tries ("Finished with the brute-force search alone · best {score} on the check seasons").
- **FR-009**: Above the graph, "What makes it an agent?" MUST explain the loop in plain words and carry the legend "Purple dashed: the AI decides · Solid: code · Green: done · Ringed: happening now"; its Commentary MUST explain nodes, edges and conditional edges.
- **FR-010**: The agent graph (feature 020's shared four-row component) MUST be shown by default, not inside Commentary. The server MUST tell the page when each node starts (a `start` event, sent when a node begins, beside the existing `step` event sent when it completes; nodes, edges, prompts and scores unchanged). During a run the node that has started and not yet completed MUST be ringed, completed nodes MUST take the "done" style and language-model nodes MUST keep the dashed purple style; after the run every visited node MUST show done and none ringed. If the run stops part-way, the ringed node MUST take an error style.
- **FR-010a**: While a run streams, the graph, the round feed and the "Right now" card MUST follow the run as it arrives, with no artificial delay; "Watch it again" and stepping through a finished run MUST use the chosen pace (the Speed control, `?interval=`).
- **FR-011**: A "Right now" card MUST show the step (node name), a plain-words line for what is being done (worded by the backend with the structure, using the glossary and the test season), the round ("n of up to 6" or "—") and the best score so far; it MUST stack below the graph on a phone. If the run stops part-way it MUST read "Stopped: {reason}" and the rounds already shown MUST stay.
- **FR-012**: The eight-stage legend MUST show only with "Show me everything"; after a run, and with "Show me everything" on, Back, Step, Reset and Speed MUST step through the finished run's events.
- **FR-013**: The round feed MUST be unchanged from feature 020, with the empty-state line "The agent's ideas appear here, one round at a time, once you press play." and, after a run, the line "Best idea: {clues}, learning from {seasons}." with a link "See how it did on {test year} ↓" to the verdict.
- **FR-014**: The verdict MUST be locked until the run's final test arrives, as a dashed card with a lock icon and the titles and sentence given in User Story 3; when unlocked it MUST show features 020 and 021's content unchanged, with the agent's bar label "AI agent ({model})". A first run that fails or is stopped part-way MUST leave it locked with "The run didn't finish: {reason}. Press play to try again, or choose another AI."
- **FR-014a**: While a later run goes, and if it fails, the results of the visit's last finished run MUST stay unlocked and visible (the locks apply only until a first run has finished); a failed later run MUST show its failure message beside the player.
- **FR-015**: "Your turn" MUST be locked until a run finishes, with "Run the experiment first. Your turn uses the model the agent builds." and a link to the player, and unchanged afterwards.
- **FR-016**: The Scorebook cards "Every idea tried" and "The agent graph, step by step" (named from feature 021's term list and defined once, in the page's card list) MUST show "Available after a run" and not open until a run finishes; the data card and "How this app was built" MUST work as before.
- **FR-017**: Nothing about a run MUST be stored: a reload or a return visit starts idle. "Show me everything", its persistence and `?view=everything` MUST be unchanged, and old anchors MUST keep working, with `#verdict` and `#try` landing on the locked cards before a run.
- **FR-018**: The fixed preview tags MUST use the title "Can an AI agent beat the TV at predicting a T20 score?" and a description inviting the reader to choose an AI and watch it try; "How this app was built" MUST have every mention of a recorded run removed and otherwise stay unchanged.
- **FR-019**: Every check that used the recorded run (feature 021's banned-term check, feature 020's word count, the first-screen check) MUST run on a finished fake-model live run, and all new wording MUST use feature 021's glossary and pass the banned-term check, with the agent's own reasoning shown exactly as written.
- **FR-020**: Word limits MUST hold (the graph's diagram labels, like the agent's reasoning, are not counted: they are not prose): the simple view at most 500 words both before a run and after a fake-model run (excluding the agent's quoted reasoning), and everything open at most 1,200; at 390 × 664 the h1, goal sentence and Start button MUST be visible without scrolling, with no horizontal scroll and 44 px targets.

### Key Entities

- **Run state**: idle, running, finished or failed for the reader's current run; drives the status line, the button, the graph's ring and done styles, and every lock. It lives only in the page and is gone on reload.
- **Goal**: the margin in runs, the TV's usual miss on past innings, the number of test innings and the test season, all from the backend; shown on the goal card and in the locked cards' wording.
- **Step description**: for each node of the graph, a plain-words "what is happening" line worded by the backend and sent with the structure.
- **Lock**: a locked or unlocked state for the verdict, "Your turn" and the two run-dependent Scorebook cards, with the wording for before a run, during one and after a failure.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 390 × 664 screen, the h1, the goal sentence and the Start button are visible without scrolling on first load, and no agent result figure appears anywhere before a run.
- **SC-002**: A visitor reaches a started live run in two actions or fewer from page load (press "▶ Start the experiment", press "▶ Play"), with the default model preselected.
- **SC-003**: Before a run finishes, the verdict, "Your turn" and the two run-dependent Scorebook cards are all locked; after a fake-model run finishes, all four are unlocked within one second of the final test arriving, and after a reload all four are locked again.
- **SC-004**: During a run exactly one node is ringed, the one the server last said had started and not completed (at most one for the instant between two nodes), and the number of done nodes never decreases; after the run every visited node is done and none is ringed; after a mid-run failure the node that was running shows the error style.
- **SC-005**: A search of the repository finds no recorded run in the product: no shipped run file, no script that records or rewords one, no label or line about one, and no page code that loads or plays one; the pages make no request for a recorded file. A scripted fake-model run kept as a test fixture (`web/tests/fixtures/fake-run.json`, rebuilt in process by a test helper) is allowed.
- **SC-006**: Both pages stay within the word limits (at most 500 words simple, before a run and after a fake-model run; at most 1,200 with everything open), and the banned-term check passes on a finished fake-model run.
- **SC-007**: A refused or failed run leaves the page usable and shows a message in plain words in 100% of the fake-model failure cases (refused, failed, timed out, unavailable).

## Assumptions

- The existing gate, run limits and model list are unchanged; this feature changes no limit logic, and the launch-day limits are set by the owner through the existing environment settings (clarification above).
- The "Watch it again" replay has no Pause control; Back, Step, Reset and Speed are available after a run when "Show me everything" is on (clarification above).
- The player's run-length line is fixed copy ("usually under a minute"), because the run deadline is a ceiling, not a typical time.
- The plain-words "what is happening" line for each node is new backend wording sent with the structure; it uses feature 021's glossary and the test season, and no node, edge, prompt or score changes.
- The word count leaves out the graph's diagram labels (node names, badges, row notes), as it leaves out the agent's reasoning; to fit the limits the rule of thumb moved from the verdict to its Commentary, and the loop strip shows only with Show me everything and the Scorebook cards' descriptions are read out but not shown.
- Feature 020's behaviour for a run with no reachable language model (the brute-force search carries on alone, "Brute-force search" in place of "AI agent" on the card) is kept; the goal card and verdict follow it.
- The canvas file is a visual reference only; where it and the design README differ, the README wins.

## Out of Scope

- The agent's nodes, edges, prompts and scoring.
- The run gate's logic and the limit values.
- The data and its preparation.
- The recipe-agent app.
- The main site.
