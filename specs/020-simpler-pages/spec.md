# Feature Specification: Simpler Pages: the Agent as the Hero, Detail on Request

**Feature Branch**: `020-simpler-pages` (work is on `main`; no branch hook ran)
**Created**: 2026-10-22
**Status**: Implemented, except two owner steps: record the real run (`scripts/record_run.py`) and set `VITE_APP_URL`
**Input**: Simpler pages: make the agent the hero and hide detail until asked, on both the main page and the "How this app was built" page, following `specs/020-simpler-pages/design/`.

## Context

Testers and visitors say the app is too complicated and too dense. The first audience is John's LinkedIn contacts (data scientists, analysts, marketers, sales, finance), most arriving from a post on a phone. They should grasp in seconds that an AI agent built its own prediction model and how it did against the TV projection, and see the detail only if they ask for it.

`design/README.md` is the specification for copy, structure and layout; the canvas files in `design/canvas/` are visual references only. **Where they differ, the README wins.** The canvas uses fixed figures from a fake run; the built pages take every number and data-dependent sentence from the backend, as today, and reuse the shipped pages' styles and light and dark themes.

Every view has three levels of detail:

| Level | For | Where |
|---|---|---|
| Scoreboard | everyone | always shown: per section a headline, a main visual and a short lead |
| Commentary | the curious | inline panels opened by "Show me everything" or a section's own toggle |
| Scorebook | data scientists | full reference views, opened from the Scorebook section, never inline |

| Change | Where |
|---|---|
| Tabs replaced by one scrolling page: Hero, The problem, Watch it think, The verdict, Your turn, The Scorebook | Main page |
| A recorded run plays by default; "Run it live" stays | Main page |
| "Show me everything" / "Simple view" switch, remembered and shareable by link | Both pages |
| Agent graph redrawn in four rows, shared by both pages | Both pages |
| Page restructured into Scoreboard and Commentary per part; "The question" section removed | "How this app was built" |
| Headline sentences worded by the backend from the run's numbers | Backend |

**Unchanged**: the agent's nodes, edges, prompts and scoring (display data such as row grouping and the agent's final model is added, with no change to how anything is scored); the data and its preparation; the run gate and limits; the recipe-agent app; the main site; Feedback link behaviour; the "Who built this" section (feature 019).

## Clarifications

### Session 2026-10-22

- Q: What happens to a visitor's live run when they reload the page? → A: It lasts only until the page is reloaded or left; the recorded run then shows again.
- Q: When no language model was reachable, what does the Scoreboard card show? → A: The plain search's average miss beside the TV's, labelled "Brute-force search" in place of "AI agent"; the "tries" and "0 numbers made up by the AI" facts are dropped, and the verdict's agent bar reads "not run".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand the result in seconds (Priority: P1)

A visitor opening the main page on a phone sees a hero stating that an AI agent built its own prediction model and how it did against the TV projection, with a Scoreboard card of the agent's and the TV's average miss on a season the agent never saw.

**Why this priority**: It is the feature's purpose and the first impression for every visitor.

**Independent test**: Load the page with a recorded run and check the hero text, card figures and above-the-fold word count automatically; judge the look by eye.

**Acceptance Scenarios**:

1. **Given** the page loads, **Then** with no tab and no button pressed it shows the kicker "AN AI AGENT EXPERIMENT", an h1 worded by the backend, the lead sentence, the links "Watch it work" and "Try your own innings", and the Scoreboard card.
2. **Given** the recorded run, **Then** the card shows the test year, the number of unseen innings, the agent's and the TV's average miss, the number of tries, "0 numbers made up by the AI" and the gap to the TV, all from the run's final test; "tries" counts every proposal the agent made, rejected ones included.
3. **Given** the brute-force search beat the agent on validation (so it became "our pick"), **Then** the hero and its Scoreboard card still show and judge the agent's own model, and the pick appears nowhere in the Scoreboard.
4. **Given** each result case (the agent's own model beats the TV by the goal margin; beats it by less; does not beat it; no language model), **Then** the h1 is the matching sentence from the design, judged against the goal on the agent's own model, and never claims more than the run's numbers.
5. **Given** the hero showing the recorded run, **Then** a line under the card says it comes from a recorded run, with date and model, and that "Run it live" shows the visitor's own.
6. **Given** the hero's Commentary (dark panel), **Then** it is closed by default and holds how good the TV is on past innings, the goal, and who does what.
7. **Given** a phone-width screen of 390 × 664 px (LinkedIn's in-app browser), **Then** the hero's order is kicker, h1, Scoreboard card, lead, links, the header fits one row, and the h1 and both average-miss figures are visible without scrolling.

---

### User Story 2 - Watch the agent think without pressing anything (Priority: P1)

A visitor scrolls to "Watch it think" and the recorded run plays on its own, round by round, with each idea, the agent's own reasoning, its score and a status. They can replay it or run it live.

**Independent test**: Scroll the section into view with a recorded run; check the rounds appear, the replay and live controls, and reduced-motion behaviour automatically.

**Acceptance Scenarios**:

1. **Given** the section first scrolls into view, **Then** the recorded run plays at normal speed with no button press.
2. **Given** `prefers-reduced-motion: reduce`, **Then** nothing animates and the finished run is shown.
3. **Given** a playing run, **Then** the loop strip shows the four steps and the repeat, and the round feed adds a row per round with the idea in plain words, the agent's reasoning exactly as written, the score and one status (first score, new best, no better, code rejected with the reason, agent finished).
4. **Given** "▶ Watch the recorded run", **Then** the run on the page (the recorded run, or the visitor's finished live run) plays again from the start, with no language model called and no run limit used; while it plays the button reads "❚❚ Pause" and pauses it.
5. **Given** "Run it live with your choice of AI", **Then** a panel under the toolbar offers the language model picker (names and notes from the backend, default first), the note that runs can differ, and "Start live run"; the live run replaces the recorded one in every section once its final test arrives (scenario 13); the run gate, limits and failure messages behave as today.
6. **Given** the recorded run is shown or replayed, **Then** no run is started and the run limits are untouched.
7. **Given** the toggle "Show the full agent graph", **Then** it opens the four-row graph (once at the start / each round / the yardstick / once at the end), with nodes, stages and rows taken from the backend, a state card and the stage legend, and the node reached by the replay ringed; step, back, reset and speed controls are available only there.
8. **Given** a phone, **Then** the graph rows, loop strip and state card stack or wrap without sideways scrolling.
9. **Given** the player toolbar, **Then** it shows "▶ Watch the recorded run" (filled), "Run it live with your choice of AI" (outlined, exposing its expanded state and opening the live-run panel), the label "Recorded {date} · {model}" (after a finished live run, "Your live run · {model}"), and the line "Lower score = closer predictions (average runs off)".
10. **Given** a run playing back, **Then** the button reads "❚❚ Pause" and pausing works by mouse, touch and keyboard; when the run finishes it reads "▶ Watch again"; after a finished live run it reads "▶ Watch your run again" and plays that run, until the page is reloaded.
11. **Given** the live-run panel, **Then** it is closed by default, opens directly under the toolbar and opens with "Show me everything", and holds a labelled "Language model" select filled from the backend's model list (names and notes only, never model ids; the default marked "(default)" and selected first; the chosen option's note linked to the select as its description).
12. **Given** the live-run panel is open, **Then** it shows the note that runs can differ each time while code still checks and scores everything the agent proposes, followed by the run length and the per-visitor hourly limit read from settings, and a "Start live run" button; it stays open during the run and shows the gate's message in the panel if the gate says no.
13. **Given** a live run in progress, **Then** the hero and the verdict keep showing the recorded figures until the live run's final test arrives, then switch to the live run's, and the line under the Scoreboard card becomes "From your live run with {model}."; **Given** a live run that fails or is refused by the gate, **Then** the recorded run stays in place everywhere.
14. **Given** a round arriving in the round feed, **Then** it is announced once through a polite live region as one short line, and the feed is not re-read as it grows.

---

### User Story 3 - Reveal everything at once, and share that view (Priority: P2)

A curious visitor presses "Show me everything" and every Commentary panel opens on both pages. The choice sticks and can be linked to.

**Independent test**: Press the switch, reload and move between pages; load a URL with the view parameter.

**Acceptance Scenarios**:

1. **Given** either page, **Then** the header has the breadcrumb, the switch, the page link and Feedback in one row that fits at 390 px wide; below 560 px the breadcrumb shortens to the app name and the switch, page link and Feedback become 44 px icon buttons whose accessible names are their full labels (Feedback keeps "(opens the GitHub issues page in a new tab)").
2. **When** the switch is pressed, **Then** it exposes its pressed state, its label becomes "Simple view", and all Commentary panels open; pressing again closes them.
3. **Given** the choice was made, **Then** it is remembered for the visitor and carried to the other page; if storage is unavailable the page still works.
4. **Given** a URL with `?view=everything`, **Then** the page loads in the open state.
5. **When** a Commentary panel opens, **Then** its content appears below its toggle and the reader's position does not jump.
6. **Given** "Show me everything", **Then** the Scorebook stays closed.

---

### User Story 4 - Read the verdict and try my own innings (Priority: P2)

A visitor sees how the agent did on the unseen season against the other methods, then enters a halfway score and sees the agent's prediction next to the TV's.

**Independent test**: Check the headline, bars and form against a run's results automatically.

**Acceptance Scenarios**:

1. **Given** the verdict, **Then** it shows the backend's h2, which judges the agent's own model against the goal, and the agent-vs-search sentence; four bars (AI agent, Brute-force search, TV projection, Average-total guess) in that order, with the average miss on the test season and a caption giving innings count and year; a rule-of-thumb card labelled "from the best model on the check seasons"; and a "Why you can trust this score" toggle with three trust bullets.
2. **Given** the agent and the search are less than 0.5 runs apart, **Then** the sentence says too close to call.
3. **Given** the verdict's Commentary, **Then** it holds three cards: check seasons vs the final test, how often each method is close, and what moves the final total.
4. **Given** "Your turn", **Then** there is a labelled input for each clue the agent's own final model uses (the brute-force search's model when no language model ran, and then labelled so), and Predict shows that model's prediction beside the TV's, computed in the browser as today.
5. **Given** a run with no language model, **Then** the verdict's agent bar reads "not run" and the other three bars still show.
6. **Given** the "Check seasons vs the final test" Commentary card, **Then** it is the only place that shows the pick (the winner on validation, "our pick") and its existing goal verdict, with both methods' scores on the check seasons and the final test.

---

### User Story 5 - Dig into the full detail on demand (Priority: P3)

A data scientist opens the Scorebook and reaches every model tried, the step-by-step agent graph, the data grid and the how-it-was-built page.

**Independent test**: Open each Scorebook card and check its content and focus handling.

**Acceptance Scenarios**:

1. **Given** the Scorebook, **Then** it shows four cards: Every model tried, The agent graph step by step, The data, How this app was built.
2. **When** a card is opened, **Then** its panel appears full width below the cards, only one panel is open at a time, and its close button returns focus to its card.
3. **Given** Every model tried, **Then** it shows the ranked candidate list and both brute-force grids, unchanged in content; The data shows the data grid with summary, filters and CSV download, fetched only when first opened; the graph card opens and scrolls to the full graph; the last card goes to the how-it-was-built page.
4. **Given** the old links `#working`, `#found`, `#final-test`, `#try-your-own` and `#data`, **Then** each lands on its new place (`#data` opens the Scorebook's data panel).

---

### User Story 6 - Understand how the app was built, simply (Priority: P2)

A visitor on the "How this app was built" page sees a hero, then each part with a headline and a visual, with the detail in Commentary.

**Independent test**: Check the sections, counts and Commentary state automatically.

**Acceptance Scenarios**:

1. **Given** the page, **Then** the header, switch, Commentary style and URL match the main page's, and "← Back to the app" links to the main page.
2. **Given** the hero, **Then** it shows the kicker, the h1 "The language model chooses. Code does every number.", the lead, four facts (agent steps, language-model steps, clues, innings) counted from the backend, the clue catalogue (19 clues) and the manifest, and jump links.
3. **Given** the parts (the big picture, 1 · The data, 2 · Pressing Play, 3 · Inside the agent, 4 · What you see, 5 · Shipping it), **Then** each shows its heading and visual, with the rest in closed Commentary; the exclusion table, the API calls table (scrolling inside its own box on a phone) and the gate limits sit in Commentary, the limits read from settings as today.
4. **Given** Part 3, **Then** it uses the same four-row graph and stage legend as the main page.
5. **Given** "Who built this", **Then** it is unchanged from feature 019.
6. **Given** the old "The question" section, **Then** it is gone.

---

### User Story 7 - Share the page on LinkedIn (Priority: P3)

When the main page link is posted, LinkedIn shows a title and description that match the hero.

**Independent test**: Fetch the page's raw HTML without running scripts and check the preview tags automatically.

**Acceptance Scenarios**:

1. **Given** the main page's raw HTML, **Then** it has title, description, URL and summary-card tags as fixed copy in the page (LinkedIn's crawler does not run scripts), worded for the winning case, and no image tag until artwork exists.
2. **Given** a run whose result is not the winning case, **Then** the preview tags are unchanged; they never depend on the run.

---

### Edge Cases

- No language model available: the hero shows the plain-search headline; the Scoreboard card shows the plain search's average miss beside the TV's, labelled "Brute-force search" instead of "AI agent", without the "tries" and "0 numbers made up by the AI" facts; the verdict's agent bar reads "not run".
- The recorded run is missing or fails to load: the page says so and offers "Run it live"; other sections degrade without error.
- A live run fails or is stopped by the gate: the recorded run stays visible everywhere, today's failure messages show, and the gate's message appears in the live-run panel.
- A live run in progress: the hero and verdict keep the recorded figures until the live final test arrives; if it never arrives they never change.
- The data is rebuilt but the run is not re-recorded: a check fails, so the stale recorded run is not shipped.
- A rejected proposal: it still counts as a try.
- Reload, or navigate away and back, after a live run: the recorded run shows again; the live run is gone.
- Storage blocked (for example a private window): the switch works for the current page view only.
- Reduced motion: no animated replay; the finished run is shown.
- 390 × 664 px (LinkedIn's in-app browser): the first screen shows the h1 and both average-miss figures; no horizontal page scroll; wide tables scroll in their own box; touch targets at least 44 px.
- Dark theme: all new text, panels and the graph meet the same contrast as the rest of the page.
- A run whose winning model uses different clues: the Your turn inputs and "what moves the final total" follow the run.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The main page MUST be one scrolling page with sections in order: Hero, The problem, Watch it think (`#watch`), The verdict (`#verdict`), Your turn (`#try`), The Scorebook (`#scorebook`); the tab bar MUST be removed.
- **FR-002**: Each Scoreboard section MUST show a headline, a main visual and a short lead (the word-count test in FR-015 is the measure, not a sentence count), in the plain words listed in `design/README.md` (idea, clues, check seasons, brute-force search, average-total guess); technical terms appear only in Commentary and the Scorebook, introduced with the plain term beside them.
- **FR-003**: Every figure and data-dependent sentence MUST come from the backend (run results, reference data, goal), never typed into the page; the hero h1, Scoreboard card, verdict h2 and agent-vs-search sentence MUST be built by the backend, every Scoreboard headline MUST judge the agent's own model against the goal (`MARGIN_RUNS`), cover the four headline cases, and never claim more than the run's numbers; the pick (winner on validation) and its goal verdict MUST appear only in the "Check seasons vs the final test" Commentary card; "tries" MUST count every proposal the agent made, rejected ones included.
- **FR-004**: A recorded run, made once by the owner with the default model after the headline wording is final, and shipped as a static file with its date and model, MUST feed the hero, verdict and Scorebook from page load and play in Watch it think on first scroll into view; "▶ Watch the recorded run" MUST play back the run on the page (the recorded run, or the visitor's finished live run until reload) from saved events, calling no language model and using no run limit.
- **FR-005**: "Run it live with your choice of AI" MUST be a toggle button (expanded state exposed) that opens a live-run panel, closed by default and opened by "Show me everything", directly under the toolbar, containing a labelled Language model select filled from the backend's model list (names and notes only, default marked and selected first, note linked as its description), the "runs can differ" note with run length and hourly limit read from settings, and "Start live run"; the run gate, limits and failure messages MUST behave as today, with the gate's refusal shown in the panel. A live run MUST replace the recorded one throughout the page only once its final test arrives, until the page is reloaded or left, after which the recorded run shows again (live runs are not stored); until then, and if the run fails or is refused, the recorded figures stay, and the line under the Scoreboard card reads "From your live run with {model}." once it switches.
- **FR-006**: Both pages MUST have a header with breadcrumb, "Show me everything" switch (pressed state exposed, at least 44 px tall, label "Simple view" while on), page link and Feedback, fitting one row at 390 px (below 560 px: the breadcrumb shortens to the app name and the switch, page link and Feedback become 44 px icon buttons whose accessible names are their full labels, Feedback keeping its current name); the choice MUST persist per visitor, carry between pages, work without storage, and be settable by `?view=everything`.
- **FR-007**: Commentary panels MUST be closed by default, open via the global switch or a section's own toggle (exposing expanded state), open below their toggle without moving the reader, and be styled as specified (dashed panel with a COMMENTARY label; dark variant in the hero).
- **FR-008**: The agent graph MUST be drawn in four rows with nodes, stages and row membership taken from the backend structure, language-model nodes marked, the current node ringed during replay, a state card and the stage legend, and MUST be one shared component on both pages.
- **FR-009**: The Scorebook MUST offer the four cards, open one panel at a time, return focus on close, and fetch the data grid only when first opened; its model list, grids and data grid keep today's content.
- **FR-010**: The "How this app was built" page MUST be restructured as specified: hero with counted facts (agent steps, language-model steps, clues, innings), Scoreboard and Commentary per part, "The question" removed, "Who built this" unchanged, same URL.
- **FR-011**: Feedback MUST stay in both headers and footers exactly as in feature 018 (link, icon, new-tab behaviour, accessible name); both footers MUST end with "Questions or ideas? Leave feedback"; the main page footer carries the credit line from the design.
- **FR-012**: The main page MUST carry the LinkedIn preview tags (title, description, URL, summary card) as fixed copy in the page's HTML, worded for the winning case and independent of any run, without an image tag.
- **FR-013**: Old anchors MUST land on their new places as listed in Story 5.
- **FR-014**: The pages MUST have no horizontal scroll at 390 px, touch targets of at least 44 px and text contrast of at least 4.5:1 in light and dark themes, and MUST reuse existing theme tokens rather than add a separate look.
- **FR-015**: Word counts MUST meet the size targets (checked by a test): main page simple view ≤ 500 words (excluding the agent's quoted reasoning) and with everything open and the Scorebook closed ≤ 1,200; "How this app was built" simple ≤ 500 and everything open ≤ 1,200.
- **FR-016**: Existing checks affected by the restructure (tabs, section names, jump links, graph drawing, hero panel) MUST be updated, and all other checks MUST still pass.
- **FR-017**: Playback that starts by itself MUST have a visible pause: while a run plays, the control reads "❚❚ Pause" and pauses it; when finished it reads "▶ Watch again" (or "▶ Watch your run again" after a live run).
- **FR-018**: Each new round in the round feed MUST be announced once through a polite live region as one short line.
- **FR-019**: The recorded run file MUST carry a fingerprint of the data manifest, and an automated check MUST fail when the data is rebuilt and the run has not been re-recorded.
- **FR-020**: At 390 × 664 px the hero MUST be ordered kicker, h1, Scoreboard card, lead, links, so the h1 and both average-miss figures are on the first screen.
- **FR-021**: The agent's own refitted model (clues, coefficients, intercept) MUST be emitted with the final test, without changing any scoring; "Your turn" MUST predict with it (with the brute-force search's model when no language model ran, labelled accordingly), while the rule of thumb and "What moves the final total" stay with the pick and are labelled "from the best model on the check seasons".
- **FR-022**: Every section and every Scorebook panel MUST render from the recorded run file alone, making no API call except the existing read-only ones.

### Key Entities

- **Recorded run**: the events a live run would send, plus its date, model name and a fingerprint of the data manifest it was recorded against.
- **Headline set**: the hero h1, Scoreboard card, verdict h2 and agent-vs-search sentence, worded from the agent's own results and the goal.
- **Pick**: the method that wins on the check seasons, with its goal verdict; shown only in the "Check seasons vs the final test" Commentary card.
- **Detail level**: Scoreboard, Commentary or Scorebook, plus the visitor's remembered choice of simple or everything.
- **Agent graph structure**: nodes, their stages and their rows, supplied by the backend.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor on a 390 × 664 px screen sees the result headline and both average-miss figures without scrolling or pressing anything.
- **SC-002**: The main page in simple view has no more than 500 words, and no more than 1,200 with everything open and the Scorebook closed; the how-it-was-built page meets the same limits.
- **SC-003**: A visitor sees the agent work through a run with zero button presses.
- **SC-004**: Any visitor can reach all Commentary in one action, and a shared link can open that view directly.
- **SC-005**: Any number of visitors replaying the recorded run uses none of the live run allowance.
- **SC-006**: 100% of headline cases state nothing the run's numbers do not support.
- **SC-007**: At 390 px there is no horizontal page scroll, all touch targets are at least 44 px and contrast is at least 4.5:1 in both themes.
- **SC-008**: Every detail available before this feature (model list, grids, data grid and download, graph step-through, tables) is still reachable.
- **SC-009**: The shipped recorded run always matches the current data: 100% of data rebuilds without a re-recording fail the check.
- **SC-010**: Playback can be paused at any moment, and each round is announced to a screen reader exactly once.
- **SC-011**: With the run endpoint unavailable, the whole page and all Scorebook panels still render from the recorded run file.

## Assumptions

- The design's three open questions get these defaults: only the global switch plus the two named section toggles (no extra per-section "More" toggles); the three non-winning headlines use the draft wording; the recorded run uses the default model, is recorded after the headline changes, and must be re-recorded whenever the data is rebuilt (enforced by the fingerprint check, FR-019).
- The page URL `/under-the-hood.html` is kept so existing links work.
- The LinkedIn preview image is designed separately and is out of scope.

## Out of Scope

The agent, its graph, prompts and scoring; the data and its preparation; the run gate and limits; the recipe-agent app; the main site; the preview image artwork.
