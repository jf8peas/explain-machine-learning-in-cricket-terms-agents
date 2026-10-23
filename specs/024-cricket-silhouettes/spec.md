# Feature Specification: Cricket Silhouettes

**Feature Branch**: `024-cricket-silhouettes` (work is on `main`; no branch hook ran)
**Created**: 2026-10-23
**Status**: Draft
**Input**: Cricket silhouettes: decorative silhouettes behind two containers on the linear regression page, a fast bowler behind the hero band and a batter behind the run-by-over chart card, following `specs/024-cricket-silhouettes/design/`. Builds on feature 023 as committed (`4d0eb83`).

## Context

The main page is clear but visually plain: a dark hero band and a chart card with no hint of the game they are about. The audience (data scientists, analysts, marketers, sales and finance contacts arriving from LinkedIn, often on a phone) should feel "cricket" at a glance, without a word of copy changing.

This feature adds two faint, purely decorative silhouettes: a fast bowler in the load-up behind the hero band, and a batter in the follow-through (with the stumps) behind the run-by-over chart in The problem's Commentary.

`design/README.md` is the specification; the files in `design/canvas/` are a visual reference only, and **where they differ, the README wins**. The two silhouette files in `design/assets/` are the shapes to use.

| Change | Where |
|---|---|
| A bowler silhouette behind everything in the hero band, centred, faint, clipped by the band | Main page hero |
| The goal card and the hero Commentary panel gain a light frosting so the bowler reads through them softly | Main page hero |
| A batter silhouette behind the run-by-over chart, centred, faint, in the theme's text colour | Main page, The problem's Commentary |

**Unchanged**: any wording, number, behaviour, data, term, test id or dependency; the chart's marks, labels and zoom panel; the agent and its scoring.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A bowler in the hero (Priority: P1)

A visitor opening the main page sees, faintly behind the dark hero band's content, a fast bowler gathered in the air about to bowl. It is a quiet cue to the sport, and the question, goal and Start button remain easy to read and fully visible.

**Why this priority**: The hero is the first impression, and this is the feature's main visual effect.

**Independent test**: Load the page at 390 × 664 and at desktop width at the simple level; confirm a faint figure shows behind the hero content, only its top half is visible, and the h1, goal sentence and Start button are visible without scrolling.

**Acceptance Scenarios**:

1. **Given** the page loads at the simple level (no Commentary panel), **Then** a bowler silhouette is centred behind everything in the hero band, drawn at 9% strength in the fixed colour #cbd5e1 (in both light and dark themes), anchored near the top of the band, and clipped by the band so only his top half (head, gathered arms and torso to about the waist) shows.
2. **Given** the visitor switches on "Show me everything", **Then** the Commentary panel opens, the band grows and the rest of the bowler (legs and landing boot) comes into view; his size and position do not change between the two levels, and he does not jump or rescale.
3. **Given** the "Show me everything" level, **Then** the bowler's height is about 94% of the band's height and he starts about 30 px below the top of the band.
4. **Given** the goal card and the hero Commentary panel, **Then** they stay translucent as now and gain a light frosting (a 3 px blur of what is behind them) so the bowler reads through them softly rather than sharply.
5. **Given** a phone from 390 × 664 up, **Then** his size rule is unchanged (about 94% of the band's height at the "Show me everything" level, top-anchored, the same at both levels), so the simple view still shows only his top half and "Show me everything" still reveals the rest. When the band is at least as wide as he is, he is centred. When the band is narrower, the crop is anchored on a focal point 30% of his width in from his left edge (his head and shoulders): that point sits at the centre of the band, clamped so he always covers the band edge to edge with no empty strip at either side. At 390 × 664 his head is inside the band and he spans the band's full width.
6. **Given** the h1, the goal sentence and the Start button, **Then** at 390 × 664 they remain visible without scrolling and with no horizontal scroll.

---

### User Story 2 - A batter behind the run-by-over chart (Priority: P2)

A visitor opening The problem's Commentary sees, very faintly behind the run-by-over chart, a batter in the follow-through with the stumps, in the page's ink colour so it works in light and dark themes.

**Why this priority**: A smaller, secondary touch inside a deeper level of detail.

**Independent test**: Open the run-by-over chart card in both themes; confirm a faint batter and stumps sit behind the chart, centred, and the chart and "About this chart" toggle are unchanged and fully legible.

**Acceptance Scenarios**:

1. **Given** the run-by-over chart card, **Then** a batter silhouette (with stumps and a ground line) sits centred over the chart area (the chart's drawing, not the "About this chart" toggle below it), at 7% strength in the theme's text colour (dark ink on the light theme, light ink on the dark theme), at a height close to the card's height (about 95%).
2. **Given** the chart's own opaque backgrounds (the grey context band, the prediction area, the zoom panel), **Then** the batter is blended over the whole chart (darkening it very slightly on the light theme, lightening it very slightly on the dark theme) so he shows faintly through all of it, and no mark, label or the zoom panel changes position, size, shape or colour. He takes no pointer input, so the chart behaves exactly as before.
3. **Given** a card narrower than the batter's natural width at 95% of the card's height (as on a phone from 390 × 664 up), **Then** he shrinks to the card's width (the whole figure, bat and stumps included, aspect ratio kept) and is centred vertically in the card; on desktop nothing changes. At 390 × 664 the bat tip and all three stumps are inside the card.

---

### User Story 3 - Decoration that costs nothing (Priority: P1)

A maintainer and every visitor, including those using a screen reader, keyboard, or printer, are unaffected by the silhouettes.

**Why this priority**: Decoration must not harm readability, accessibility or existing checks.

**Independent test**: Run the existing contrast, word-count, banned-term and phone-fit checks with the silhouettes in place, in both themes; check the accessibility tree, tab order and print preview.

**Acceptance Scenarios**:

1. **Given** either silhouette, **Then** it is hidden from assistive technology, has no alt text or text, cannot take focus, ignores pointer input, and is not printed.
2. **Given** either silhouette, **Then** it takes no layout space: nothing moves, resizes or shifts when it is present.
3. **Given** every text colour on the hero band and in the chart card, in both themes, **Then** it still meets its contrast ratio over the silhouette's strongest tint (the 9% or 7% shape), and feature 020's contrast check covers those two backgrounds.
4. **Given** features 022 and 021, **Then** the word limits and the banned-term check pass unchanged, because the silhouettes add no text.
5. **Given** both silhouette shapes, **Then** they are single shape files that serve both themes, with the colour set by page styling tokens and never inside the shape file.

### Edge Cases

- The Commentary panel opens or closes while the page is displayed: the bowler must not move, resize or flicker; only how much of him is clipped changes.
- Narrow screens: the bowler keeps his size and is cropped around his head and shoulders (his head always visible, no empty strip at either side); the batter shrinks to fit the card's width so his bat and stumps are never cut. Wide screens: both stay centred at their desktop size. Neither is ever stretched, and neither ever causes horizontal scrolling.
- Switching between light and dark themes: the bowler's colour and strength stay fixed (the band is dark in both); the batter's colour follows the theme.
- Print: neither silhouette appears.
- The "About this chart" text opens or closes: the batter is sized from the chart area, not the whole card, so he does not move or rescale.
- Reduced motion and high-contrast preferences: the silhouettes are static, so nothing animates.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The hero band MUST show a bowler silhouette (design asset `bowler-silhouette.svg`) behind all of the band's content, above the band's background and below all text and cards, centred horizontally, in the fixed colour #cbd5e1 at 9% strength, via a new colour token for use on the dark band.
- **FR-002**: The bowler MUST be sized so his height is about 94% of the band's height at the "Show me everything" level (width follows the shape's aspect ratio) and positioned about 30 px below the top of the band, facing as drawn (running to the right).
- **FR-003**: The hero band MUST clip the bowler. At the simple level only the top half of him MUST show; at "Show me everything" the band grows and shows the rest.
- **FR-004**: The bowler's size and position MUST be identical at both detail levels; changing level MUST NOT move or rescale him.
- **FR-005**: The goal card and the hero Commentary panel MUST stay translucent and MUST gain a light frosting (3 px blur of what is behind).
- **FR-006**: The run-by-over chart card MUST show a batter silhouette (design asset `batter-silhouette.svg`) centred over the chart area, about 95% of the chart area's height, facing as drawn (stumps on the right), at 7% strength in the theme's text colour via a new colour token. Because the chart paints opaque backgrounds, he is drawn as a non-interactive overlay above the chart blended with the page (multiply on the light theme, screen on the dark theme), not strictly behind it. The chart's marks, labels and zoom panel are unchanged and remain fully legible.
- **FR-007**: On phones from 390 × 664 up each silhouette has its own rule. (a) The bowler keeps the desktop size rule; when the band is at least as wide as he is he MUST be centred, and when narrower the crop MUST be anchored on a focal point 30% of his width in from his left edge, placed at the centre of the band and clamped so he covers the band edge to edge with no empty strip; his head MUST always be visible. (b) The batter, when the card is narrower than his natural width at 95% of the card's height, MUST shrink to the card's width with aspect ratio kept and be centred vertically; his bat and stumps MUST always be fully visible. (c) Neither silhouette MAY cause horizontal scrolling.
- **FR-008**: Both silhouettes MUST be painted from the shape files as masks using the colour tokens, so one file serves both themes and the colour never lives in the file.
- **FR-009**: Both silhouettes MUST be decorative only: hidden from assistive technology, no text, not focusable, not interactive, not printed, and MUST take no layout space.
- **FR-010**: Text contrast over each silhouette's strongest tint MUST still meet its required ratio in both themes, and feature 020's contrast check MUST include the hero band and chart card over the silhouettes.
- **FR-011**: The word limits of feature 022 and the banned-term check of feature 021 MUST still pass, and at 390 × 664 the h1, the goal sentence and the Start button MUST be visible without scrolling, with no horizontal scroll.
- **FR-012**: Nothing else MUST change: no wording, number, behaviour, data, term, test id or dependency.
- **FR-013**: The open items MUST record that both silhouettes were traced from press photos supplied by John, and that their use must be confirmed, or the source photos replaced by licensed or self-shot ones (keeping the same shape and placement rules), before the site goes public.

### Key Entities

- **Bowler silhouette**: a single-colour alpha shape of a fast bowler in the load-up, 630 × 1013, used behind the hero band.
- **Batter silhouette**: a single-colour alpha shape of a batter in the follow-through with stumps and a ground line, 838 × 870, used behind the chart card.
- **Silhouette colour tokens**: the fixed on-dark colour (#cbd5e1) and the theme-following ink colour, with their strengths (9% and 7%).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At the simple level, a visitor sees about the top half of the bowler faintly behind the hero; at "Show me everything", the whole figure shows, and measured against the page his size and position differ by 0 px between the two levels.
- **SC-002**: On a 390 × 664 screen, the h1, the goal sentence and the Start button are visible on first load without scrolling, with no horizontal scroll, in both themes.
- **SC-003**: Every text colour on the hero band and in the chart card meets its contrast ratio over the 9% and 7% tints respectively, in both themes (zero failures in feature 020's check).
- **SC-004**: Both pages stay within feature 022's word limits and pass feature 021's banned-term check, with zero words added.
- **SC-005**: Adding the silhouettes shifts the position of every other element by 0 px, and the silhouettes are absent from the accessibility tree, the tab order and printed output.
- **SC-006**: The batter is visible through the chart in both themes at 7% strength, and the chart's marks, labels and zoom panel are unchanged in appearance and legibility.
- **SC-007**: On a 390 × 664 screen, the bowler's head is inside the hero band and he spans the band's full width with no empty strip; the batter's bat tip and all three stumps are inside the chart card; and neither silhouette adds horizontal scroll.

## Assumptions

- The design README's values (strengths, colours, 94%, about 30 px, 95%, 3 px blur) are exact intent; how the bowler's size is held fixed across levels is a planning decision.
- Only the main page's hero band and the run-by-over chart card get silhouettes; the Under the Hood page is untouched.

## Open Items

- **Image rights**: both silhouettes were traced from press photos supplied by John. Before the site goes public, confirm that the traced outlines may be used, or replace them with silhouettes from a licensed or self-shot photo (same shape and placement rules).
