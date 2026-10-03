# Feature Specification: Data Tab (Inspect and Download the Innings Data)

**Feature Branch**: `002-data-tab`
**Created**: 2026-10-03
**Status**: Draft
**Input**: Add a Data tab to the linear regression app so visitors can inspect and download the innings data the agent uses, and switch between the agent's working and the data without losing their place.

## Context

This extends the linear regression agent app (feature 001). The page currently shows an intro, the animated agent graph, "What the agent found", and "Try your own innings". The audience is cricket fans learning machine learning; seeing the real rows behind the model builds trust and shows what the agent works from.

The data is the prepared innings table: about 5,100 first innings, one row each, with match id, match date, season, competition, venue, runs at 10 overs, wickets at 10 overs, powerplay runs and final total. It comes from Cricsheet (men's T20 internationals, IPL and BBL).

The tabs and the data viewer are a reusable, clearly bounded part of the app (like the graph visualiser), so the other seven algorithm apps can adopt them unchanged.

## Clarifications

### Session 2026-10-03

- Q: What does the "year" filter mean? → A: The calendar year of the match date, the same basis as the train/test split; the season label stays a display column only.
- Q: What do the row numbers show after sorting or filtering? → A: They always run 1, 2, 3… down the rows currently shown.
- Q: How does the search box match text? → A: Against the text exactly as displayed in the grid (e.g. full competition names), ignoring case.
- Q: What values does the CSV contain? → A: Friendly column headings and display labels (full competition names, Training/Test), with dates in ISO (YYYY-MM-DD) and numbers plain and unformatted.
- Q: How do tab switches interact with browser history? → A: Each switch to a different tab adds one history step; clicking the already-active tab adds none; an unknown hash shows Working without adding a step.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch between Working and Data without losing my place (Priority: P1)

Below the intro the visitor sees two tabs, "Working" (everything the page shows today) and "Data". Working is the default. They can move between tabs freely during or after a run.

**Why this priority**: Tabs frame everything else, and losing run progress on a switch would break the existing experience.

**Independent Test**: Start a run, switch to Data and back several times; the run continues and nothing resets.

**Acceptance Scenarios**:

1. **Given** a fresh page load, **When** it renders, **Then** the Working tab is selected and shows the graph, results and try-your-own as before.
2. **Given** a run in progress, **When** the visitor switches to Data and back, **Then** the run has kept going and the display reflects its current progress.
3. **Given** a completed run with a chosen step and try-your-own inputs, **When** the visitor switches tabs any number of times, **Then** results, current step and inputs are unchanged.
4. **Given** a sorted, filtered and scrolled Data tab, **When** the visitor switches to Working and back, **Then** sort, filters and scroll position are unchanged.
5. **Given** either tab is active, **When** the visitor copies the URL, **Then** it identifies the tab (e.g. #working or #data); opening it selects that tab, and Back/Forward move between previously visited tabs.
6. **Given** a visitor opens the #data link directly, **When** the page loads, **Then** the Data tab shows without needing a run first.
7. **Given** keyboard or screen-reader use, **When** navigating tabs, **Then** tabs are reachable and switchable by keyboard and announced as tabs with their selected state.

---

### User Story 2 - Browse the data like a spreadsheet (Priority: P1)

On the Data tab the visitor sees the full innings table in a read-only grid that feels like Google Sheets: gridlines, sticky header row, sticky row-number column, right-aligned numbers, compact rows and a highlighted selected cell. Headings are friendly (e.g. "Runs at 10 overs") with each column's meaning on hover or focus and in a short column guide. Competitions appear in full (T20 International, IPL, BBL).

**Why this priority**: Inspecting the rows is the core purpose of the feature.

**Independent Test**: Open the Data tab, scroll through all rows, select cells and copy a range into a spreadsheet.

**Acceptance Scenarios**:

1. **Given** the Data tab, **When** it loads, **Then** all innings are available in the grid with the header and row numbers staying in place while scrolling.
2. **Given** a column heading, **When** the visitor hovers or focuses it, **Then** its meaning is shown; the same meanings appear in the column guide.
3. **Given** a narrow screen, **When** the grid is wider than the viewport, **Then** it scrolls horizontally within its own area and the page itself never scrolls sideways.
4. **Given** a selected cell or range, **When** the visitor copies, **Then** pasting into a spreadsheet gives clean rows and columns without formatting artefacts.
5. **Given** the grid, **When** the visitor tries to edit, add or remove, **Then** nothing can be edited, added or removed.
6. **Given** a column border, **When** the visitor drags it, **Then** the column resizes.
7. **Given** all rows, **When** the visitor scrolls quickly through them, **Then** scrolling stays smooth.

---

### User Story 3 - Sort, search and filter (Priority: P1)

The visitor can click a heading to sort ascending, then descending, then back to original order; search text across any column; and filter by competition, year and "Used for". "Showing X of Y innings" is always visible.

**Why this priority**: A 5,100-row table is not explorable without it.

**Independent Test**: Apply each control and verify the visible rows and the count.

**Acceptance Scenarios**:

1. **Given** an unsorted grid, **When** the visitor clicks a heading three times, **Then** order goes ascending, descending, then original.
2. **Given** a search term, **When** typed, **Then** only rows with a match in any column remain.
3. **Given** competition, year and Used-for filters, **When** combined with search, **Then** rows must satisfy all of them.
4. **Given** any state, **Then** "Showing X of Y innings" reflects the current rows and the total.
5. **Given** filters that match nothing, **Then** an empty-state message and a "clear filters" action appear.
6. **Given** any sort or filter change on the full table, **Then** the grid responds without noticeable delay.

---

### User Story 4 - See which innings are training and which are test (Priority: P2)

A "Used for" column shows "Training" or "Test" for every innings, using the agent's split rule: the latest calendar year is test, earlier years are training. The visitor can filter to just training or just test.

**Why this priority**: Connects the data to what the agent learns from and is judged on.

**Independent Test**: Compare Used-for counts with the agent's load_data/split step.

**Acceptance Scenarios**:

1. **Given** any innings, **Then** its Used-for value agrees with the agent's split, always, including when the data is refreshed.
2. **Given** the Used-for filter set to Training or Test, **Then** only those rows show, and counts match the agent's training and test counts.

---

### User Story 5 - Understand where the data came from (Priority: P2)

Above the grid a short summary from the data's manifest shows: total innings, innings per competition, date range, the date the data was downloaded from Cricsheet, and what was excluded and why (no-results, DLS, reduced overs, innings ending before 10 overs) with counts. The Cricsheet attribution and licence note appear on the Data tab.

**Why this priority**: Provenance builds the trust the feature exists for.

**Independent Test**: Compare summary figures with the manifest and the agent's load_data step.

**Acceptance Scenarios**:

1. **Given** the Data tab, **Then** the summary shows all items above with counts taken from the manifest.
2. **Given** the summary, grid and load_data step, **Then** the row counts agree.

---

### User Story 6 - Download the data as CSV (Priority: P2)

A "Download CSV" button downloads the complete table as a .csv that opens correctly in Excel and Google Sheets. When a sort or filter is active, the visitor can choose all rows or only the rows shown, in the order shown. The file name says what it is and includes the data's download date (e.g. t20-first-innings-2026-10-01.csv). Columns match the grid, including "Used for". The Cricsheet attribution and licence note sit beside the button.

**Why this priority**: Lets visitors take the data away and check it in their own tools.

**Independent Test**: Download both variants and open them in a spreadsheet.

**Acceptance Scenarios**:

1. **Given** the Working tab, **When** the visitor clicks the Data tab then Download CSV, **Then** the complete file downloads (two clicks).
2. **Given** no active filter or sort, **Then** the button downloads all rows directly.
3. **Given** an active filter or sort, **When** the visitor opens the download choice, **Then** they can pick "all rows" or "rows shown" (in shown order).
4. **Given** venue names containing commas or quotes, **Then** they display correctly in the grid and are correctly quoted in the CSV.
5. **Given** the all-rows file, **Then** it contains exactly the same innings and values as the table the agent trains and tests on, plus Used-for.
6. **Given** a filter that matches nothing, **Then** "Download rows shown" is unavailable.

---

### User Story 7 - Recover from a data load failure (Priority: P3)

If the data cannot be loaded, the Data tab shows a clear message and a retry option; the Working tab is unaffected.

**Why this priority**: A graceful failure protects the rest of the page.

**Independent Test**: Make the data unavailable and open the Data tab, then restore it and retry.

**Acceptance Scenarios**:

1. **Given** a failed load, **Then** the Data tab shows the message and a retry action; a successful retry shows the grid.
2. **Given** a failed load, **Then** the Working tab works as normal.

---

### Edge Cases

- Venue names with commas, quotes or non-ASCII characters in grid, copy and CSV.
- Search ignores case and leading/trailing spaces in the typed term.
- Opening an unknown or empty hash falls back to Working (no extra history step).
- Numeric columns sort by number, dates by date, text alphabetically.
- Dismissing the download choice downloads nothing.
- When new data moves the latest year on, Used-for follows automatically.
- Very narrow screens and zoomed text keep the page free of sideways scroll.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The page MUST show "Working" and "Data" tabs below the intro, with Working selected by default.
- **FR-002**: Working MUST contain everything the page shows today; Data MUST contain the data viewer.
- **FR-003**: Switching tabs MUST NOT reset or interrupt a run, results, current step, try-your-own inputs, or the Data tab's sort, filters, selection and scroll position.
- **FR-004**: Each tab MUST have its own shareable link; Back/Forward MUST move between tabs (each switch to a different tab adds one history step; re-selecting the active tab adds none; an unknown hash shows Working without adding a step); a direct #data link MUST open Data with no run needed.
- **FR-005**: Tabs MUST be keyboard operable and expose correct roles and selected state to assistive technology.
- **FR-006**: The grid MUST show all innings with gridlines, sticky header row, sticky row numbers (numbered 1, 2, 3… down the rows currently shown, so the last number equals the "Showing X" count), right-aligned numbers, compact rows and a highlighted selected cell.
- **FR-007**: Columns MUST have friendly headings with meanings on hover/focus and in a column guide; competitions MUST show full names.
- **FR-008**: Clicking a heading MUST cycle ascending, descending, original order.
- **FR-009**: The viewer MUST provide a case-insensitive search across all columns, matching the text as displayed in the grid, and filters for competition, year (calendar year of the match date, as used by the train/test split) and Used-for, and MUST always show "Showing X of Y innings".
- **FR-010**: Columns MUST be resizable; the grid MUST scroll horizontally within itself and the page MUST NOT scroll sideways.
- **FR-011**: Selected cells MUST copy in a form that pastes cleanly into a spreadsheet.
- **FR-012**: The grid MUST be read-only.
- **FR-013**: A "Used for" column MUST label each innings Training or Test using the agent's own rule (latest calendar year = test, earlier = training) and MUST always agree with the agent's split.
- **FR-014**: A summary above the grid MUST show, from the data manifest: total innings, per-competition counts, date range, Cricsheet download date, and exclusions with reasons and counts (no-results, DLS, reduced overs, ended before 10 overs). The exclusions MUST state that they were decided before the agent runs, when the data was prepared, and name the script that did it, so readers know they are not the agent's decisions.
- **FR-015**: "Download CSV" MUST download the complete table as a CSV that opens correctly in Excel and Google Sheets, preserving values with commas, quotes or non-ASCII text.
- **FR-016**: When a search, filter or sort is active, the visitor MUST be able to choose between all rows and rows shown (in shown order); with no matching rows, "rows shown" MUST be unavailable.
- **FR-017**: The file name MUST describe the content and include the data's download date; its columns MUST match the grid including Used-for, using the grid's friendly headings and display labels (full competition names, Training/Test), with dates as YYYY-MM-DD and numbers plain and unformatted. "Exactly the same values as the agent's table" (SC-002) means the same innings and the same underlying values, not the same labels.
- **FR-018**: The Cricsheet attribution and licence note MUST appear beside the download button and on the Data tab.
- **FR-019**: A load failure MUST show a clear message and retry on the Data tab only; Working MUST be unaffected.
- **FR-020**: Filters matching nothing MUST show an empty state with a clear-filters action.
- **FR-021**: The tabs and viewer MUST be driven only by a table of rows, column definitions and a summary, with no knowledge of cricket or linear regression, so other algorithm apps can reuse them unchanged; they MUST be a clearly bounded part of the app.

### Key Entities

- **Innings row**: one first innings with match id, date, season, competition, venue, runs at 10, wickets at 10, powerplay runs, final total, and derived Used-for.
- **Column definition**: friendly heading, meaning, data type/alignment and display rules for one column.
- **Data summary (manifest)**: totals, per-competition counts, date range, download date, exclusions with counts, attribution/licence text.
- **View state**: current sort, search, filters, selection and scroll position, preserved across tab switches.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can get from the Working tab to a downloaded complete CSV in two clicks.
- **SC-002**: The all-rows CSV contains exactly the same innings and values as the table the agent trains and tests on (100% row and value match, plus Used-for).
- **SC-003**: Switching tabs any number of times during or after a run never restarts the run or loses displayed results (0 resets across repeated switching).
- **SC-004**: Total innings counts in the summary, the grid and the agent's load_data step agree, as do training and test counts.
- **SC-005**: Sorting, searching and filtering over all ~5,100 rows respond without noticeable delay (under 200 ms), and scrolling stays smooth.
- **SC-006**: Opening the #data link directly shows the Data tab with data within a few seconds on a typical connection, without a run.
- **SC-007**: On phone-width screens the page has no sideways scroll and the grid remains fully reachable.
- **SC-008**: Copied cells pasted into a spreadsheet, and the CSV opened in Excel and Google Sheets, show correct columns with no broken venue names.
- **SC-009**: Tabs are fully operable by keyboard alone and announce correctly in a screen reader.

## Assumptions

- The prepared innings table and its manifest from feature 001 already exist and are the single source; this feature adds no new data.
- "Year" for filtering and the train/test rule is the calendar year of the match date, consistent with feature 001's clarified split.
- The default view is original (prepared) order with no filters.
- Download uses what the visitor sees; no server-side export.
- Selecting and copying supports ranges of cells, not editing or fill operations.
- Cricsheet licence text comes from the manifest or the attribution already used in the app.
- "Rows shown" CSV follows the grid sort; ties keep original order.
- The pasted description was cut off at the final success criterion; it is read as SC-005 (sorting and filtering respond without noticeable delay).

## Out of Scope

- Editing, formulas, adding or removing rows, pinning/hiding/reordering columns.
- Charts or statistics on the Data tab beyond the summary.
- Live data refresh or re-downloading from Cricsheet.
- Other file formats (Excel, JSON).
- Changing the agent's split, features or results.
- Rolling the viewer out to the other seven apps (only keeping it reusable).
