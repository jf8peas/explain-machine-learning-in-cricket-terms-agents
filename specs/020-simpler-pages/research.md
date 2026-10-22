# Research: Simpler Pages

Decisions for [plan.md](plan.md). R1 to R6 resolve spec gaps A to F (all now written into [spec.md](spec.md)); R7 onward settle the design choices the plan depends on. Paths are under `apps/linear_regression/`.

## Spec gaps

### R1 (gap A): "Your turn" uses the agent's own model

- **Finding**: `final_test` (`backend/linreg/nodes.py`) already refits both best setups on every year before the test year (`scores["llm"]["fitted"]`, `scores["forward"]["fitted"]`) but writes only the *winner's* features, coefficients, intercept and `feature_iqr` to the top level of the state. The page's `modelFrom()` (`web/src/page/main.ts`) reads those, so today "Try your own innings" uses the pick, not the agent. With the hero now judging the agent (spec FR-003), a "Your turn" that predicts with the search's model would contradict the headline.
- **Decision**: `final_test` also writes `final["agent_model"] = {source, features, coefficients, intercept}`. `source` is `"agent"` when a language-model setup was fitted, otherwise `"search"` (the brute-force search's model stands in, and the page says so). The values are the ones already computed in `scores[...]["fitted"]`, rounded as the winner's are (`_r(c, 3)`), so scoring is untouched. The top-level `features`, `coefficients`, `intercept` and `feature_iqr` stay as they are (the pick's), because the rule of thumb and "What moves the final total" use them.
- **Rationale**: one new display field, no change to any score; the front end needs no second fit.
- **Alternatives**: refit in the browser (no: the data is not on the page); change the top-level fields to the agent's (no: it would silently change the rule of thumb and the drivers chart, and break `test_final_test`).
- **Labels**: "Your turn" says "the agent's model" or "the brute-force search's model"; the rule of thumb card and "What moves the final total" carry "from the best model on the check seasons".

### R2 (gap B): the header at phone width

- **Decision**: below 560 px the breadcrumb shows only the app name and the switch, page link and Feedback become 44 × 44 px icon buttons. Each keeps its full visible-label text as the accessible name (`aria-label`; Feedback keeps "Feedback (opens the GitHub issues page in a new tab)"). At 560 px and above the text labels show as in the design.
- **Rationale**: four labelled items do not fit one 390 px row at 44 px height; icons with full accessible names keep the target size, the name-contains-label rule (WCAG 2.5.3 applies to visible labels, and the icon buttons have none visible, so the name is free) and the one-row header. This extends feature 018's icon-hiding rule instead of reversing it.
- **Alternatives**: wrap onto two rows (rejected by the brief: one row at 390 px); a menu button (hides Feedback, which the feature 018 spec keeps visible).
- **Check**: a Playwright test at 390 px asserts all four items share one `boundingBox().y` row and each is at least 44 px square.

### R3 (gap C): what "Unchanged" means

- **Decision**: "unchanged" covers the agent's nodes, edges, prompts and scoring. Added display data is in scope: the row each node belongs to (`NODE_ROWS`), the agent's final model, the headline words, and the run limits in `/api/models`. `test_agent_run`, `test_final_test`, `test_grid_search` and `test_no_test_year_leak` keep asserting the same numbers.
- **Rationale**: lets the page be built from the API without touching anything a score depends on.

### R4 (gap D): FR-002 is measured by the word-count test

- **Decision**: a Scoreboard section has a headline, a main visual and a short lead. The test is the word count (FR-015), not a sentence count, because the design's own sections (for example the hero lead and the verdict) already run to two sentences.
- **Method** (fixed here so the test is not argued about later): visible `innerText` of `<main>`, on the recorded run's finished state, Scorebook closed, with the text of elements marked `data-reasoning` removed. Simple view ≤ 500 words, everything open ≤ 1,200. The header and footer are outside `<main>`.

### R5 (gap E): the toolbar label after a live run

- **Decision**: "Recorded {date} · {model}" becomes "Your live run · {model}" once a live run's final test has arrived (the same moment the hero and verdict switch, R9), and returns to the recorded label only on reload.

### R6 (gap F): everything renders from the file alone

- **Decision**: with `/api/run` blocked, every section and every Scorebook panel renders from `recorded-run.json` plus the existing read-only endpoints (`/api/structure`, `/api/reference`, `/api/catalogue`, `/api/models`, `/api/data` on first open of the data panel). No new endpoint is needed for display.
- **Check**: a Playwright test aborts `**/api/run*` and fails on any other non-listed request.

## Design choices

### R7: the four headline cases and where they are built

- **Decision**: a new `backend/linreg/headlines.py` (beside `hero_text.py` and `cricket_blocks.py`) builds, from the final test and the goal, `final["headlines"]`: `{case, hero_h1, verdict_h2, vs_search, scoreboard}`. It runs inside `final_test` so the words stream with the state and are stored in the recorded run. `goal.py` gains `agent_verdict()` beside `verdict()` (the pick's), both through the same `compare` and `MARGIN_RUNS`, so there is one definition of "reached the goal".
- **Cases** (decided on the agent's own displayed test miss versus the TV's, one decimal, as `goal.py` already does):

| `case` | When | Hero h1 |
|---|---|---|
| `beat` | agent beat the TV by at least `MARGIN_RUNS` | An AI agent built its own prediction model. Then it beat the TV. |
| `edged` | beat the TV by less than the margin | An AI agent built its own prediction model. It edged the TV, just short of the goal. |
| `held` | did not beat the TV | An AI agent built its own prediction model. The TV held on this time. |
| `no_llm` | no language-model setup was fitted | The agent couldn't reach its language model, so a plain search ran alone. |

- **Other words**: `verdict_h2` ("On a season it never saw, the agent beat the TV by 3.5 runs." and its `edged`, `held`, `no_llm` forms), `vs_search` ("matched … using just {tries} tries" when the two test misses are less than 0.5 apart, otherwise "beat" or "finished {x} runs behind"; absent for `no_llm`), and `scoreboard` (the card's labels and facts: rounds as "N tries" from `rounds_used`, which counts rejected proposals; "0 numbers made up by the AI"; the gap to the TV; for `no_llm` the card shows the search's miss labelled "Brute-force search" and drops the tries and "0 numbers" facts, per the clarification).
- **Shared fixture**: `web/tests/fixtures/headline_cases.json` holds, per case, the minimal final-test inputs and the expected words. pytest builds `final["headlines"]` from the inputs and compares; Vitest feeds the same inputs and expected words through `scoreboard.ts` (the page's pass-through and card layout) and checks the page shows exactly what was sent. This is the `miss_words_cases.json` pattern.
- **Rationale**: the page shows backend words as sent (README), and the claim cannot outrun the numbers because the case is computed from the same displayed figures.

### R8: the four-row graph (NODE_ROWS)

- **Decision**: `graph.py` gains `NODE_ROWS` (node to row id: `start`, `round`, `yardstick`, `end`) and `ROW_DEFS` (ordered id, title, note), and `check_rows(app, mapping, rows)` next to `check_stages` in `stages.py`'s style, raising on a node with no row, an unknown row, or a mapping key that is not a node. Like `check_stages`, it is called from a test (`tests/test_structure_rows.py`), not at import. `/api/structure` sends each node's `row` in `node_meta` and the ordered `rows` (with notes) in `structure_extras`. The "up to 6 rounds" note is built from `state.ROUND_CAP`, not typed.
- **Component**: `graph-replay` keeps its element, `buffer.ts`, `sse.ts`, `stages.ts`, `state-view.ts` and `legend.ts`. Its dagre drawing (`layout.ts`, `bands.ts`, `svg.ts`) is replaced by `rows.ts` (pure grouping) and `rows-view.ts` (HTML pills in flex rows). Rows are HTML, not SVG, so there is no measuring and the graph can live inside a closed Commentary panel. Dagre is no longer imported and is removed from `package.json` (a dependency removed, none added). The component holds no cricket or regression words: titles, notes, node names and stage names all come from the structure.
- **A "structure only" mode** (`view="structure"`) hides the run controls and panels, so the "How this app was built" page uses the same component with no run.
- **Alternatives**: keep dagre and reorder (cannot read on a phone, the stated reason for the redraw); draw rows in SVG (needs measuring while hidden).

### R9: the recorded run and live switching

- **File**: `web/public/recorded-run.json` = `{recorded_on, model_name, fingerprint, events:[...]}`. `events` are the `/api/run` `step` events exactly as streamed (`{step,node,summary,changes}`) plus the closing `done`. `scripts/record_run.py` (beside `time_models.py`) runs the real graph with the default model and writes it; `--fake --out PATH` records with the scripted fake model for tests.
- **Fingerprint**: SHA-256 of `data/manifest.json` plus the sizes of `innings.csv` and `overs.csv`, computed in `backend/linreg/fingerprint.py` and used by both the script and `tests/test_recorded_run.py`, which fails when the stored value differs from the current one (FR-019). The script records after the headline changes: the test also compares the stored `headlines` to the current builder, so a wording change without a re-record fails too.
- **Playing it**: `GraphReplay` gains `loadRun(events)` (reset the buffer, push the events, finish). The page's own toolbar calls `play()`, `pause()` and `restart()` on the element; the element's internal toolbar is shown only inside the graph Commentary. The hero, verdict and Scorebook read a `RunSource` (R10), not the element.
- **Switching** (spec Story 2 scenario 13): while a live run streams, `RunSource.current` stays the recorded run. It switches when the live stream has *received* its `final_test` step (a new `receivedState` in the replay-change detail), not when the paced display reaches it, as the spec says "arrives". A refusal (before the stream opens) or a failure (`failed`) leaves or restores the recorded run (`loadRun(recorded)` on failure).
- **Size**: the stream already carries the grid search cells, so the file may be large. Measure at recording; the plan's risk register has a gzip check and a cap (see plan).

### R10: one module for the current run

- **Decision**: `run-source.ts` (pure, unit-tested) holds `{kind: "recorded"|"live", model, date, events, state}` and the switching rules in R9. Everything that shows results (hero, verdict, Your turn, Scorebook) subscribes to it; only the player card reads the replay element. This keeps "render from the file alone" (R6) true by construction.

### R11: the detail level

- **Decision**: `detail-level.ts`, shared by both pages: `getLevel()` reads `?view=everything`, else `localStorage["linreg:view"]` (in try/catch, falling back to memory), `setLevel()` writes it, and the module sets `document.body.dataset.view = "simple" | "everything"` and fires `viewchange`. Commentary panels are shown by CSS (`body[data-view="everything"] .commentary, .commentary[data-open]`), so no panel needs JS to follow the switch. Toggle buttons update `aria-expanded` on `viewchange`. The switch button is `aria-pressed` with the label swapping to "Simple view". `?view=everything` wins over storage and is written to it. The Scorebook never opens from the switch.
- **Rationale**: one attribute on `<body>` is the brief; CSS-driven panels cannot get out of step with it.

### R12: the Scorebook reuses what exists

- **Decision**: "Every model tried" mounts `found/ranking.ts` and `found/grid.ts`; "The data" mounts `<data-grid>` through `data-tab.ts` and fetches `/api/data` on first open only; "The agent graph" opens the Commentary graph and scrolls to it; "How this app was built" is a link. `tab-set` stays in the repo (its README and `reuse-data.spec.ts` keep exercising it) but leaves the main page.

### R13: the live-run panel needs two numbers from the server

- **Finding**: the spec says run length and the hourly limit are "read from settings". Today the page shows neither (the variation note has no numbers), and `RunGate` reads `RUN_LIMIT_PER_HOUR` and `RUN_DEADLINE_SECONDS` privately.
- **Decision**: `RunGate.limits()` returns `{per_hour, deadline_seconds}` from the same `_number` reads the gate enforces, and `/api/models` adds it as `run: {per_hour, deadline_seconds}` beside `models`. Read-only, already cached (300 s). The page words it ("a run takes up to about {n} seconds; {m} live runs an hour per visitor").

### R14: preview tags and the missing production address

- **Decision**: `og:title`, `og:description`, `twitter:card` and `og:type` are fixed text in `web/index.html`, worded for the `beat` case and tested from the raw HTML (no script). `og:url` must be absolute; no production address is recorded in the repo (the README names none), so the plan keeps it as one constant in `index.html` that the owner sets, and a test asserts it is an absolute `https://` URL.

### R15: tries, announcements, motion

- **Tries**: `rounds_used` in the state already counts "proposals received, rejected ones included"; the card says "N tries". No new counting.
- **Live region**: one visually-hidden `role="status"` (`aria-live="polite"`, `aria-atomic="true"`) in the player; on each *new* round shown it is set to one line ("Round 3: no better, 1.4 runs worse."). The visible feed is not itself a live region, so it is not re-read as it grows. Back/jump re-renders do not announce.
- **Motion**: under `prefers-reduced-motion: reduce` the recorded run is jumped to its end on first view (`buf.jump(last)`), the button reads "▶ Watch again", and nothing animates.
- **Pause** (WCAG 2.2.2): the autoplaying control is a real button, `aria-label` unchanged while its text swaps "❚❚ Pause" / "▶ Watch again" / "▶ Watch your run again".

## Not resolved here (flagged in the plan)

- The production URL for `og:url` (R14) needs the owner.
- The recorded run must be made by the owner with a real key (`OPENROUTER_API_KEY`) after Phase 1; tests use a fake-model recording.
