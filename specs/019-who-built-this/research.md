# Research: Who Built This

## R1. Accessible name of the LinkedIn links (spec correction)

- **Decision**: Each link's accessible name starts with its visible text: "View LinkedIn profile for John Fong (opens in a new tab)" and "View LinkedIn profile for Alesja Tanabe (opens in a new tab)". `spec.md` (User Story 3 scenario 4, Assumptions, FR-005) and `design/README.md` were changed to match.
- **Rationale**: WCAG 2.5.3 (label in name) needs a speech-input user who says the visible words "View LinkedIn profile" to hit the link. The earlier wording "View John Fong's LinkedIn profile ..." did not contain the visible text as a prefix. The arrow is `aria-hidden` and not part of the name.
- **Alternatives**: `aria-label` on the link (rejected: it replaces the content and can drift from the visible text); keeping the possessive wording (rejected: fails 2.5.3).

## R2. How the name is built

- **Decision**: Visible text plus a visually hidden span: `View LinkedIn profile <span aria-hidden="true">→</span><span class="visually-hidden"> for John Fong (opens in a new tab)</span>`. The name is computed from content, so it is the visible words plus the hidden tail.
- **Rationale**: One source of text, no `aria-label`. The footer feedback link uses `aria-label` for its own pattern; it is left alone.
- **Utility**: `.visually-hidden` exists only inline in `web/index.html` (line 315); neither `theme.css` nor the page has it. Add the same one-line rule to `web/src/page/theme.css` (identical to the main page's, so the main page does not change visibly).

## R3. One pill definition

- **Decision**: Move the pill rules now under `.jump a` (`under-the-hood.css` lines 10 to 12) to a shared `.pill-link` class; the jump links and both LinkedIn links carry it. `.jump` keeps only the row layout (flex, wrap, gap).
- **Rationale**: Spec FR-006 and the README ask for the same look, and one definition keeps them from drifting. No visual change to the jump links.
- **Detail**: the jump `<a>` elements gain `class="pill-link"`. The LinkedIn links sit in a block parent and are `inline-flex`, so they hug their text, stay on their own line, left aligned, never full width.
- **Alternatives**: copy the rules (rejected: two definitions); style by `.jump a, #people a` (rejected: selector coupling).

## R4. Tester card and room for a second tester

- **Decision**: Reuse `.card`. The testers sit in a wrapper `<div class="testers">` (a one-column grid with the page's 14 px gap), each tester one `.card` child. A second tester is another `.card` sibling. Add only a muted kicker rule (the `.part` look in `--muted`) and spacing, using existing tokens.
- **Rationale**: Matches the recipe app's list of testers without redesign.
- **Contrast**: `--muted` on `--surface` is already checked for `.note` and `.stage-sum`; the new cases are added to the contrast test.

## R5. The page script is unaffected

- `main.ts`, `dom.ts`, `figures.ts` and `panels.ts` select by `[data-figure]`, `[data-figure-group]` and `.stage-head`; none counts sections or reads the last one. The new section has none of those attributes, so there is no script change.

## R6. Existing tests that need care

- The jump-link test lists six links and clicks `nth(5)`: update to seven.
- The heading test iterates `SECTIONS` with a headings map: add "people" and "John Fong".
- The keyboard test presses Tab at most 40 times and ends on `link-feedback-footer`. Two more stops may exceed 40, so raise the cap to 50; the last stop is still the footer feedback link.
- The 44 px loop covers every link; the new ones are not inside a `p`, so they are checked.
- "No dropped or hard-coded figure" scans the page for years and similar; Alesja's bio contains "nearly 5 years of experience". This must be checked when the test is run. If the scan trips, exclude `#people` from that scan with a comment saying why, rather than loosening it.

## R7. Tooling in this repo

- `.specify/scripts/` and the plan template do not exist, so no setup script ran; this plan follows the feature 018 plan's structure. There is no constitution, so there are no gates.
