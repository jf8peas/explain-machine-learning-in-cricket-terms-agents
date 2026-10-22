# Simpler pages: the agent as the hero, detail on request

Design drafted 2026-10-22 in Claude Design, after tester and visitor feedback that the app is too complicated and too
dense. The first audience is John's LinkedIn contacts (data scientists, analysts, marketers, sales, finance), most
arriving from a post on a phone.

Files:

- `canvas/Main.dc.html`: the main page, simple view. Its "Show me everything" button works.
- `canvas/Everything.dc.html`: the main page with everything open (it mounts `Main` with `startAll`).
- `canvas/Built.dc.html`: the "How this app was built" page, simple view.
- `canvas/BuiltEverything.dc.html`: the same page with everything open.
- The canvas itself (private to John): https://claude.ai/artifact/4M3FePB6WaY3ZZizw2v8N6

**This file is the specification; where it and the canvas differ, this file wins.** The canvas uses its own inline
styles and a fake-model run's numbers. The build reuses the shipped pages' classes and `theme.css` tokens (light and
dark), and every number and data-dependent sentence comes from the API, as today. Nothing in the canvas is to be typed
into `web/index.html` as fixed figures.

## The idea in one line

Every view has three levels of detail, named in cricket terms:

| Level | Who it is for | Where it lives |
|---|---|---|
| **Scoreboard** | everyone, at a glance | always shown: per section one headline, one visual, at most one sentence |
| **Commentary** | the curious | inline panels that open with **Show me everything** (or a section's own toggle) |
| **Scorebook** | data scientists | the full reference views, opened from the Scorebook section at the foot of the page, never inline |

The hero is **the agent**: that it works through a regression problem by itself and predicts a number well.

## What changes

1. **The main page becomes one scrolling page.** The tab bar (Data, The Run, Model Selection, Hold-Out Test, Try your
   own innings) is removed. The sections, in order: Hero, The problem, Watch it think, The verdict, Your turn, The
   Scorebook.
2. **A recorded run plays by default.** Visitors no longer have to press Play, and a burst of LinkedIn traffic does
   not use up the run limits. "Run it live" stays, with the model picker.
3. **A "Show me everything" switch** in the header of both pages opens every Commentary panel at once.
4. **The agent graph is redrawn** in four rows (once at the start / each round / the yardstick / once at the end) so
   it reads on a phone. It sits in Commentary.
5. **"How this app was built"** is restructured the same way: Scoreboard headline and visual per part, the rest in
   Commentary.
6. **Feedback** stays in the header of both pages and in both footers.

## Header (both pages)

One row that fits at 390 px: breadcrumb on the left; on the right the **Show me everything** switch, then the
page link, then **Feedback**.

- **Show me everything** is a `<button aria-pressed>`; its label becomes **Simple view** while on. Pill style, at least
  44 px tall. The choice is remembered per visitor in `localStorage` (wrapped in try/catch; the page works without it)
  and carried between the two pages. `?view=everything` in the URL turns it on, so a post or comment can link straight
  to the detailed view.
- Below 560 px the breadcrumb shortens to the app name, and the switch, page link and Feedback become 44 px icon buttons
  whose accessible names are their full labels (Feedback keeps "Feedback (opens the GitHub issues page in a new tab)").
- Main page link: **How it was built** → `/under-the-hood.html` (the URL is kept so existing links work; the label
  changes from "Under the hood").
- "How this app was built" page link: **← Back to the app** → `/`.
- **Feedback**: unchanged from feature 018: speech-bubble icon, "opens elsewhere" arrow,
  `https://github.com/jf8peas/explain-machine-learning-in-cricket-terms-agents/issues`, `target="_blank"`,
  `rel="noopener"`, accessible name "Feedback (opens the GitHub issues page in a new tab)".
- Both footers end with "Questions or ideas? Leave feedback", linking to the same page.

## Main page

### Wording rules (Scoreboard level)

- About 40 words above the fold per section; one idea per sentence.
- Plain words at Scoreboard level: **idea** (not candidate model), **clues** (not features), **check seasons** (not
  validation), **brute-force search** (not the rival / forward selection), **average-total guess** (not know-nothing
  guess). Commentary and the Scorebook may use the technical term, introduced once with the plain one beside it, e.g.
  "check seasons (validation)".
- Whole runs or one decimal in Scoreboard numbers; two scores less than 0.5 runs apart are "too close to call", as now.

### 1. Hero (dark band)

- Kicker: **AN AI AGENT EXPERIMENT**.
- h1, worded by the backend from the run's result (see "The headline"). For a run where the agent beats the TV by at
  least the goal margin: **"An AI agent built its own prediction model. Then it beat the TV."**
- Lead: **"Halfway through a T20 innings, where will it finish? The agent chose the clues, code did the maths, and it
  was tested on a season it had never seen."**
- At 390 × 664 (LinkedIn's in-app browser) the order is kicker, h1, Scoreboard card, lead, links, so the h1 and both
  average-miss figures are on the first screen.
- Two links: **Watch it work** (to `#watch`, filled) and **Try your own innings** (to `#try`, outlined).
- **Scoreboard card**: kicker "SCOREBOARD · {test year} SEASON, {n} UNSEEN INNINGS"; two big numbers, the AI agent's
  and the TV projection's average miss on the test season; under them three facts: tries ("5 tries"; every proposal the
  agent made, rejected ones included), "0 numbers
  made up by the AI", and the gap to the TV ("3.5 runs closer than the TV"). All from the run's `final_test`.
- Every Scoreboard headline (hero h1, Scoreboard card, verdict h2) judges the agent's own model against the goal
  (`MARGIN_RUNS`), never the pick's: the agent is the hero even when the brute-force search wins on validation and
  becomes "our pick". The pick and its existing goal verdict appear only in the "Check seasons vs the final test"
  Commentary card.
- With no language model, the card shows the plain search's miss beside the TV's, labelled "Brute-force search", without
  the tries and "0 numbers" facts; the verdict's agent bar reads "not run".
- Commentary (dark panel in the band): how good the TV is on past innings (its average miss against the average-total
  guess's, the number of innings and years, and its bias), the goal (beat the TV by at least `MARGIN_RUNS`), and who
  does what (language model chooses the clues; code fits and scores). All from `/api/reference` and `goal.py`, as the
  current hero's panel is.

### 2. The problem

- Kicker **THE PROBLEM**; h2 **"The TV projection is usually about {usual miss} runs out."**; one sentence: "It just
  multiplies the run rate by 20. Can an agent, left to itself, learn something smarter from {innings} past innings?"
- Visual: three tiles from the example innings: score after 10 overs, what the TV said, the final total; caption with
  the match (teams, ground, month and year).
- Commentary: today's run-by-over chart with the zoom on the finish (feature 017), unchanged, with its caption.

### 3. Watch it think (the centrepiece, `id="watch"`)

- Kicker **WATCH IT THINK**; h2 **"Each round, the agent proposes an idea. Code tests it."**
- **Loop strip**: four pills, "1 · Agent proposes clues" (highlighted as the AI step), "2 · Code checks",
  "3 · Code fits a regression", "4 · Code scores it", then "↺ repeat until no better". Wraps on a phone.
- **Player card**:
  - Toolbar: **▶ Watch the recorded run** (filled), **Run it live with your choice of AI** (outlined, a
    `<button aria-expanded>` that opens the live-run panel), a small label "Recorded {date} · {model}" (after a finished live run "Your live run · {model}"), and the line
    "Lower score = closer predictions (average runs off)".
  - **▶ Watch the recorded run** plays back the run on the page: events already saved, no language model called, no
    run limit used. It is the recorded run by default, or the visitor's own live run once one has finished (until the
    page is reloaded). While playing, the button reads **❚❚ Pause** (a visible pause for content that starts by
    itself); when finished, **▶ Watch again**. After a live run its label is **▶ Watch your run again**.
  - Back, Step, Reset and Speed stay available but only inside the full-graph Commentary.
  - A visually hidden polite live region announces each new round once, in one short line; the feed itself is not a live
    region.
  - **Round feed**: one row per round as it arrives in the replay: "ROUND n", the idea in plain words (clue added, or
    the full clue list for a fresh start, plus the seasons choice), the agent's own reasoning in quotes (shown exactly
    as written, as now), the score, and a status tag: first score / new best / no better / code rejected: {reason} /
    agent finished.
  - Commentary under each round: its settings in plain words (seasons learned from, recency weighting, which innings).
  - Footer: "Best idea: {clues}, learning from {seasons}." and the toggle **Show the full agent graph ↓**.
- **Commentary above the player**: "What the agent decides" (the four parts of an idea and why code rejects one) and
  "How each idea is scored" (the learn / check / check / check / locked season strip, years from the data).
- **The full agent graph** (opened by its toggle or by Show me everything):
  - Four rows, each a light card with a small caps title and a note: ONCE, AT THE START (load_data → split → explore
    → baseline; "data preparation script ran beforehand"); EACH ROUND (propose_features → check_proposal → fit_model →
    evaluate, then "↺ continue · rejected → back to propose"; "up to 6 rounds; rejected ideas count"); THE YARDSTICK
    (grid_search; "runs when the agent stops"); ONCE, AT THE END (final_test → explain_in_cricket_terms →
    write_in_cricket_terms; "the test season is unlocked here").
  - Each node is a pill with its node name in the mono font and its numbered stage badge in the stage colour (feature
    005 colours). Language-model nodes have a dashed purple outline and an "AI" tag. The node the replay has reached
    has a 3 px accent ring.
  - Beside the rows (stacked below on a phone): a **Graph state** card (step number, current node, round, this idea's
    score, best so far, what happens next) and **The 8 ML stages** legend.
  - The node list, the stage of each node and the row each node belongs to come from `/api/structure`, not the page.
    Today's band-and-edge drawing is replaced.
- **Run it live with your choice of AI** opens a panel directly under the toolbar (indigo tint) with:
  - **Language model**: a labelled `<select>` filled from `/api/models` exactly as today's picker: each option's name,
    the default marked "(default)" and selected first, and the chosen option's note shown under it (linked with
    `aria-describedby`). Visitors see names and notes only, never model ids.
  - The note: "Because a language model is involved, **runs can differ each time**. Code still checks and scores
    everything it proposes." followed by how long a run takes and the per-visitor hourly limit, both read from
    settings, not typed (the model list endpoint sends them).
  - **Start live run**. The live run replaces the recorded one in every section once its final test arrives (until then
    the hero and verdict keep the recorded figures; a failed or refused run leaves the recorded run in place); the run gate, limits and failure
    messages behave as today. The panel stays open during the run and shows the gate's message if it says no.
  - The panel is closed by default and opens with Show me everything.

### 4. The verdict (`id="verdict"`)

- Kicker **THE VERDICT**; h2 worded by the backend, e.g. **"On a season it never saw, the agent beat the TV by 3.5
  runs."**; one sentence comparing the agent with the brute-force search, worded by the backend: "matched … using just
  {rounds} tries" when too close to call, otherwise "beat" or "finished {x} runs behind".
- **Bars**: AI agent, Brute-force search, TV projection, Average-total guess: average miss on the test season, in that
  order, with the caption "Average runs off the real total, {n} innings from {test year}. Shorter is better."
- **Rule of thumb** card (green tint): the existing rule of thumb from the takeaways, labelled "from the best model on
  the check seasons".
- **Why you can trust this score** toggle (opens on its own, or with Show me everything): three bullets: the agent
  chose using the check seasons only; the test season stayed locked and was used once; a plain grid search ran
  alongside as a yardstick. Years from the data.
- Commentary, three cards: **Check seasons vs the final test** (both methods' scores on each, with the note that the
  best of many tries slips on a new season); **How often is it close?** (share within 10 runs and the bias in words for
  each of the four methods); **What moves the final total** (runs per typical difference for each clue in the pick's
  model, labelled "from the best model on the check seasons").

### 5. Your turn (`id="try"`, dark card)

- Kicker **YOUR TURN**; h2 **"Give it a halfway score."**; "See the agent's prediction next to the TV's."
- The current Try-it form, restyled: a labelled input for each clue the agent's own final model uses (the brute-force search's model, labelled so, when no
  language model ran; the set changes with the run; the canvas shows runs and wickets only as an example) and **Predict**; results: the agent's
  prediction beside the TV's. Prediction runs in the browser as today.

### 6. The Scorebook (`id="scorebook"`)

- Kicker **THE SCOREBOOK**; h2 **"For the data scientists: every detail."**; four cards:
  - **Every model tried**: opens the ranked list of every candidate model and the brute-force search's two grids
    (today's Model Selection sections 5 and 6), unchanged in content.
  - **The agent graph, step by step**: opens the full graph (the same panel as in Watch it think) and scrolls to it.
  - **The data**: opens today's data grid (feature 002) with its summary, filters and CSV download; `/api/data` is
    fetched only when it is first opened.
  - **How this app was built**: goes to `/under-the-hood.html`.
- One Scorebook panel open at a time, full width below the cards, with a close button that returns focus to its card.
- Footer: "Built by John Fong · Tested by Alesja Tanabe · Ball-by-ball data from Cricsheet · Questions or ideas? Leave
  feedback".

### The headline (backend)

Add the hero h1, the verdict h2 and the agent-vs-search sentence to the words the backend already builds from
`goal.py` (alongside the verdict and the hero text), so the page shows them as sent. Cases to cover:

| Case | Hero h1 |
|---|---|
| Agent beats the TV by at least `MARGIN_RUNS` | "An AI agent built its own prediction model. Then it beat the TV." |
| Agent beats the TV by less than the margin | "An AI agent built its own prediction model. It edged the TV, just short of the goal." |
| Agent does not beat the TV | "An AI agent built its own prediction model. The TV held on this time." |
| No language model (grid search only) | "The agent couldn't reach its language model, so a plain search ran alone." |

The wording of the last three is a draft; the rule is that the headline never claims more than the run's numbers.

### The recorded run

- A real run with the default model is recorded once by the owner (a script beside `scripts/time_models.py`, after the headline wording is final) and
  shipped as a static file the page loads, holding the same events `/api/run` streams and the run's date and model
  name, plus a fingerprint of the data manifest; a check fails when the data is rebuilt and the run is not re-recorded.
  The replay buffer plays it exactly as it would a live stream.
- It plays on its own when Watch it think first scrolls into view, at the normal speed. With
  `prefers-reduced-motion: reduce` it does not animate: the page shows the finished run.
- The hero, the verdict and the Scorebook show the recorded run's results from page load. A small line under the
  Scoreboard card says "From a recorded run on {date} with {model}. Run it live to see your own."
- Recording does not touch the run limits; replaying it makes no API call except the existing read-only ones.

## "How this app was built" page

Same header, wording rules, Commentary panels and Show me everything switch as the main page; same URL.

- **Hero (dark band)**: kicker **HOW THIS APP WAS BUILT**; h1 **"The language model chooses. Code does every
  number."**; lead "A LangGraph agent runs in a Python function on Vercel. A small web page replays it step by step.
  The data is real ball-by-ball cricket from Cricsheet."; four facts: agent steps, steps that use a language model,
  clues (19, from the catalogue), innings (counts from `/api/structure`, the catalogue and the manifest, not typed); jump links (Big picture, 1 · Data,
  2 · Pressing Play, 3 · The agent, 4 · What you see, 5 · Shipping, Who built this).
- **The big picture**: h2 "Three parts, two helpers."; three boxes: Your browser ⇄ A Python function on Vercel (tags:
  OpenRouter · language model, Upstash Redis · run limits) ← Two data files. Commentary: each part's one-line role and
  folder (`web/`, `api/ + backend/linreg/`, `data/`).
- **1 · The data**: h2 "Every innings becomes one row of 19 possible clues."; three number tiles (innings and years,
  clues, innings judged on). Commentary: the 14 measured and 5 worked-out clues, why 0/1, and one line on
  `scripts/prepare_data.py`. Today's exclusion table moves to Commentary.
- **2 · Pressing Play**: h2 "Only Play runs the agent. Each step streams back as it finishes."; five numbered tiles:
  Vercel, FastAPI, The gate, The agent, The stream. Commentary: the API calls table (in a horizontally scrolling box on
  a phone) and the gate's limits (read from settings, as now).
- **3 · Inside the agent**: h2 "Twelve steps, each tagged with one of the eight stages of any ML project."; the same
  four-row graph and stage legend as the main page (one shared component). Commentary: one card per stage (1, 2, 3, 4,
  5–6, 7, 8) with today's stage detail cut to two or three sentences each.
- **4 · What you see**: h2 "Your browser keeps every step, so you can pause and rewind without running the agent
  again."; three cards describing Scoreboard, Commentary (dashed outline) and Scorebook. Commentary: events replayed
  at a readable pace, "too close to call", and the reusable components.
- **5 · Shipping it**: h2 "One folder, one Vercel project, app 1 of 8."; three cards: The code, Deployment, The
  bigger site.
- **Who built this**: unchanged from feature 019 (copy, links and accessible names exactly as specified there).
- Today's "The question" section is removed; the main page now covers it.

## Commentary panels

- A light panel (`--surface` tint) with a dashed border and a small filled **COMMENTARY** label; in the dark hero band
  the same panel in the dark palette.
- Closed by default; opened by Show me everything or by the section's own toggle (Show the full agent graph, Why you
  can trust this score). A toggle is a `<button aria-expanded>`.
- Opening one does not move the reader: content opens below the toggle, never above.

## Phone width (390 px)

- No horizontal page scroll. The hero, the Scoreboard card, the problem tiles, the loop strip, the round rows, the
  graph rows, the bars and the Scorebook cards all stack or wrap. Wide tables scroll inside their own box.
- Touch targets at least 44 px.

## LinkedIn link preview

- `og:title`, `og:description`, `og:url` and `twitter:card` on the main page as fixed copy in the page (LinkedIn's
  crawler does not run scripts), worded for the winning case.
- `og:image` (1200 × 627) is designed separately; until then the tags ship without it.

## Size targets (checked by a test)

| View | Today (after a run, all tabs) | Target |
|---|---|---|
| Main page, simple view (excluding the agent's quoted reasoning) | ~4,200 words | ≤ 500 |
| Main page, Show me everything (Scorebook closed) | — | ≤ 1,200 |
| "How this app was built", simple view | ~1,500 | ≤ 500 |
| "How this app was built", Show me everything | — | ≤ 1,200 |

## Old links

`#working` → `#watch`; `#found` and `#final-test` → `#verdict`; `#try-your-own` → `#try`; `#data` → `#scorebook` with
The data open.

## Out of scope

The agent, its graph, prompts and scoring; the data and its preparation; the run gate and limits; the recipe-agent
app; the main site at explain-machine-learning-in-cricket.vercel.app; the `og:image` artwork.

## Open questions

None. Settled in the spec: only the global switch plus the two named section toggles; the three non-winning headlines use
the draft wording above; the recorded run uses the default model and is re-recorded whenever the data is rebuilt or the
headline wording changes.
