# Feature Specification: The Broadcaster's Projected Score

**Feature Branch**: `023-broadcaster-projection` (work is on `main`; no branch hook ran)
**Created**: 2026-10-23
**Status**: Draft
**Input**: The broadcaster's projected score: change the hero question to "Can an AI agent build a regression model that beats the broadcaster's projected score?" with the new lead, and replace "TV" with "broadcaster" everywhere a visitor sees or hears it, through feature 021's term list, following `specs/023-broadcaster-projection/design/`. Builds on feature 022 as committed (`a166173`).

## Context

Feature 022 put the question and the goal first. Two things about the wording still hold the page back. The question says the agent builds "its own prediction model", which hides that this is a regression model, the thing the audience (data scientists, analysts, marketers, sales and finance contacts arriving from LinkedIn, often on a phone) came to see. And the yardstick is called "the TV", which is vague: the number being beaten is the projected score a broadcaster shows on screen.

This feature sharpens the question and gives the yardstick one name, everywhere a visitor sees or hears it.

`design/README.md` is the specification for copy and behaviour; `design/canvas/AppPlay.dc.html` is a visual reference only, and **where they differ, the README wins**. As before, every number and data-dependent sentence comes from the backend, and every visible word follows feature 021's term list.

| Change | Where |
|---|---|
| Hero h1 becomes "Can an AI agent build a regression model that beats the broadcaster's projected score?", with the new lead | Main page |
| Page title and preview title become "Can an AI agent beat the broadcaster's projected score?"; preview description reworded with "broadcaster" | Main page |
| "TV" becomes "broadcaster" wherever a visitor sees or hears it, on both pages and at every level | Both pages, backend wording |
| Feature 021's term list gains the new names (term id `tv` unchanged) | Term list |
| The reword prompt's example says "the broadcaster" | Language-model wording |
| The banned-term list gains the old TV names | Banned-term check |

**Unchanged**: everything else on both pages; the agent's nodes, edges, prompts' structure and rules, and scoring; the run gate; the data; internal identifiers (term id `tv`, fact names such as `tv_gap`, CSS classes, test ids, state keys).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A sharper question on first sight (Priority: P1)

A visitor opening the main page reads "Can an AI agent build a regression model that beats the broadcaster's projected score?" and a lead that tells them what the experiment is, before any result.

**Why this priority**: The hero is the first impression and the reason for the change.

**Independent test**: Load the page on a 390 × 664 screen with no run; check the h1, the goal sentence and the Start button are visible without scrolling and no horizontal scroll appears.

**Acceptance Scenarios**:

1. **Given** the page loads, **Then** the h1 reads "Can an AI agent build a regression model that beats the broadcaster's projected score?" and the lead reads "Halfway through a T20 innings, where will it finish? The agent chooses the clues, code does the maths, and it's tested on a season it has never seen."
2. **Given** a phone-width screen of 390 × 664 px, **Then** the h1, the goal sentence and the Start button are visible without scrolling, with no horizontal scroll, despite the longer h1.
3. **Given** the page `<title>` and the preview (share) tags, **Then** the title is "Can an AI agent beat the broadcaster's projected score?" and the description keeps 022's meaning (choose an AI and watch it try), worded with "broadcaster".

---

### User Story 2 - One name for the yardstick, everywhere (Priority: P1)

A visitor, at any level of detail, only ever meets "the broadcaster" or "the broadcaster's projection", never "TV".

**Why this priority**: A name that changes between places confuses the reader and weakens the question.

**Independent test**: Run a finished fake-model run on both pages at the Scoreboard, Commentary and Scorebook levels and search all visible text, aria-labels, live-region lines, chart text, tables, titles and preview tags for the word "TV".

**Acceptance Scenarios**:

1. **Given** the goal card, **Then** it reads "Beat the broadcaster's projection by at least {goal margin} runs on average." and its figure label reads "runs: how far out the broadcaster usually is, on past innings ({first year}–{last year})".
2. **Given** a finished run, **Then** the result strip reads, for example, "…The agent was 17.9 runs out, the broadcaster 21.4.", the problem heading reads "The broadcaster's projection is usually about 22 runs out.", its tile reads "Broadcaster said", and the verdict heading reads "… the agent beat the broadcaster by 3.5 runs."
3. **Given** the bars and closeness chart, **Then** the method is labelled "Broadcaster's projection"; the rule of thumb reads "Take the broadcaster's projection, then add …"; "Your turn" reads "See the agent's prediction next to the broadcaster's." with the tile "Broadcaster: 164".
4. **Given** a run in progress, **Then** the "Right now" line reads "Scoring the broadcaster's projection and the average-total guess"; the hero Commentary asks "How good is the broadcaster?" and says the projection "guesses too low"; the run-by-over chart refers to "the broadcaster's straight line".
5. **Given** the technical level (Commentary, Scorebook), **Then** the method keeps its technical term "run rate × 20 overs" and the broadcaster name appears wherever "TV" did.
6. **Given** any aria-label, live-region line, chart description, table, page title or preview tag on either page, **Then** none contains "TV" as a word in any case.
7. **Given** backend sentence builders, **Then** they take both forms ("the broadcaster", "broadcaster's projection") from the term list and do not add "'s" themselves.

---

### User Story 3 - The name stays fixed and a live model uses it (Priority: P2)

A maintainer finds the old name cannot creep back, and a live language model's reworded takeaways use the new name instead of being rejected.

**Why this priority**: Without the guard and the prompt change, the next run's wording would regress or fall back.

**Independent test**: Run the banned-term check on a finished fake-model run with a planted "the TV"; check the reword prompt's example; run a reword with a fake reply that says "the broadcaster" and one that says "the TV".

**Acceptance Scenarios**:

1. **Given** feature 021's banned-term list, **Then** it also bans "TV projection", "the TV" and the standalone word "TV" (any case, word-bounded), and a planted occurrence in visible prose fails the check.
2. **Given** the agent's quoted reasoning, **Then** it stays exempt from the check and is shown exactly as written.
3. **Given** the reword prompt for `write_in_cricket_terms`, **Then** its example says "the broadcaster" (wording only; structure, rules and facts unchanged), and a reply using "the broadcaster" is accepted while a reply using "the TV" is rejected by the reply check and falls back as 021 describes.
4. **Given** internal identifiers (term id `tv`, fact names such as `tv_gap`, CSS classes, test ids, state keys), **Then** they are unchanged.

### Edge Cases

- The longer h1 wraps to more lines on a phone: the h1, goal sentence and Start button must still fit the first screen at 390 × 664.
- The agent's quoted reasoning may say "TV": it is shown as written and exempt from the banned-term check.
- A possessive form is needed in a sentence the backend builds ("the broadcaster's"): it comes from the term list, not from appending "'s".
- Word-bounded matching: words that merely contain the letters (for example "television") are not flagged or altered.
- A language model reply that still says "the TV" is rejected and the 021 fallback wording is used, so no visitor sees "TV".
- Before the term list has loaded, the hero question shows the neutral "Can an agent build a regression model that beats the projected score?" and never a placeholder or "TV".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The hero h1 MUST read "Can an AI agent build a regression model that beats the broadcaster's projected score?" and the lead MUST read "Halfway through a T20 innings, where will it finish? The agent chooses the clues, code does the maths, and it's tested on a season it has never seen."
- **FR-002**: The page `<title>` and preview title MUST read "Can an AI agent beat the broadcaster's projected score?" and the preview description MUST keep 022's meaning (choose an AI and watch it try), worded with "broadcaster".
- **FR-003**: "TV" MUST be replaced by "broadcaster" everywhere a visitor can see or hear it, on both pages, at every level (Scoreboard, Commentary, Scorebook), in charts, tables, aria-labels, live-region lines, the "Right now" step lines, page titles and preview tags, using the wording in the design README's examples table.
- **FR-004**: Feature 021's term list MUST remain the single source and MUST gain the new names for term id `tv` (id unchanged): plain term "broadcaster's projection", short form "the broadcaster", the short form's possessive "the broadcaster's" (for lines such as "the broadcaster's straight line"), technical term "run rate × 20 overs". The list also supplies the phrase "broadcaster's projected score" used by the hero question and page title.
- **FR-005**: "The broadcaster" MUST be used in running text ("beat the broadcaster", "the broadcaster 21.4") and "broadcaster's projection" as the name of the method (bars, tables, keys, card titles); backend sentence builders MUST take the forms (long, short, short possessive) from the term list rather than adding "'s" themselves.
- **FR-006**: The goal card figure label MUST read "runs: how far out the broadcaster usually is, on past innings ({first year}–{last year})", with years from the backend.
- **FR-007**: The reword prompt for `write_in_cricket_terms` MUST use "the broadcaster" in its example wording; its structure, rules and facts MUST be unchanged.
- **FR-008**: Feature 021's banned-term list MUST gain "TV projection", "the TV" and the standalone word "TV" (any case, word-bounded), with the agent's quoted reasoning still exempt.
- **FR-009**: Internal identifiers (term id `tv`, fact names such as `tv_gap`, CSS classes, test ids, state keys) MUST keep "tv".
- **FR-010**: Word limits from feature 022 MUST still hold (simple view at most 500 words before a run and after a fake-model run, excluding the agent's quoted reasoning; at most 1,200 with everything open), and at 390 × 664 the h1, goal sentence and Start button MUST be visible without scrolling, with no horizontal scroll.
- **FR-011**: Nothing else MUST change: other page copy, the agent's nodes, edges and scoring, the run gate, and the data.

### Key Entities

- **Term list entry `tv`**: the id stays; its plain term, short form, short possessive and technical term change to the broadcaster names; it is the one source of every sentence that names the yardstick.
- **Banned-term list**: the words the check rejects in visible prose; gains the old TV names.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A search of all visible text, aria-labels, live-region lines, chart text, tables, titles and preview tags on both pages, at all three levels, after a finished fake-model run, finds zero occurrences of the word "TV" outside the agent's quoted reasoning.
- **SC-002**: On a 390 × 664 screen, the h1, the goal sentence and the Start button are visible on first load without scrolling, with no horizontal scroll.
- **SC-003**: The banned-term check fails a planted "TV", "the TV" or "TV projection" in visible prose in 100% of cases and passes on a finished fake-model run.
- **SC-004**: Both pages stay within the word limits (at most 500 words simple, before a run and after a fake-model run; at most 1,200 with everything open).
- **SC-005**: A reworded takeaway from a fake model that says "the broadcaster" is accepted, and one that says "the TV" is rejected and replaced by the fallback wording, in every test case.
- **SC-006**: Every example in the design README's examples table appears verbatim, with its numbers and years from the backend, in the corresponding place on the page.

## Assumptions

- Feature 022 as committed (`a166173`) is the baseline; the hero's lead differs from 022's only by "it's" in place of "it is".
- The design README's wording governs where it differs from the canvas, and the term list stays the single source of names.
- "Hears" includes screen-reader output: aria-labels and live-region lines are in scope.
- All figures remain backend-supplied; only wording changes.
- The agent's own quoted reasoning is shown exactly as written and is not rewritten.
