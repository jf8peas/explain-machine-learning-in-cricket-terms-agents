# Feature Specification: Under the Hood: "How this app was built" Page and Two Header Links

**Feature Branch**: `018-under-the-hood` (work is currently on `main`; no branch hook ran)
**Created**: 2026-10-21
**Status**: Draft
**Input**: Add an "Under the hood" page to the linear regression app, plus "Under the hood" and "Feedback" links in the main page header, following the approved design in `specs/018-under-the-hood/design/`.

## Context

Visitors who want to know how the app works have nowhere to go, and there is no way to send feedback.

The approved design lives in `specs/018-under-the-hood/design/`. `README.md` is the specification for copy, layout and behaviour; `main-header.html`, `main-header-phone.html` and `under-the-hood.html` are visual references only (pictures, not something the app ships). **Where they differ, the README wins.** This spec states what the feature must deliver, how the data-dependent figures are kept correct (the README's open question, decided below) and how it is checked.

| Change | Where |
|---|---|
| "Under the hood" link (wrench icon) and "Feedback" link (speech-bubble icon and external-link arrow) | The header row above the tab bar, on every tab |
| New page "How this app was built" | A second page, reached only from "Under the hood" |

**Unchanged**: the existing tabs, the graph, the run and the results; the app's server routes and run behaviour.

## Clarifications

### Session 2026-10-21

- Q: The check and test season sizes and the 0.75 correlation are not served by any existing route; keep, label or serve them? → A: Drop them (Option A). Stage 2 shows roles and what each learns from, in words (planning later removed hard-coded years too); stage 3 describes what is worked out without a correlation; no new route is added.

## Decision: how data-dependent figures stay correct

The README lists figures that change when the data is refreshed. The decision, per kind of figure (refined by the planning review of what the app serves; see `research.md`):

| Figure | Decision |
|---|---|
| Innings kept per competition and in total, the date range, the data download date, the test-population count (and the count outside it), the excluded counts by reason | **Read live** from the Data tab's summary |
| The reference period (first and last year, number of innings), the know-nothing and TV average misses, the TV's bias and its direction, the goal's margin in runs | **Read live** from the introduction's figures |
| "Matches read" per competition and the number of seasons (45) | **Dropped.** Nothing served carries them. The counts table shows innings kept per competition plus the total; "45 seasons" becomes the served date range |
| Check, test and training years and ranges (2023 to 2026, 2005–2022 and so on), season sizes (176, 196, 196, 171), the 0.75 correlation, and the stage 7 example run | **Dropped or reworded generically.** The stage 2 table gives roles and what each learns from, in words ("the three seasons before the latest", "the latest season, kept for one final test"). Stage 4 uses the live reference period |
| Wording that is a fixed rule of the build (19 features, 14 measured and 5 worked out, 24 grid settings, 6 rounds, 12 graph steps, 8 stages, the 100-innings minimum) | Kept as written text, because it changes only when the code changes |
| The run limits (5 an hour per visitor, 300 a day for the site) | Kept as written text but worded "by default", because a deployment can override them by setting; the page never states them as fixed |

Reasons for leaving data out are explained in the page's own words, keyed by the labels the app serves. A reason the page has no explanation for is shown with its label and count only; a reason the app omits (zero count) is not shown.

If the live figures cannot be loaded, the page still shows all its text; each live figure shows "not available right now" and nothing wrong or stale is shown. Where one sentence holds two or more live figures (for example the reference bar in stage 4), the whole sentence is replaced by "These figures are not available right now." if any of its figures is missing, so the page never shows a broken sentence. No new server route is added.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open the page and send feedback from any tab (Priority: P1)

A visitor on any tab sees two links in the header row above the tab bar. "Under the hood" takes them to the new page; "Feedback" opens the project's GitHub issues page in a new tab.

**Why this priority**: These links are the only way in to the page and the only way to send feedback.

**Independent test**: Open each tab and check both links and their targets automatically; judge the phone-width wrapping by eye.

**Acceptance Scenarios**:

1. **Given** any tab of the main page, **Then** one header row above the tab bar holds the existing breadcrumb on the left and two links on the right, in their own navigation named "About this app", separate from the breadcrumb.
2. **Given** the "Under the hood" link (wrench icon), **When** activated, **Then** the "How this app was built" page opens.
3. **Given** the "Feedback" link (speech-bubble icon and an external-link arrow), **Then** it points to `https://github.com/jf8peas/explain-machine-learning-in-cricket-terms-agents/issues`, opens in a new tab without giving the new tab access to the app's window, and its accessible name is "Feedback (opens the GitHub issues page in a new tab)".
4. **Given** phone width, **Then** the two links wrap onto their own row under the breadcrumb, aligned left, with no sideways scrolling.
5. **Given** the links, **Then** each is at least 44 px tall, uses the page's link colour with 14 px semibold text, shows the surface background on hover and a clear focus outline from the keyboard, and its icon is hidden from assistive technology.

---

### User Story 2 - Learn how the app was built (Priority: P1)

A curious visitor reads a single page that explains the question, the data, what happens when they press Play, the agent stage by stage, what the page shows and how it is shipped.

**Why this priority**: It is the feature's purpose.

**Independent test**: Load the page automatically and check every section heading, the jump links and both "Back to the app" links; judge the copy against the README by eye.

**Acceptance Scenarios**:

1. **Given** the page, **Then** it shows a top bar with "Back to the app" (left arrow) on the left, linking to the main page, and the Feedback link on the right; then the eyebrow "Under the hood · linear regression", the heading "How this app was built" and the README's lead sentence.
2. **Given** the jump links (The question, 1 · The data, 2 · Pressing Play, 3 · Inside the agent, 4 · What you see, 5 · Shipping it), **When** one is activated, **Then** the page moves to that section; the row wraps at phone width.
3. **Given** the page, **Then** it holds, in order: The question, The big picture, Part 1 The data, Part 2 Pressing Play, Part 3 Inside the agent, Part 4 What you see, Part 5 Shipping it, and a footer, with the content the README lists for each.
4. **Given** the footer, **Then** it holds the Cricsheet attribution, "Back to the app" and "Questions or ideas? Leave feedback" (the Feedback link, opening in a new tab; its accessible name is that text plus "(opens the GitHub issues page in a new tab)").
5. **Given** the page is opened directly by its address, **Then** it works the same as when reached from the link.
6. **Given** Part 4, **Then** it shows the two cards Model Selection (VALIDATION pill) and Hold-Out Test (TEST pill) using the existing validation and test pill styles.
7. **Given** Part 3, **Then** the eight-stage table and the agent's graph as three rows of step chips (each prefixed with its stage number, the two language-model steps filled) are shown before "Stage by stage".

---

### User Story 3 - Read the stages one at a time (Priority: P1)

In Part 3, "Stage by stage" is seven panels (stages 1, 2, 3, 4, 5–6, 7 and 8), all closed on arrival, so a visitor opens only what they care about.

**Why this priority**: It keeps a long explanation scannable.

**Independent test**: Drive the panels with mouse and keyboard automatically and check `aria-expanded` after every action.

**Acceptance Scenarios**:

1. **Given** the page loads, **Then** all seven panels are closed and each shows only a round outlined stage number, the stage name in bold, a one-line summary and a chevron on the right.
2. **Given** a closed panel, **When** its header row is activated anywhere (mouse, touch, Enter or Space), **Then** it opens, its chevron turns over and its header reports expanded; activating it again closes it.
3. **Given** several panels, **Then** each opens and closes independently of the others.
4. **Given** the "Expand all" button above the panels, **When** activated, **Then** every panel opens and the button reads "Collapse all"; activating it again closes every panel and it reads "Expand all". After the visitor opens or closes panels one by one, the button reads "Collapse all" only while all seven are open.
5. **Given** each header, **Then** it is a real button (or summary) at least 44 px tall, with `aria-expanded` and `aria-controls` naming its panel.
6. **Given** a reload, **Then** every panel is closed again.
7. **Given** a visitor who prefers reduced motion, **Then** the chevron does not animate.

---

### User Story 4 - Trust every figure (Priority: P1)

Every figure on the page is true for the data the app ships.

**Why this priority**: A page that explains how a numbers app works must not contain wrong numbers.

**Independent test**: Compare each live figure on the page with what the app serves for the Data tab and the introduction; check that dropped figures are absent.

**Acceptance Scenarios**:

1. **Given** the live figures listed in the decision above, **Then** each equals the value the app serves at that moment (innings counts, exclusions, date range, test population, reference period, reference misses, bias, goal margin, download date).
2. **Given** the dropped figures (matches read, the season count, hard-coded years, season sizes, the 0.75 correlation, the stage 7 example run), **Then** none appears anywhere on the page.
3. **Given** the live figures cannot be loaded, **Then** the rest of the page still renders and each live figure shows "not available right now"; a sentence holding several live figures is replaced as a whole by "These figures are not available right now." when any of them is missing.
4. **Given** the data is refreshed, **Then** no copy on the page needs editing for the live figures to be right.

---

### User Story 5 - Same look, any device (Priority: P2)

The new page looks like the main page and works on a phone.

**Why this priority**: Consistency and reach, but the content matters more.

**Independent test**: Measure horizontal overflow at 360 px wide automatically; compare light and dark themes by eye.

**Acceptance Scenarios**:

1. **Given** the page, **Then** it uses the main page's colour tokens, fonts, light and dark themes and content width.
2. **Given** 360 px wide, **Then** the page does not scroll sideways; only a wide table may scroll inside its own box.
3. **Given** the page, **Then** all links and buttons are reachable by keyboard in reading order with a visible focus outline, and every touch target is at least 44 px tall.

---

### Edge Cases

- If the live figures fail to load, the visitor still sees all text; only the live figures show the placeholder.
- The jump links work in both themes and with the keyboard; the targeted section is not hidden behind anything.
- Expand all with some panels already open opens the rest; the label follows the panels' real state.
- Very narrow screens (360 px): the header links wrap, the stage chips wrap and wide tables scroll inside their own box.
- Feedback opened in a new tab never changes or navigates the app's own tab.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The main page header MUST show the breadcrumb and, in a separate navigation named "About this app", the "Under the hood" and "Feedback" links, above the tab bar on every tab.
- **FR-002**: "Under the hood" MUST open the "How this app was built" page; "Feedback" MUST open the GitHub issues URL above in a new tab and carry the accessible name "Feedback (opens the GitHub issues page in a new tab)".
- **FR-003**: At phone width the header links MUST wrap onto their own row under the breadcrumb.
- **FR-004**: The new page MUST be a second page of the same app, reached from the link and by its own address, and MUST contain the top bar, heading block, jump links, the seven content sections in README order and the footer as in the Acceptance Scenarios.
- **FR-005**: The copy MUST follow the README and `under-the-hood.html`, except where the data-dependent figure decision above changes it.
- **FR-006**: "Stage by stage" MUST be seven panels, closed by default, with the header content, independence, "Expand all" / "Collapse all" behaviour and ARIA state in User Story 3.
- **FR-007**: Live figures MUST be read from data the app already serves; the dropped figures MUST NOT appear; a failure to load MUST show a placeholder (or, for a sentence holding several live figures, a single replacement sentence), never a wrong figure or a broken sentence.
- **FR-008**: The page MUST match the main page's colour tokens, fonts, light and dark themes and content width, and MUST NOT scroll sideways at 360 px except inside wide tables.
- **FR-009**: All controls MUST be real links or buttons, keyboard operable, at least 44 px tall, with a visible focus outline; the chevron animation MUST be off under reduced motion; decorative icons MUST be hidden from assistive technology.
- **FR-010**: The existing tabs, graph, run and results MUST NOT change, and no new dependency or server route is added.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can reach the new page from every one of the app's tabs in one action, and return to the app in one action.
- **SC-002**: On every tab, both header links are present with the right targets (checked automatically).
- **SC-003**: All seven sections and the footer are present, and all seven panels start closed and report the right expanded state after each open, close, Expand all and Collapse all (checked automatically).
- **SC-004**: At 360 px wide the page has no sideways scroll outside wide tables (checked automatically).
- **SC-005**: 100% of live figures on the page equal the app's served values; 0 dropped figures appear.
- **SC-006**: Every interactive element on the page and in the new header links is at least 44 px tall and shows a visible focus outline from the keyboard.

## Assumptions

- The page needs no sign-in and is public like the rest of the app.
- The planning step confirmed which figures the Data tab and the introduction serve (see `research.md`); anything not served was dropped rather than adding a route.
- The page's prose is condensed from the "How the linear regression agent is built" slide deck, as the README says; wording follows `under-the-hood.html`.
- Panels are not remembered between visits.
- Out of scope: the main page's tabs, graph and results; the teaching site; any new server route.

## Testing

Automated checks cover: both header links present on every tab with the right targets and accessible name; the new page loads, links back to the main page (top and footer) and shows every section; panels start closed, open and close individually and together, and `aria-expanded` and the Expand/Collapse label follow; the page has no horizontal scroll at 360 px wide; live figures equal served values and dropped figures are absent.
