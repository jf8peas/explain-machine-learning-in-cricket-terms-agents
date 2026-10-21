# Tasks: Who Built This

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [contracts/page-contract.md](contracts/page-contract.md), [design/README.md](design/README.md) (copy and URLs; wins over the pictures)
**Tests**: Required by FR-011 and the plan: the feature 018 Playwright spec is updated. No new unit tests (no new logic).

All paths are under `apps/linear_regression/` unless shown. HTML and CSS only; do not touch `web/index.html`, `web/vite.config.ts`, `web/src/page/under-the-hood/*.ts` or the backend.

## Phase 1: Baseline

- [X] T001 In `web/`, run `npm test` and `npm run e2e -- under-the-hood.spec.ts` and note that they pass before any change (so later failures are attributable)

## Phase 2: Foundational (blocks US2 and US3)

- [X] T002 [P] Add the `.visually-hidden` rule (same declaration as `web/index.html` line 315) to `web/src/page/theme.css`
- [X] T003 Move the pill rules from `.jump a` in `web/src/page/under-the-hood/under-the-hood.css` (lines 10 to 12: layout, `:hover`, `:focus-visible`) to a shared `.pill-link` class; keep `.jump` as the flex row; keep the other `:focus-visible` selectors (`.stage-head`, `.outline-btn`) in the focus rule
- [X] T004 In `web/under-the-hood.html`, add `class="pill-link"` to the six existing jump links; run the jump-link and contrast tests to confirm no visual or behaviour change

**Checkpoint**: the page looks and tests exactly as before.

## Phase 3: User Story 1 - See who built and tested the app (P1) 🎯 MVP

**Goal**: the credits section and the footer line exist with the exact design copy.
**Independent test**: load the page; section, copy, order and footer line are present.

- [X] T005 [US1] In `web/under-the-hood.html`, add `<section id="people" aria-labelledby="h-people">` after `section#shipping` and before `footer#footer`: `p.part` "Who built this", `h2#h-people` "John Fong", the two-sentence bio, and `div.testers` holding one `.card` (muted kicker "Who's testing it" as `p.part.tester-kicker`, `h3` "Alesja Tanabe", muted bio `p.muted`). Copy word for word from `design/README.md`. Add the two LinkedIn links as in T011 (placeholders are not allowed; do T011 in the same edit)
- [X] T006 [US1] Add `<p>Built by John Fong · Tested by Alesja Tanabe</p>` as the first paragraph of `footer#footer` in `web/under-the-hood.html`, above the Cricsheet attribution
- [X] T007 [P] [US1] In `web/src/page/under-the-hood/under-the-hood.css`, add `.testers` (one-column grid, 14 px gap) and `.tester-kicker` (`color: var(--muted)`); existing tokens only
- [X] T008 [US1] Update `web/tests/e2e/under-the-hood.spec.ts`: add `"people"` to `SECTIONS` and `people: "John Fong"` to the headings map; assert the "Who built this" kicker, both bios word for word, `h3` "Alesja Tanabe" inside `.card`, that `section#people` is the last `section`, and that `footer#footer` follows it
- [X] T009 [US1] Add an e2e check that the credit line precedes the Cricsheet attribution in `footer#footer`, and a check that the main page (`/`) has no link named like "Author"
- [X] T010 [US1] Run the "no dropped or hard-coded figure" test; if "nearly 5 years" trips it, exclude `#people` from that scan with a comment saying why (research R6), do not loosen the scan

**Checkpoint**: US1 independently verifiable.

## Phase 4: User Story 3 - Open a LinkedIn profile safely and accessibly (P2)

**Goal**: both links meet target, size, focus and accessible-name rules.
**Independent test**: link attributes, height, outline and exact names.

- [X] T011 [US3] In `web/under-the-hood.html` make both links `<a class="pill-link" href="..." target="_blank" rel="noopener" data-testid="link-linkedin-author|link-linkedin-tester">View LinkedIn profile <span aria-hidden="true">→</span><span class="visually-hidden"> for John Fong|Alesja Tanabe (opens in a new tab)</span></a>`, each in a block parent so it is inline-flex, left aligned and not full width; URLs from `design/README.md`
- [X] T012 [US3] Add e2e checks in `web/tests/e2e/under-the-hood.spec.ts`: `href`, `target="_blank"`, `rel` contains `noopener`, `getByRole("link", { name, exact: true })` for "View LinkedIn profile for John Fong (opens in a new tab)" and "View LinkedIn profile for Alesja Tanabe (opens in a new tab)", height at least 44 px, outline width above 0 when focused, link width smaller than the section
- [X] T013 [US3] Update the keyboard-order test: raise the Tab cap from 40 to 50 and assert both LinkedIn links come after `stage-header-7` and before `back-footer` and `link-feedback-footer`; the last stop stays `link-feedback-footer`
- [X] T014 [US3] Add the tester bio, `.tester-kicker` and `.pill-link` to the 4.5:1 contrast list (light and dark) in `web/tests/e2e/under-the-hood.spec.ts`

## Phase 5: User Story 2 - Jump to the credits (P2)

**Goal**: a seventh jump link reaches the section.
**Independent test**: link list and click target.

- [X] T015 [US2] In `web/under-the-hood.html` add `<a class="pill-link" href="#people">Who built this</a>` after "5 · Shipping it"
- [X] T016 [US2] Update the jump-link test in `web/tests/e2e/under-the-hood.spec.ts`: expect seven texts ending "Who built this", add `"people"` to the targets, click the last link and assert the URL ends `#people` and `#h-people` is in the viewport

## Phase 6: Polish and verification

- [X] T017 [P] Add one line about the credits (section, jump link, footer line, fixed text, no script change) to "The Under the hood page (feature 018)" in `apps/linear_regression/README.md`
- [X] T018 Confirm the existing 360 px no-sideways-scroll test runs against the page with the new section (with every panel open); add an assertion on `#people` if it does not cover it
- [X] T019 In `web/`, run `npm test`, `npm run e2e` (full suite) and `npm run build`; all feature 018 and main-page tests must pass unchanged apart from T008 to T016, and `dist/` must hold both pages
- [X] T020 Follow `quickstart.md` by eye: light and dark themes, 360 px, pill look matches the jump links, main page unchanged

## Dependencies and order

- T001 first. T002 and T003 can run in parallel with each other (different files); T004 needs T003.
- US1 (T005 to T010) needs Phase 2. T005 and T011 edit the same block, so do them together; US3 tests (T012 to T014) need T011 and T002.
- US2 (T015, T016) needs T004 and T005 (the target must exist).
- Most tasks edit `under-the-hood.html` or the one spec file, so they are sequential; only the [P] tasks are safe in parallel.
- Polish needs everything.

## Parallel example

```text
T002 (theme.css)  |  T003 (under-the-hood.css)      # different files
T007 (css)        |  T017 (README)                    # different files, after their prerequisites
```

## Strategy

MVP is US1 (T001 to T010): the credits are visible with correct copy. Then US3 (links verified and accessible) and US2 (jump link). The build is in three sittings at most; each checkpoint leaves the page working and the suite green.
