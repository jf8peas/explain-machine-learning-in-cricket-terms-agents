# Under the hood: a "How this app was built" page and two header links

Design drafted 2026-10-21 in Claude Design. `main-header.html`, `main-header-phone.html` and `under-the-hood.html` are
pictures of the design, not something the page ships; open them in a browser to click through (the stage panels open
and close, and the links move between the two pictures). `canvas/` holds the design canvas's own source files, kept so
the design can be edited again. **This file is the specification; where it and the pictures differ, this file wins.**

## What changes

1. **Two new links on the main page**, in the header row above the tab bar, on every tab:
   - **Under the hood** (wrench icon) opens a second page, "How this app was built".
   - **Feedback** (speech-bubble icon plus an "opens elsewhere" arrow) opens
     `https://github.com/jf8peas/explain-machine-learning-in-cricket-terms-agents/issues` in a new tab.
2. **A new page, "How this app was built"**, that explains the app to a curious visitor: the question, the data, what
   happens when you press Play, the agent stage by stage, what the page shows, and how it is shipped. Its content is a
   condensed version of the "How the linear regression agent is built" slide deck.

Nothing else on the main page changes.

## The link names

- "Under the hood" is the label. It is short, an everyday idiom for "how it works inside", and fits beside the
  breadcrumb. The page itself is titled "How this app was built", so the longer phrase is not lost.
- "Feedback" is the label for the issues link. Its accessible name adds "(opens the GitHub issues page in a new tab)".

## Main page header

- One row: the existing breadcrumb on the left, the two links on the right (`justify-content: space-between`,
  `flex-wrap: wrap`). At phone width the links wrap onto their own row under the breadcrumb, aligned left.
- The links use the page's existing link colour (`--accent`) and 14 px semibold text, each with an 18 px stroke icon
  drawn inline (`currentColor`, `aria-hidden="true"`). Each link is at least 44 px tall (padding, not a larger font)
  and shows the `--surface` background on hover and a 3 px `--accent` focus outline.
- They sit in their own `<nav aria-label="About this app">`, separate from the breadcrumb nav.
- Feedback: `target="_blank"` and `rel="noopener"`.

## The "How this app was built" page

A second page of the same Vite app, built from its own HTML entry (for example `web/under-the-hood.html`, served at
`/under-the-hood.html`), using the same colour tokens, fonts, light and dark themes and 1100 px content width as the
main page. It needs no API call unless the open question below decides otherwise.

**Top bar**: "Back to the app" (left arrow icon) on the left, linking to the main page (`/`); Feedback on the right,
the same link as in the main header.

**Heading**: eyebrow "Under the hood · linear regression", h1 "How this app was built", and the lead "The question it
answers, the data it learns from, what happens when you press Play, and how the answer reaches the page."

**Jump links**: a row of pill links to the page's sections: The question, 1 · The data, 2 · Pressing Play,
3 · Inside the agent, 4 · What you see, 5 · Shipping it. They wrap at phone width.

**Sections, in order** (copy as in `under-the-hood.html`):

1. **The question**: one paragraph, three cards (The goal, The method, The show), and the rule "the language model
   chooses and words things, but every number comes from code".
2. **The big picture**: three cards (Your browser, A Python function on Vercel, Two data files) and one sentence on
   the preparation script and the two outside services.
3. **Part 1 · The data**: the preparation script and its four exclusion reasons beside the counts table; the 19
   candidate features (14 measured, 5 worked out, with the "Why 0/1?" note); the test population.
4. **Part 2 · Pressing Play**: the table of calls; one paragraph on FastAPI; the five numbered server steps, step 3 (the
   gate) highlighted with a filled number.
5. **Part 3 · Inside the agent**: the eight stages table; the agent's graph as three rows of step chips, each prefixed
   with its stage number, the two language-model steps filled; then **Stage by stage**.
6. **Part 4 · What you see**: one paragraph on streaming and replay; two cards, Model Selection (VALIDATION pill) and
   Hold-Out Test (TEST pill), reusing the existing validation and test pill styles; one closing sentence.
7. **Part 5 · Shipping it**: three cards (The code, Deployment, Part of a bigger site).
8. **Footer**: the Cricsheet attribution, "Back to the app" and "Questions or ideas? Leave feedback".

**Stage by stage (collapsed by default)**: seven panels, one each for stage 1, 2, 3, 4, 5–6 (together), 7 and 8.

- Closed, a panel shows only a round outlined stage number, the stage name in bold and a one-line summary, with a
  chevron on the right.
- Selecting anywhere on that row opens or closes the panel; the chevron turns over. Panels open independently.
- An **Expand all** button above the panels opens every panel; once all are open it reads **Collapse all**.
- Accessibility: each header is a real button (or `<summary>`) with `aria-expanded` and `aria-controls`, reachable by
  keyboard and at least 44 px tall. The chevron animation is switched off under `prefers-reduced-motion`.
- Every panel starts closed on each visit; opening state does not need to be remembered.

## Data-dependent figures

Some copy states figures that change when the data is refreshed: the counts table and exclusions (manifest), 5,209
innings, 2,872 test-population innings, the check and test season sizes, 23.9 and 22.5 (the reference figures), the
correlation 0.75, and the example run in stage 7.

**Open question for the spec**: either (a) read these from data the app already serves (`/api/data` summary,
`/api/reference`, the structure notes) so they never go stale, or (b) keep them as written text with a visible "as of"
date, or (c) drop the example run in stage 7 and keep only figures that are cheap to keep current. The stage 7
example comes from one run with the language model switched off and will not match a visitor's own run.

## Out of scope

The main page's tabs, graph and results; the teaching site; any new endpoint unless the open question chooses (a).
