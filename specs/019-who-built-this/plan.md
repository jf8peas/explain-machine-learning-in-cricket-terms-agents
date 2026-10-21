# Implementation Plan: Who Built This

**Branch**: `019-who-built-this` (work is on `main`; no branch hook ran) | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)
**Input**: The specification, [design/README.md](design/README.md) (authoritative over the pictures), and the planning brief.

## Summary

Add a final "Who built this" section, a seventh jump link and a footer credit line to the "How this app was built" page. HTML and CSS only: fixed text, no script, backend, route or dependency change. The jump-link pill style becomes a shared `.pill-link` class that the two LinkedIn links also use. Decisions are in [research.md](research.md).

## Technical Context

**Language/Version**: HTML and CSS (TypeScript and Python untouched)
**Primary Dependencies**: none new
**Storage**: none
**Testing**: Playwright (`web/tests/e2e/under-the-hood.spec.ts`); no new unit tests because there is no new logic
**Target Platform**: evergreen browsers, light and dark themes, 360 px phones
**Project Type**: web app inside the monorepo (`apps/linear_regression`)
**Constraints**: reuse existing tokens and classes; no new colour tokens; 44 px targets; visible focus; 4.5:1 contrast; no sideways scroll at 360 px; main page unchanged
**Scale/Scope**: 1 HTML file, 2 CSS files, 1 e2e spec, 1 README section

## Constitution Check

No constitution exists, so there are no gates. Principles carried from earlier features: one source for each fact (one pill definition), no new dependencies or routes, nothing fetched. **Re-check after design**: no violations.

## Project Structure

### Documentation

```text
specs/019-who-built-this/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/page-contract.md   # DOM and data-testid additions
├── checklists/requirements.md
├── design/                      # README.md is authoritative
└── tasks.md                     # created later by /speckit-tasks
```

### Source changes (in `apps/linear_regression/`)

```text
web/
├── under-the-hood.html                          # CHANGED: jump link, section#people, footer credit line
├── src/page/theme.css                           # CHANGED: add .visually-hidden (same rule as index.html)
├── src/page/under-the-hood/under-the-hood.css   # CHANGED: .jump a pill rules become .pill-link; add .testers and tester-kicker rules
└── tests/e2e/under-the-hood.spec.ts             # CHANGED: see Testing
README.md                                        # CHANGED: one line in "The Under the hood page" section
```

Not changed: `index.html`, `vite.config.ts`, `src/page/under-the-hood/*.ts`, the backend.

## Design

1. **Jump link**: add `<a class="pill-link" href="#people">Who built this</a>` after "5 · Shipping it"; give the six existing links `class="pill-link"`.
2. **Section** (after `section#shipping`, before `footer#footer`):
   - `<section id="people" aria-labelledby="h-people">`
   - `<p class="part">Who built this</p>`, `<h2 id="h-people">John Fong</h2>`, the bio `<p>`, then the author link.
   - `<div class="testers">` holding one `<div class="card">`: a muted kicker `<p class="part tester-kicker">Who's testing it</p>`, `<h3>Alesja Tanabe</h3>`, a muted bio `<p class="muted">`, her link. A second tester is another `.card` in `.testers`.
   - All copy exactly as in `design/README.md`.
3. **Links**: `<a class="pill-link" href="..." target="_blank" rel="noopener" data-testid="link-linkedin-author|link-linkedin-tester">View LinkedIn profile <span aria-hidden="true">→</span><span class="visually-hidden"> for John Fong (opens in a new tab)</span></a>`, each in a block parent so it is inline-flex and left aligned, never stretched.
4. **CSS**: `.pill-link` takes the declarations from `.jump a` (44 px min height, `--border` outline, 999px radius, `--accent` 14 px weight 600, no underline), with `:hover` on `--surface` and `:focus-visible` as the existing 3 px `--accent` outline at 2 px offset (add `.pill-link:focus-visible` to the existing focus rule). `.testers` is a grid with a 14 px gap; `.tester-kicker` only switches colour to `--muted`. Existing tokens only.
5. **Footer**: add `<p>Built by John Fong · Tested by Alesja Tanabe</p>` before the Cricsheet attribution `<p>` in `footer#footer`; it inherits the footer's text style (`.page-foot p` is already in the contrast test).
6. **Script**: unchanged; verified in research R5.

## Testing

Update `web/tests/e2e/under-the-hood.spec.ts` (no unit tests):

- `SECTIONS` gains "people"; the headings map gains `people: "John Fong"`; assert the "Who built this" kicker, both bios word for word, `h3` "Alesja Tanabe" inside the card, and that `section#people` is the last `section` and is followed by `footer#footer`.
- Jump links: seven, ending "Who built this" with `href="#people"`; clicking the last moves to `#people`.
- LinkedIn links: `href`, `target="_blank"`, `rel` contains `noopener`, `getByRole("link", { name, exact: true })` for the two exact names, height at least 44 px, outline width above 0 on focus, width smaller than the section.
- Keyboard order: both links after the stage controls and before `back-footer` and `link-feedback-footer` (raise the 40-press cap to 50).
- Footer: the credit line is before the Cricsheet attribution in DOM order.
- Contrast (light and dark): add the tester bio, `.tester-kicker` and `.pill-link` to the 4.5:1 list.
- 360 px: the existing test now covers the new section; confirm it runs against the full page.
- "No dropped or hard-coded figure": must pass with the bios present (research R6).
- Run the full Vitest and Playwright suites; `npm run build` must still write both pages.

## Docs

- `quickstart.md`: how to open the page locally and check the section.
- `apps/linear_regression/README.md`: one line about the credits in "The Under the hood page (feature 018)" section.
