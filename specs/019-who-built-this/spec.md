# Feature Specification: Who Built This: Author and Tester Credit on the "How this app was built" Page

**Feature Branch**: `019-who-built-this` (work is on `main`; no branch hook ran)
**Created**: 2026-10-21
**Status**: Draft
**Input**: Add a "Who built this" section to the "How this app was built" page (feature 018), crediting the author, John Fong, and the tester, Alesja Tanabe, following `specs/019-who-built-this/design/`.

## Context

Visitors reading how the app was built cannot tell who made it or who tested it. The recipe-agent app's About page credits its author and testers; this feature does the same here.

`design/README.md` is the specification for copy, URLs and layout; the pictures in `design/` are visual references only. **Where they differ, the README wins.** The page keeps its existing look: colours, light and dark themes, card and kicker styles and the pill style of the jump links are reused, not redefined.

| Change | Where |
|---|---|
| New last section "Who built this" (`id="people"`) | After Part 5 (Shipping it), before the footer |
| Seventh jump link "Who built this" | After "5 · Shipping it" |
| Footer credit line "Built by John Fong · Tested by Alesja Tanabe" | Above the Cricsheet attribution |

**Unchanged**: the main page (including its header, which gets no Author link), the rest of the "How this app was built" page and its live figures, and the recipe-agent app.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See who built and tested the app (Priority: P1)

A visitor who has read the page reaches a final section naming the author and the tester, with a short bio for each and a link to each person's LinkedIn profile.

**Why this priority**: It is the feature's purpose.

**Independent test**: Load the page and check the section, its copy and both links automatically; judge the look against the design by eye.

**Acceptance Scenarios**:

1. **Given** the page, **Then** a section with id "people" follows Part 5 and precedes the footer.
2. **Given** the section, **Then** it shows the kicker "Who built this" (same style as the "Part 1" to "Part 5" kickers), the heading "John Fong", the two-sentence bio and the link "View LinkedIn profile →" to `https://www.linkedin.com/in/john-fong-04b7a120/`, with the copy exactly as in `design/README.md`.
3. **Given** the section, **Then** below the author it shows a card headed "Who's testing it" (muted kicker) with "Alesja Tanabe", her bio (muted) and the link "View LinkedIn profile →" to `https://www.linkedin.com/in/alesja-tanabe-3207931b1`, with the copy exactly as in `design/README.md`.
4. **Given** the footer, **Then** the line "Built by John Fong · Tested by Alesja Tanabe" appears above the Cricsheet attribution.
5. **Given** the page, **Then** all of this is fixed text: nothing is fetched, there are no photos or images, and no new route or dependency is added.

---

### User Story 2 - Jump to the credits (Priority: P2)

A visitor uses the jump links at the top to go straight to the credits.

**Independent test**: Check the jump-link list and its target automatically.

**Acceptance Scenarios**:

1. **Given** the jump links, **Then** there are seven, the last being "Who built this", after "5 · Shipping it".
2. **When** "Who built this" is activated, **Then** the page moves to the "people" section.
3. **Given** phone width, **Then** the jump-link row still wraps without sideways scrolling.

---

### User Story 3 - Open a LinkedIn profile safely and accessibly (Priority: P2)

A visitor, including one using a keyboard or screen reader, can open either profile without losing the page.

**Independent test**: Check the links' attributes, size, focus and accessible names automatically; judge the pill look by eye.

**Acceptance Scenarios**:

1. **Given** either LinkedIn link, **Then** it opens in a new tab without giving the new tab access to the page's window.
2. **Given** either link, **Then** it is pill-shaped like the jump links, at least 44 px tall, on its own line, left aligned and not stretched to full width, shows the surface background on hover and a visible focus outline from the keyboard.
3. **Given** the keyboard tab order, **Then** both links are reachable, in reading order, after the Part 5 content and before the footer links.
4. **Given** a screen reader, **Then** each link's accessible name starts with its visible text, says whose profile it is and that it opens in a new tab: "View LinkedIn profile for John Fong (opens in a new tab)" and "View LinkedIn profile for Alesja Tanabe (opens in a new tab)", so the two links with identical visible text are distinguishable and the name contains the visible label.

---

### Edge Cases

- A second tester is added later: the tester card can be repeated as a sibling with no change to the section's layout or styles; only one tester (Alesja Tanabe) is shown now.
- 360 px wide screen: the section, bios, card and links cause no horizontal scrolling and long profile text wraps.
- Dark theme: all new text, links and the card meet the same contrast as the rest of the page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The page MUST have a final content section with id "people", after Part 5 and before the footer, containing the author block and the tester card as specified in `design/README.md`.
- **FR-002**: All copy and both profile addresses MUST be exactly as in `design/README.md`.
- **FR-003**: The jump links MUST gain a seventh link "Who built this" to `#people`, after "5 · Shipping it".
- **FR-004**: The footer MUST show "Built by John Fong · Tested by Alesja Tanabe" above the Cricsheet attribution.
- **FR-005**: Both LinkedIn links MUST open in a new tab without opener access, be at least 44 px tall, be keyboard reachable with a visible focus outline, and have accessible names that start with the visible text and state whose profile it is and that it opens in a new tab.
- **FR-006**: The new content MUST reuse the page's existing colours, themes, card, kicker and jump-link pill styles, and MUST NOT introduce new design tokens or a separate look.
- **FR-007**: The tester card MUST be repeatable as a sibling so a second tester can be added without redesign; only one tester is shown.
- **FR-008**: The new content MUST be fixed text only: no fetching, no new route, no new dependency, no photos.
- **FR-009**: There MUST be no horizontal scrolling at 360 px width, and text contrast MUST be at least 4.5:1 in light and dark themes.
- **FR-010**: The main page, including its header, MUST NOT change; no Author link is added.
- **FR-011**: The feature 018 checks that list the jump links and the keyboard tab order MUST be updated to include the new link and section, and every other check on the page MUST still pass.

### Key Entities

- **Person credit**: a name, a short bio, a role (author or tester) and a profile address; one author and one tester now.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can reach the credits from the top of the page in one action (the "Who built this" jump link).
- **SC-002**: Both people's names, bios and profile links are present and match the design copy exactly (2 of 2).
- **SC-003**: 100% of the new links are at least 44 px tall, reachable by keyboard and have a distinguishing accessible name.
- **SC-004**: At 360 px width there is no horizontal scrolling, and all new text meets 4.5:1 contrast in both themes.
- **SC-005**: The main page is unchanged and all updated and existing page checks pass.

## Assumptions

- The footer credit line is plain text (no link) and follows the footer's existing text style.
- The section heading hierarchy follows the design: h2 for the author, h3 for the tester.
- Each link's accessible name begins with its visible text "View LinkedIn profile" (WCAG 2.5.3, label in name), followed by "for <name> (opens in a new tab)"; the visible arrow is not part of the name.

## Out of Scope

The main page and its header; the rest of the "How this app was built" page and its live figures; the recipe-agent app.
