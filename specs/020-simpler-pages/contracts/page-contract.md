# Contract: page structure, test ids and shared modules

What the tests and the two pages agree on. Existing ids not listed here are removed with their tab or kept as they were (see plan.md, Tests).

## Main page (`web/index.html`), in order

| Section | `id` | Key test ids |
|---|---|---|
| Header | – | `site-header`, `breadcrumb`, `view-switch`, `link-under-the-hood`, `link-feedback` |
| Hero | `hero` | `hero-kicker`, `hero-title`, `hero-lead`, `hero-links`, `scoreboard-card`, `scoreboard-agent`, `scoreboard-tv`, `scoreboard-facts`, `run-origin`, `hero-commentary` |
| The problem | `problem` | `problem-title`, `problem-tiles`, `problem-commentary` (holds `worm-card`) |
| Watch it think | `watch` | `loop-strip`, `player`, `watch-button`, `live-toggle`, `run-label`, `live-panel`, `model-select`, `model-note`, `live-start`, `live-message`, `round-feed`, `round-live-region`, `graph-toggle`, `graph-panel` |
| The verdict | `verdict` | `verdict-title`, `verdict-vs-search`, `verdict-bars`, `rule-of-thumb`, `trust-toggle`, `verdict-commentary` |
| Your turn | `try` | `tryit` (its existing field ids), `tryit-model-label` |
| The Scorebook | `scorebook` | `scorebook-card-models`, `scorebook-card-graph`, `scorebook-card-data`, `scorebook-card-built`, `scorebook-panel`, `scorebook-close` |
| Footer | – | `footer-attribution`, `link-feedback-footer` |

`<main>` wraps the sections. Text of the agent's reasoning carries `data-reasoning` so the word-count test can leave it out.

## Detail level

- `document.body.dataset.view` is `"simple"` or `"everything"`.
- Commentary panel: `class="commentary"`; open when `body[data-view="everything"]` or it has `data-open`. A toggle button has `aria-expanded` and `aria-controls` pointing at its panel and is kept in step on `viewchange`.
- `view-switch` is a `<button aria-pressed>`; its text is "Show me everything" or "Simple view".
- Storage key `linreg:view`; URL `?view=everything`.

## Header (both pages)

- At 560 px and above: breadcrumb, then the three items with visible text. Below 560 px: breadcrumb text is the app name only; the three items are 44 × 44 px icon buttons with `aria-label` set to the full label (Feedback: "Feedback (opens the GitHub issues page in a new tab)").
- Main page link text "How it was built" → `/under-the-hood.html`; built page link "← Back to the app" → `/`.

## Player

- `watch-button` text per [data-model.md](../data-model.md) Player state; it is a `<button>`; while playing it pauses.
- `live-toggle` is a `<button aria-expanded aria-controls="live-panel">`.
- `round-live-region` is `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, visually hidden; set once per new round.

## Graph component (`<graph-replay>`)

- Rows: `[data-row=<id>]`; nodes: `[data-node=<id>]` (unchanged ids); the current node has class `is-active` with a 3 px ring; language-model nodes `data-actor="llm"` with an "AI" tag.
- `view="structure"` shows no run controls (used by the built page).
- Internal controls (Back, Step, Reset, Speed, timeline) keep their existing `data-testid`s and exist only in the page's graph Commentary.

## Built page (`web/under-the-hood.html`)

Same header and detail level. Hero facts test ids: `fact-steps`, `fact-llm-steps`, `fact-clues`, `fact-innings`. Parts keep the ids `big-picture`, `data`, `pressing-play`, `agent`, `what-you-see`, `shipping`, `people`.

## Preview tags (raw HTML of `web/index.html`)

`<title>`, `meta[name=description]`, `meta[property=og:title|og:description|og:url|og:type]`, `meta[name=twitter:card]`; no `og:image`. No script is needed to read them.
