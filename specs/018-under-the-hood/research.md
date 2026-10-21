# Research: Under the Hood page and header links

Each decision records what was chosen, why, and what else was considered.

## R1. Live figures come only from existing routes

- **Decision**: Fetch `GET /api/data` and `GET /api/reference` once, in parallel, when the page loads. Use `/api/data` `summary` (headline rows "Innings", "Dates", "Downloaded from Cricsheet"; sections "Innings per competition", "Test population" and "Excluded, and why") and `/api/reference` (`training.first_year`, `last_year`, `innings`; `figures.know_nothing` and `figures.broadcaster` `average_miss` and signed `bias`; `goal.margin_runs`).
- **Why**: The brief forbids a new route. These two already carry every figure that can be kept correct.
- **Dropped because not served**: "Matches read" per competition (the counts table keeps innings kept plus the total), the season count ("45 seasons" becomes the served date range), season sizes, the 0.75 correlation, the stage 7 example run.
- **Alternatives**: a new `/api/about` route (out of scope); typed text with an "as of" date (goes stale); build-time generation from the CSV and manifest (adds a build step and a second source of truth).
- **Lookup rule**: figures are found by section title and row label in the summary. Values arrive as display strings ("5,209", a date range); exclusion counts are parsed back to numbers only to sum the "drops N matches" total. Nothing is parsed out of sentences or out of labels that carry years.
- **Payload**: `/api/data` carries every innings row (about 5,200) as well as the summary. Accepted: it is edge-cached (`s-maxage=3600`), the browser may already hold it from the Data tab, and no new route is allowed. The page reads only `summary`.

## R2. Years are never typed into the page

- **Decision**: The check years, test year and training ranges move with the data, so the page words them generically: "the three seasons before the latest", "the latest season, kept for one final test". The stage 2 table becomes role and "learns from" in words. The reference period comes live from `/api/reference.training`.
- **Why**: The server's "How the years are used" labels embed years; parsing them would break silently when their wording changes.
- **Alternatives**: parse the labels (fragile); add the years to a route (no new route).

## R3. Exclusion explanations are the page's own copy

- **Decision**: A small map from the server's `EXCLUSION_LABELS` text (`backend/linreg/data_table.py`) to the page's explanation: "Rain-affected (DLS)", "No result", "Innings ended before 10 overs", "Reduced overs", and also "Women's matches", "Super overs", "No first innings". A label with no entry shows its label and count only. Reasons with a zero count are not served, so are not shown.
- **Why**: Explanations are prose, not data. A unit test pins the map to the known label set so a renamed label is noticed.
- **Alternatives**: hard-code the four reasons and counts (stale); serve explanations from the server (no new route).

## R4. Render first, fill after, fail soft

- **Decision**: All text is in the HTML. Each live figure is an element with a `data-figure` key, filled with `textContent` after the fetches. On any failure (network, non-200, missing key) every unfilled figure reads "not available right now"; a sentence that holds two or more figures is wrapped in `data-figure-group` and, if any of its figures is missing, is replaced whole by "These figures are not available right now." The two fetches fail independently.
- **Why**: The page is useful with no server; nothing is injected as HTML; no wrong figure is ever shown.

## R5. Second Vite entry and routing

- **Decision**: `web/under-the-hood.html` is added to `build.rollupOptions.input` in `web/vite.config.ts` beside `index.html`; Vercel serves `web/dist/under-the-hood.html` as a static file. Links use `/under-the-hood.html`. **No `cleanUrls`** in `vercel.json`.
- **Why**: `cleanUrls` would change how every static file is addressed and is not needed; the dev server and the Playwright server already serve `/under-the-hood.html`. `vercel.json` stays unchanged; its only rewrite catches `/api/(.*)`, so the page is not shadowed.
- **Check**: `npm run build` must write both pages.

## R6. One shared stylesheet

- **Decision (as built)**: theme.css also holds the header/footer link styles (`.about-link`) and the VALIDATION/TEST pill styles, moved out of `index.html` so both pages share one copy; `tests/unit/chart-colours.test.ts` now reads the tokens from `theme.css`.
- **Decision**: Move the `:root` colour tokens, the dark-theme overrides and the base styles (box-sizing, body, main, headings) from the inline `<style>` of `web/index.html` into `web/src/page/theme.css`, linked from both pages (Vite bundles it). Everything else stays inline in `index.html`. The new page adds `under-the-hood.css`.
- **Why**: One source for tokens (spec: same tokens, themes and 1100 px width). The unchanged existing e2e suite plus a before/after screenshot in both themes guard "no change to the main page".
- **Alternatives**: duplicate the tokens (two sources); `@import` in the inline style (not bundled).

## R7. Header links

- **Decision**: A `<nav aria-label="About this app">` beside the breadcrumb nav inside one flex row (`justify-content: space-between; flex-wrap: wrap`). Inline stroke SVG icons (`currentColor`, `aria-hidden="true"`). Feedback: `target="_blank" rel="noopener"` with an accessible name of "Feedback (opens the GitHub issues page in a new tab)". The markup is static HTML, so it is present on every tab before any script runs.
- **Touch targets**: `min-height: 44px` by padding, 14 px semibold, hover `--surface`, 3 px `--accent` focus outline.
- **New page**: the Feedback link appears twice (top bar and footer), built from one small helper in the page's script folder or written in the static HTML; either keeps the target and name identical.

## R8. Stage panels

- **Decision**: Pure module `panels.ts`: `initial()`, `toggle(state, i)`, `setAll(state, open)`, `allOpen(state)`, `toggleAllLabel(state)`. The headers and bodies are static HTML: each header is a `<button aria-expanded="false" aria-controls>` and each body a `hidden` region with `role="region"` and `aria-labelledby`; the DOM layer only wires them to the state, so the text and the buttons exist before any script runs. The all-toggle label follows `allOpen`: "Collapse all" only while all seven are open. The chevron rotates by a CSS transition removed under `prefers-reduced-motion: reduce`. State is in memory only.
- **Why**: Plain buttons plus `hidden` give the exact `aria-expanded` contract the tests need. `<details>` was considered but does not expose `aria-expanded` on its summary consistently across browsers.

## R9. Fixed wording kept as text

Checked against the code during planning: the six GET routes (models, catalogue, data, structure, run, reference); 24 grid settings (4 windows × 3 weightings × 2 training-innings choices); 6 rounds (`ROUND_CAP`); 100 test-population innings needed per check or test year (`MIN_CHECK_INNINGS`); run limits of 5 an hour and 300 a day (`run_gate.py` defaults); the 90-second function limit (`vercel.json`). The goal margin (3 runs) is read live from `/api/reference.goal.margin_runs` instead of typed. Still to confirm against the code when the copy is written: 12 graph steps, 19 features (14 + 5), 1 to 8 features per candidate, the "too close to call" 0.5 rule. Any claim that does not match is corrected in the copy.

## R10. Testing approach

- Vitest on pure code: `figures.ts` (responses to page figures, unknown and missing exclusion labels, failure to placeholder, bias direction wording) and `panels.ts`. No DOM library is installed, so DOM behaviour is Playwright.
- Playwright on the existing fake-model server: links on every tab, page content, panels, keyboard, reduced motion, live figures against the served JSON, route interception for failures, 360 px overflow, and the existing suite unchanged.
