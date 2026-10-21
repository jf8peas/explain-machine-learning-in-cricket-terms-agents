# Implementation Plan: Under the Hood: "How this app was built" Page and Two Header Links

**Branch**: `018-under-the-hood` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)
**Input**: The specification (with its 2026-10-21 clarification), the approved design in [design/README.md](design/README.md) (authoritative over the three HTML pictures), and the planning brief.

## Summary

Add two header links ("Under the hood", "Feedback") to the main page and a second static page, "How this app was built", built from its own Vite HTML entry. The page's text is all in the HTML; a small script fills the live figures from the two existing routes `/api/data` and `/api/reference` (fetched once, in parallel, failing soft to "not available right now") and runs the seven stage panels. The colour tokens and base styles move into one shared stylesheet used by both pages. No backend change, no new route, no new dependency. Decisions are recorded in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript, no framework (web); Python backend untouched
**Primary Dependencies**: existing only (Vite, Vitest, Playwright). No new dependency
**Storage**: none; panel state in memory only
**Testing**: Vitest on pure modules (`figures.ts`, `panels.ts`); Playwright with the fake-model server for everything that needs a DOM
**Target Platform**: evergreen browsers, light and dark themes, 360 px phones
**Project Type**: web app inside the monorepo (`apps/linear_regression`)
**Performance Goals**: first paint needs no data; live figures arrive after two parallel cached requests; `/api/data` is large (all innings rows) but edge-cached, and accepted
**Constraints**: no change to existing tabs, graph, run or results; same tokens, fonts, themes and 1100 px width; no sideways scroll at 360 px except inside wide tables; 44 px targets; visible focus; chevron animation off under reduced motion; years never typed in; no figure parsed out of sentences
**Scale/Scope**: 1 new HTML entry, 1 shared stylesheet, 1 new script folder (4 modules and a stylesheet), edits to `index.html` and `vite.config.ts`, 2 unit test files, 1 e2e spec, a README section

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates. Principles carried from earlier features:

| Principle | How the plan meets it |
|---|---|
| One source for each fact | Live figures come from the served responses; tokens live in one stylesheet |
| No numbers typed in that can go stale | Data-dependent figures and all years are live or reworded; only code-fixed rules are typed, each checked against the code (research R9) |
| A failure never shows wrong numbers | Per-figure placeholder; the two routes fail independently |
| Deterministic, testable logic | Figure mapping and panel state are pure functions |
| No new dependencies, no new routes | none added |

**Re-check after design**: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/018-under-the-hood/
├── plan.md
├── research.md            # live-figure sources, generic years, exclusion copy, fail-soft, second entry, shared CSS, panels
├── data-model.md          # served inputs, LiveFigures, PanelState
├── quickstart.md
├── contracts/page-contract.md   # DOM and data-testid contract
├── checklists/requirements.md
├── design/                # approved design (README.md is authoritative)
└── tasks.md               # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
web/
├── under-the-hood.html                 # NEW: the page's static content; links theme.css and the script
├── index.html                          # CHANGED: tokens and base styles moved out; breadcrumb row gains the "About this app" nav and its styles
├── vite.config.ts                      # CHANGED: build.rollupOptions.input lists both pages
├── src/page/
│   ├── theme.css                       # NEW: tokens, dark overrides, base styles (moved, not changed)
│   └── under-the-hood/
│       ├── main.ts                     # NEW: fetch both routes, fill figures, start panels
│       ├── figures.ts                  # NEW: pure mapping of responses to LiveFigures; exclusion explanation map
│       ├── panels.ts                   # NEW: pure panel state
│       ├── dom.ts                      # NEW: writes figures, wires the static panel markup
│       └── under-the-hood.css          # NEW: page styles
└── tests/
    ├── unit/under-the-hood-figures.test.ts   # NEW
    ├── unit/under-the-hood-panels.test.ts    # NEW
    └── e2e/under-the-hood.spec.ts            # NEW
README.md                               # CHANGED: a short "Under the hood page" section
vercel.json                             # unchanged (no cleanUrls)
```

**Structure Decision**: App-specific page code in `web/src/page/under-the-hood/`, as other app-specific pages sit in `web/src/page/`; nothing goes into the reusable components (`data-grid`, `graph-replay`, `tab-set`).

## Approach

1. **Shared theme first.** Move the tokens and base styles out of `index.html` into `theme.css` and link it from both pages with no visual change; run the existing e2e suite and compare screenshots in both themes before adding anything else.
2. **Header row.** Wrap the breadcrumb and the new nav in one flex row (`justify-content: space-between; flex-wrap: wrap`); add the two links with inline icons per the contract; no JavaScript.
3. **Static page.** Write `under-the-hood.html` from `design/under-the-hood.html` and the README, adjusted: no "Matches read" column, no season count, no years, no season sizes, no correlation, no example run; stage 2 table in words; live figures as `data-figure` spans.
4. **Figures.** `figures.ts` maps the two responses to `LiveFigures` by section title and row label; the explanation map is keyed by the server's exclusion labels; `dom.ts` writes `textContent`; any failure leaves "not available right now".
5. **Panels.** `panels.ts` holds the pure state; `dom.ts` wires the static buttons, `hidden` regions and the all-toggle to that state.
6. **Build and test.** Add the second entry, confirm `npm run build` writes both pages, write the unit and e2e tests, update the README.

## Risks

- **Moving the styles** could change the main page subtly: mitigated by the step order above, the existing suite and screenshot comparison.
- **Summary labels** are matched by text: a unit test uses a recorded real response and the e2e test compares with the live server, so a rename fails a test, and the page shows the placeholder rather than a wrong figure.
- **`/api/data` payload** is large: accepted (research R1).
- **Fixed-rule wording** can drift from the code: each fixed claim is checked when the copy is written (research R9).
