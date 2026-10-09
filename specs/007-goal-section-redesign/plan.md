# Implementation Plan: A Lighter Goal Section (the "Miss Meter")

**Branch**: `007-goal-section-redesign` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)
**Input**: The specification, the approved design (`design/README.md`, `design/goal-section-1a.html`), and the planning brief. Every decision the brief asked for is in [research.md](research.md); where the design clashed with an earlier decision or left a gap, the choice and its reason are there and under Complexity Tracking.

## Summary

The introduction's two long paragraphs and its goal-and-table block are replaced by one lead sentence, a **miss meter** (a number line of average miss with the know-nothing guess, the TV projection and the goal), a row of five chips, and two closed sections that hold the original paragraphs and the original table word for word. The server does the new arithmetic, in `goal.py`: the goal's value (the TV projection's displayed miss minus the margin), the scale, the three marks, the caption, the text equivalent and the lead sentence; `/api/reference` carries them as one new `meter` object and one new `goal.lead`. The page turns values into positions and builds the DOM; it types no number and no sentence about the figures. The meter is positioned HTML (not SVG) so text scales and wraps, with a rule that keeps labels apart at 360 px. No new dependency.

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript (web), no framework
**Primary Dependencies**: Existing only. No new dependency
**Storage**: None
**Testing**: pytest, Vitest, Playwright (fake model and in-memory store, as before); no test reaches the network
**Target Platform**: Vercel (static plus the Python function); evergreen browsers; widths from 360 px
**Project Type**: Web app inside the uv-workspace monorepo (as 001 to 006)
**Performance Goals**: No change: `/api/reference` stays cached once per process and at the edge; the meter adds no request
**Constraints**: No number or sentence about the figures typed in the page; the goal and the lead worded from one source (`goal.py`); the error state preserved; the Play control no lower than today (about 750 px at 1280 × 800); every mark's name and value inside the card and not overlapping at 360 px; existing test identifiers kept
**Scale/Scope**: 3 marks, 5 chips, 2 closed sections; one object added to one endpoint

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates to evaluate. Principles applied from the brief, each checked:

| Principle | How the plan meets it |
|---|---|
| No hard-coded numbers in the frontend | The goal's value, the scale, the caption and the text equivalent come from the server; the page only maps a value to a percentage |
| One source for the goal wording | `goal.py` builds `text` and the new `lead` from the same margin; the footer reuses `text`; a test changes the margin and checks both |
| Error state preserved | Request failure: lead, meter and goal hidden, the existing message shown. Figures missing: lead and a plain goal line shown, meter and second section hidden, message shown |
| No new dependencies | Positioned HTML and CSS; plain TypeScript; no chart or layout library |

**Re-check after design**: no violations. Additions and departures are under Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-goal-section-redesign/
├── plan.md
├── research.md          # 9 decisions, with the real numbers the scale and collision rules rest on
├── data-model.md
├── quickstart.md
├── contracts/api.md     # the diff against the 006 contract
├── design/              # the approved design (README.md, goal-section-1a.html); not shipped
├── checklists/requirements.md
└── tasks.md             # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
backend/linreg/
├── goal.py              # CHANGED: goal() gains `lead`; new meter() (target value, scale, marks, caption, text); SCALE_MIN_PAD, SCALE_PAD_SHARE
├── accuracy_text.py     # CHANGED: meter_label(), meter_caption(), meter_text()
├── reference_api.py     # CHANGED: adds `meter` to the response (null when the figures are missing)
tests/
├── test_goal_meter.py   # NEW: target value, scale, positions' inputs, labels, caption and text, rounding from displayed figures
├── test_reference_api.py # CHANGED: new keys; the goal now carries `lead`; meter null on failure
├── test_goal_one_source.py # CHANGED: the lead follows the margin too
web/src/page/
├── meter.ts             # NEW, pure: position(), zoneWidth(), layoutRows() and their thresholds
├── reference.ts         # CHANGED: the new DOM (lead, meter, footer) and the second section's content; types for goal.lead and meter
web/index.html           # CHANGED: new intro markup (lead and meter containers, chips, two <details>), new styles, dead rules removed
web/tests/
├── unit/meter.test.ts          # NEW: marker positioning, zone width, row assignment
├── unit/meter-colours.test.ts  # NEW: contrast of the meter's colours in both themes
├── e2e/reference.spec.ts       # CHANGED: open the sections before checking what is inside; new meter, text equivalent, closed-by-default, error, overlap and word-count tests
├── e2e/structure.spec.ts       # CHANGED: the intro checks for the new layout
└── e2e/llm-run.spec.ts         # CHANGED: the intro-text check opens the first section
```

## Design Notes

Decisions are in `research.md`; the points that matter when building:

- **The server works out every number**: `goal.meter(know_nothing_miss, projection_miss, training)` (the training years and innings count feed the caption) returns the scale, the three marks (the goal's value stored once, as a mark), the caption and the text equivalent. All arithmetic is from the displayed one-decimal figures.
- **The page maps values to percentages and builds DOM**: `meter.ts` has `position(value, scale)` (one decimal, kept in 0 to 100), `zoneWidth` and `layoutRows`; `reference.ts` uses them with `h()`.
- **Positioned HTML**: text scales and wraps; one `role="img"` element holds the figure with the server's text as its label; the footer sits outside it so it stays readable.
- **Label collisions are handled by a rule, not by measuring**: wide screens put labels above and values below and push close marks into a second row; below 760 px the goal goes above the line and the references below it, names wrap, values shrink, and the end labels are dropped.
- **Closed sections hold what they held before**: the two paragraphs word for word (static markup) and the headline sentence, table and note (built from the same response).
- **Dead CSS is removed** with the markup it styled (listed in `research.md`, Decision 7).

## Testing Strategy

- **pytest**
  - `goal.meter()` on hand-worked numbers: the goal's value is the TV projection's displayed miss minus the margin to one decimal (21.8 − 3 = 18.8), and a case where plain float subtraction is not already the rounded value, which the test finds by scanning values, so the rounding step is shown to matter; rounding from displayed figures rather than unrounded ones; the scale for today's figures (15 to 33), for the projection worse than the know-nothing guess, for a goal at or below zero, for a large margin, and for a very small spread (the minimum padding of 3); every value strictly inside the scale with room on both sides;
  - labels come from the method names ("Know-nothing guess", "TV projection") and the goal's own name; the caption and the text equivalent contain all three values and the years and innings count, and no markup;
  - `goal.lead` contains the margin, changes when `MARGIN_RUNS` is patched, and the page source contains none of its words;
  - `/api/reference`: `meter` has the documented shape, equals an independent calculation from the training years, the goal mark equals `figures.broadcaster.average_miss − goal.margin_runs`, and `meter` is `null` (with `goal.lead` still present) when the data cannot be read.
- **Vitest**
  - `position`: the value at `min` is 0 and at `max` is 100, a value halfway is 50, rounding to one decimal, clamped; for today's figures the three positions are 21.1, 37.8 and 80.0 and increase with the value;
  - `layoutRows`: marks far apart share a row; two close marks get different rows; the goal is above the line on narrow screens and the references below; the result is the same whatever order the marks are given in;
  - colours: each meter colour has at least 4.5:1 (text) or 3:1 (graphics) against its background in light and dark, read from `index.html`.
- **Playwright**
  - the lead line and the footer's goal text equal the server's; the three marks' values equal the server's meter and the goal equals the TV projection's displayed miss minus the margin; each mark sits at the position the scale gives (within a pixel) and inside the track; the goal zone's right edge is at the goal mark;
  - the meter's text equivalent equals the server's `text` and names all three values; the figure is a labelled image and the footer is outside it;
  - both sections are closed on a fresh load; opening the first shows the two paragraphs word for word (compared with the old text kept in the test); opening the second shows the headline sentence, the table and the note, equal to the server's;
  - the five chips are present, in order, with the language-model chip in the accent colour;
  - error states: request aborted gives the message and no lead, meter or goal; a response with `figures: null` and `meter: null` gives the lead, the goal line, the message and no meter or second section; while loading there are no placeholder numbers;
  - at 360, 390, 768 and 1280 px: no sideways page scroll, every mark's name and value inside the card, and no two names or values overlapping, for the real data and for crafted responses (projection worse than know-nothing, goal below zero, large margin); below 760 px the end labels are hidden and the values are smaller;
  - the visible words in the section with both sections closed number at most 120; Play is fully visible at 1280 × 800 and no lower than 750 px;
  - dark mode and greyscale: the marks and zone remain distinguishable; nothing in the section animates.
- **Existing tests**: those that looked at the table or the headline directly (they now need the second section opened) and the introduction's two-paragraph checks are updated; every test identifier is kept (`goal`, `reference`, `reference-lead`, `reference-table`, `reference-row`, `reference-note`, `reference-error`).
- **Manual**: SC-001 (a visitor can say what the agent has to beat and by roughly how much, after a few seconds), listed in `quickstart.md`.

## Risks

- **Height**: the section is lighter than today's, but SC-007 is a measurement, so the first task checks Play's position with the real section before polish.
- **Narrow-screen collisions**: the goal and the TV projection are only one margin apart. The rule in Decision 5 keeps their text apart by putting them on opposite sides of the line; it is tested for the real data and crafted ones, but a very unusual set of values could still bring two references close, which the second-row rule handles.
- **Test churn**: many `reference.spec.ts` checks looked at the table directly; they must open the second section first. The change is mechanical but touches a dozen tests.
- **`role="img"`**: children of an image role are not exposed to assistive technology; the footer is deliberately outside the figure for that reason, and a test checks it.
- **Typed copy**: the chips, the section headings and the "better" and "worse" end labels are fixed wording in the page, which the spec allows; they must not contain a number.

## Complexity Tracking

Additions or departures, each with its reason:

| Departure or addition | Reason |
|---|---|
| One `meter` object instead of `goal.target_miss` plus a separate `scale` | The goal's value is stored once, as a mark; two fields could disagree |
| `goal` gains `lead` | The lead line is a second sentence about the goal and needs the same margin, so it is built beside `text` in `goal.py` (one source) |
| Positions are worked out in the page, not sent | They are geometry of a value on a scale, not a figure; sending percentages would tie the server to the layout |
| A narrow-screen layout that moves the goal above the line | The goal and the TV projection are one margin apart and cannot share a row at 360 px |
| The scale uses the smallest and largest of the three values with padding that grows with the spread | The design's suggestion assumes an order and would clip otherwise |
| With figures missing, the lead line and a plain goal line still show | Keeps feature 006's behaviour that the goal is shown even when the figures are not |
| The headline sentence moves into the second section and keeps `reference-lead` | The design does not place it; this loses no wording and keeps the identifier |
| The meter's footer reuses the server's goal wording instead of the design's copy | One source for the goal's wording (feature 006) |
