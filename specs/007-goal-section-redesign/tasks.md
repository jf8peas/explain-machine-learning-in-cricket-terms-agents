# Tasks: A Lighter Goal Section (the "Miss Meter")

**Input**: Design documents in `specs/007-goal-section-redesign/` (plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md, design/README.md, design/goal-section-1a.html)
**Tests**: Included, written before the code they cover. Every test uses the scripted fake model; **no test may reach the network**.
**Paths**: Relative to `apps/linear_regression/` unless they start with `specs/`.
**No new dependencies.** Every command runs from `apps/linear_regression/` (web commands from `web/`). On this machine start the API with `uv run python -m uvicorn ...` (the `uvicorn.exe` launcher is blocked by Windows policy). The design's HTML file is a reference only and is never copied into `web/`.

## Format: `- [ ] [ID] [P?] [Story?] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story label (US1 to US5), used only in story phases

**Story map** (spec.md): US1 grasp the challenge at a glance (P1); US2 the detail is there but out of the way (P1); US3 everyone can read it (P2); US4 it works on a phone (P2); US5 honest when the figures are missing (P2).

**Build order note**: the server's new numbers and the page's pure positioning helpers come first (Phase 2) because every story reads them. US1 builds the lead line, the meter and the goal footer. US2 adds the chips and the two closed sections and moves the old text into them, which is also where the old layout's dead CSS is removed and the existing tests that looked at the table directly are updated. US3 to US5 harden what US1 and US2 built.

## Phase 1: Setup

- [x] T001 Baseline before any edit: `git status` (the 007 spec files are untracked; the 006 work may be uncommitted and must be known), then run `uv run pytest`, `cd web && npm test`, `cd web && npx playwright test` and record the result (last known: 584 pytest, 148 Vitest, 171 Playwright). Also record, for comparison with the finished page: where Play's bottom edge sits at 1280 × 800 (last measured about 750 px), and the number of words of running text in `section.intro` today excluding the eyebrow and the title (about 260; count the rendered text). Stop any server on ports 8000 and 5173 first

## Phase 2: Foundational (blocks every story)

- [x] T002 [P] Write failing tests in `tests/test_goal_meter.py` for `goal.meter()` and the new wording helpers: the goal's value is the TV projection's displayed miss minus `MARGIN_RUNS` to one decimal (21.8 − 3 = 18.8), worked out from the displayed figure with a case found by scanning where plain float subtraction is not already the rounded value (for example 16.1 − 3); the scale is `floor(low − P)` to `ceil(high + P)` with `P = max(3, ceil(0.2 × spread))` (15 to 33 for 18.8, 21.8 and 29.4); it holds when the projection is worse than the know-nothing guess, when the goal is at or below zero (the scale extends below zero), when the margin is large, and when the spread is tiny (the minimum padding of 3); every value lies strictly inside the scale; there are always three marks in the order know-nothing, TV projection, goal, with labels "Know-nothing guess", "TV projection" and "The goal" (the first two derived from the method names in `methods.py`); the caption is "Average miss, runs · 2005 to 2024, 4,036 innings" built from the years and the count; the text equivalent names all three values and says lower is better; no markup in any string; `goal()["lead"]` contains the margin, equals the sentence in contracts/api.md, and changes when `MARGIN_RUNS` is patched
- [x] T003 Implement the server side: `goal.py` (`lead` added to `goal()`; `meter(know_nothing_miss, projection_miss, training)` returning `{scale, marks, caption, text}`; `SCALE_MIN_PAD = 3` and `SCALE_PAD_SHARE = 0.2`) and `accuracy_text.py` (`meter_label`, `meter_caption`, `meter_text`); make T002 pass
- [x] T004 [P] Write failing tests: extend `tests/test_reference_api.py` (the response has `meter` with the documented shape; its marks equal an independent calculation from the training years; the goal mark equals `figures.broadcaster.average_miss − goal.margin_runs`; `goal.lead` is present; `meter` is `null` when the data cannot be read while `goal.lead` and `methods` are still sent; changing every validation and test year value changes nothing in `meter`) and `tests/test_goal_one_source.py` (the lead follows the margin as the goal text does, in the endpoint; and no word of the lead appears in `web/index.html` or `web/src/page/*.ts`)
- [x] T005 Add `meter` to the response (and `null` to the failure response) in `backend/linreg/reference_api.py`; make T004 pass and run `tests/test_reference_api.py` in full
- [x] T006 [P] Write failing Vitest tests in `web/tests/unit/meter.test.ts` for the pure helpers in `web/src/page/meter.ts`: `position(value, scale)` is 0 at `min`, 100 at `max`, 50 halfway, rounded to one decimal and kept between 0 and 100 (with a value outside the scale clamped); for today's figures (scale 15 to 33) the positions are 21.1, 37.8 and 80.0 and increase with the value; `zoneWidth` equals the goal mark's position; `layoutRows(marks, positions)` puts marks far apart in the same row, puts two marks closer than the wide threshold in different rows for wide screens and closer than the narrow one in different rows for narrow ones (the thresholds are named constants, starting at 14% and 30%, to be tuned in T014/T015), puts the goal above the line and the references below on narrow screens, and gives the same result whatever order the marks are given in
- [x] T007 Implement `web/src/page/meter.ts` (pure: `position`, `zoneWidth`, `layoutRows` and their named thresholds, with the `Reference` meter types it needs); make T006 pass

## Phase 3: User Story 1 - Grasp the challenge at a glance (Priority: P1)

**Goal**: the lead line, the miss meter with three marks, the shaded goal zone, the caption and the goal footer, all from the server.
**Independent test**: load the page and check the lead line, the marks' values and positions, the zone, the caption and the footer against `/api/reference`.

- [x] T008 [P] [US1] Write failing Playwright tests in `web/tests/e2e/reference.spec.ts` (new part): the lead line (`data-testid="intro-lead"`) equals the server's `goal.lead`; the meter (`data-testid="meter"`) has three marks (`data-testid="meter-mark"` with `data-mark` ids `know_nothing`, `broadcaster`, `goal`), each showing its name and value equal to the server's `meter.marks`; the goal's value equals the TV projection's displayed miss minus the margin to one decimal; each mark's centre sits at the position the server's scale gives (within a pixel) and lies inside the track; marks increase left to right with their value; the shaded zone (`data-testid="meter-zone"`) runs from the left end of the line to the goal mark; the caption (`data-testid="meter-caption"`) equals the server's; the footer (`data-testid="goal"`) contains "The goal:" and the server's goal text; the meter has no number the server did not send (every number in its text is in the response); (the Play-position and word-count checks are written in T010, because they need the old text collapsed)
- [x] T009 [US1] Implement the lead line, the meter and the footer: in `web/index.html` replace the old `.intro-ref` block (the goal paragraph and the reference region) with the live region (`data-testid="reference"`, `aria-live="polite"`) and add the meter styles using only the existing `:root` tokens (line `--border`, zone `--win-bg` with a `--win` border, goal `--win`, TV projection `--text`, know-nothing `--muted`); in `web/src/page/reference.ts` update the `Reference` type (`goal.lead`, `meter`) and build the lead line, the meter (positioned HTML, marks placed with `meter.ts`) and the footer with `h()`, every string and number set as text; make T008 pass (the table and the note are rebuilt in T012, so until then keep them rendering below the meter and keep the tests that read them passing)

## Phase 4: User Story 2 - The detail is there, but out of the way (Priority: P1)

**Goal**: a row of five chips and two closed sections holding the original paragraphs and the original table and sentences.
**Independent test**: check both sections start closed and compare what they hold with the old introduction.

- [x] T010 [P] [US2] Write failing Playwright tests in `web/tests/e2e/reference.spec.ts` and update the existing ones that depend on the old layout: (new) five chips in order, each a bold term and a few words (Agent, Language model, Code, Linear regression, Rival), the language-model chip in the accent colour, wrapping at a narrow width; both sections (`data-testid="intro-full"` and `data-testid="reference-details"`) are closed on a fresh load and the text inside is not visible; opening the first shows the two paragraphs word for word (compared with the old text copied into the test); opening the second shows the headline sentence (`reference-lead`), the table (`reference-table`, `reference-row`) and the note (`reference-note`), equal to the server's; nothing animates when a section opens; in a 1280 × 800 window Play is fully visible and no lower than the T001 measurement (SC-007); the visible words of the lead line, meter, chips and the two headings (split on whitespace, closed sections' contents, eyebrow and title excluded, per SC-002) number at most 120. (update) in `reference.spec.ts` every check that reads `reference-table`, `reference-row`, `reference-lead` or `reference-note` first opens the second section, and the waits that used the table to mean "the block has arrived" wait for the meter instead; in `structure.spec.ts` the intro and goal checks suit the new layout; in `llm-run.spec.ts` the intro-text check opens the first section and asserts it is visible
- [x] T011 [US2] Implement the chips and the two sections: in `web/index.html` add the chip row and the two `<details>` (closed, no animation), moving the two existing introduction paragraphs into the first word for word, and give the second a container that `reference.ts` fills with the headline sentence, the table and the note (the existing builders, unchanged); remove the dead CSS listed in research.md Decision 7 (`.intro-body` and its children and media rule, the old `.goal`, `.intro-ref` and its media rule, `.reference`, `.reference p`, `.reference .reference-lead`) together with the markup they styled, add the small `.chip` and `details.intro-more` styles; make T010 pass (including the Play-position and word-count checks) and then run all of `web/tests/e2e/reference.spec.ts`, `structure.spec.ts` and `llm-run.spec.ts`

## Phase 5: User Story 3 - Everyone can read it (Priority: P2)

**Goal**: a text equivalent, no reliance on colour, both themes, keyboard access.
**Independent test**: read the meter's label, view the page in greyscale and dark mode, and use the keyboard on the sections.

- [x] T012 [P] [US3] Write failing tests: in `web/tests/unit/meter-colours.test.ts` (read from `web/index.html`, light and dark values, written out in the test) every text colour the meter uses has at least 4.5:1 contrast against its background, and the marks, the line and the goal zone's border at least 3:1, in both themes (the zone's fill is decoration and is not checked); in `web/tests/e2e/reference.spec.ts` the figure (`data-testid="meter-figure"`) has `role="img"` and an `aria-label` equal to the server's `meter.text` and containing all three values; its visual parts are hidden from assistive technology; the footer is outside the figure; the references are dots and the goal is a line (`data-shape` attributes `dot` and `line`), so no mark depends on colour; the greyscale and dark renders keep the marks and the zone distinguishable (computed colours differ from the card background); each section's summary can be focused and toggled with Enter and Space and shows a visible focus outline; the region keeps `aria-live="polite"`; no running animations in the section
- [x] T013 [US3] Make T012 pass in `web/src/page/reference.ts` and `web/index.html` (the `role="img"` figure with the server's text as its label, `aria-hidden` on its parts, the footer outside it, the shape attributes, focus styles), changing nothing that T008 and T010 already pass

## Phase 6: User Story 4 - It works on a phone (Priority: P2)

**Goal**: at 360 px nothing clips, overlaps or scrolls sideways.
**Independent test**: load the page at 360, 390, 768 and 1280 px, with the real data and crafted responses.

- [x] T014 [P] [US4] Write failing Playwright tests in `web/tests/e2e/reference.spec.ts` at widths 360, 390, 768 and 1280: the page does not scroll sideways; every mark's name box and value box lies inside the meter's card; no two name or value boxes overlap; the same holds for crafted responses (the projection worse than the know-nothing guess, a goal below zero from a large margin, two references with close values placed at about the wide threshold so the 768 px case is exercised, long names), each of which also keeps every mark's position equal to the scale's; below 760 px the "better" and "worse" end labels are not shown, the values are smaller (1.1 rem), the goal's name and value sit above the line and the references' below it; the chips wrap; the opened table scrolls inside its own box without making the page scroll; with the browser's text size increased the section still has no overlap or clipping
- [x] T015 [US4] Implement the narrow layout: `reference.ts` sets `data-row-wide`, `data-row-narrow` and `data-side-narrow` on each mark from `layoutRows`, and `web/index.html` adds the media query below 760 px (goal above, references below, second rows where the attributes say, names wrap with a maximum width, smaller values, end labels hidden) and the wide-screen second-row rule; if T014 shows labels touching at 768 px, raise the wide threshold in `meter.ts` (and its Vitest expectation) until it passes; make T014 pass and re-run T008's width and height checks

## Phase 7: User Story 5 - Honest when the figures are missing (Priority: P2)

**Goal**: no invented numbers when the figures are not there.
**Independent test**: make the request fail, return no figures, and delay the response.

- [x] T016 [P] [US5] Write failing Playwright tests in `web/tests/e2e/reference.spec.ts`: with `/api/reference` aborted, the lead line, the meter and the goal are not shown, the existing message (`reference-error`) is, and the chips and the first section still are; with a response that has the goal and its lead but `figures`, `meter`, `gap`, `finding`, `words` and `sentences` null, the lead line and a plain goal line (`goal`) show, the meter does not, the message shows, and the second section is hidden; while a delayed response has not arrived the meter area is empty and shows no number; in both failures the rest of the page works (the graph and Play)
- [x] T017 [US5] Implement the two failure states in `web/src/page/reference.ts` (hide what needs the figures, keep what does not) and make T016 pass

## Phase 8: Polish & Cross-Cutting

- [x] T018 [P] Update docs: `apps/linear_regression/README.md` (the introduction's meter, that the numbers and the lead come from `/api/reference`, where the goal's wording lives), `specs/007-goal-section-redesign/contracts/api.md` and `data-model.md` for anything that changed while building, and a note in this file for each departure from the plan
- [x] T019 Run everything: `uv run pytest`, `cd web && npm test`, `cd web && npx playwright test` (three full runs in a row, since the suite shares one server), `cd web && npm run build`; confirm every existing test passes with only the layout-dependent ones updated (SC-010), every test identifier from the spec still exists, and that Play is fully visible at 1280 × 800 and no lower than the T001 measurement (SC-007); take screenshots of the section in light, dark, greyscale, at 360 px and at 1280 px, with both sections closed and with them open
- [ ] T020 Owner visual review (no code): look at the section against `design/goal-section-1a.html` in both themes and at 360 px; confirm the meter's look, the narrow-screen arrangement (goal above the line, references below), the chips and the closed sections are what you want; any change becomes a small follow-up task
- [ ] T021 Reader review (SC-001, needs a person): show someone with no machine learning background the page for a few seconds without opening anything and ask what the agent has to beat and by roughly how much; record the outcome in `specs/007-goal-section-redesign/checklists/requirements.md` notes

## Dependencies & Execution Order

- Phase 1, then Phase 2 (blocks everything). Within Phase 2: T002 before T003; T004 before T005 (T005 needs T003); T006 before T007. The server tasks (T002 to T005) and the page helper tasks (T006, T007) are independent of each other.
- US1 needs Phase 2. US2 needs US1 (it reuses the region and moves the old text). US3, US4 and US5 each need US1 and US2; they are independent of one another (US4 touches layout rules, US3 attributes and colours, US5 the failure paths), but all three edit `reference.ts` and `index.html`, so run them one after another.
- Inside a story: its tests before its implementation.
- Polish last.

Order of delivery: Phase 1, Phase 2, US1, US2, then US3, US4, US5, then Polish.

## Parallel examples

- Phase 2: T002, T004 and T006 together (three different files).
- US1: T008 beside the Phase 2 implementation tasks if they are done.
- Each later story's test task can be written while the previous story's implementation is reviewed.

## Implementation strategy

1. **Safe first step**: T001 records what passes today, where Play sits, and how many words the introduction has.
2. **Numbers first**: Phase 2 gives the server's goal value, scale, marks, caption, text and lead, and the page's pure positioning helpers, with nothing visible yet.
3. **Visible core**: US1 and US2 together are the minimum worth looking at: the lead line, the meter, the chips and the two closed sections with the original text intact.
4. **Hardening**: US3 (reading without sight or colour), US4 (360 px) and US5 (missing figures) make it dependable.
5. **Finish**: docs, the full runs, the owner's visual review and the reader review (SC-001).
6. Throughout: no number or sentence about the figures typed in the page, one source for the goal's wording, every existing test identifier kept, no test reaches the network.

## Task counts

| Phase | Tasks |
|---|---|
| Setup | 1 (T001) |
| Foundational | 6 (T002 to T007) |
| US1 Glance | 2 (T008 to T009) |
| US2 Detail out of the way | 2 (T010 to T011) |
| US3 Everyone can read it | 2 (T012 to T013) |
| US4 Phone | 2 (T014 to T015) |
| US5 Missing figures | 2 (T016 to T017) |
| Polish | 4 (T018 to T021) |
| **Total** | **21** |

## Implementation notes

- **T001 baseline**: 584 pytest, 148 Vitest, 171 Playwright, all passing. Play's bottom edge at 1280 x 800 was 750.1 px; the running text of `section.intro` (eyebrow and title left out, table cells included) was 292 words.
- **Result**: Play's bottom edge is now about 728 px; 601 pytest, 165 Vitest, 213 Playwright pass.
- **Departures from the plan**: the wide label-collision threshold started at 16% (not 14%) because the widest pair of names needs about 15.5% of the track at 768 px; wide-screen names are one line, so the "long names" case is tested below 760 px, where names wrap; the number line uses `--muted` (not the design's `--border`) so it meets 3:1 contrast in both themes; the wide layout's second row needed extra spacing so the two rows' name boxes and value boxes cannot touch.
