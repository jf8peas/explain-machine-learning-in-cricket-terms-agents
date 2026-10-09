# Research: A Lighter Goal Section (the "Miss Meter")

Date: 2026-10-09. The design is in `design/README.md` and `design/goal-section-1a.html`; this file records the decisions the design left open. No new dependency is needed for any of them.

## What the design assumes, checked against the real data

Training-year figures from `/api/reference` today: know-nothing guess 29.4, TV projection 21.8, margin 3, so the goal value is 18.8. The design's fixed scale (15 to 32 runs) gives positions of 22.4%, 40% and 84.7%. That scale suits today's numbers only; it would clip if the data or the margin changed, and the design itself says to derive it from the data.

Two measurements that shape the decisions below:

- **Space for labels.** On a 360 px phone the meter's card has about 300 px of track. Label text ("Know-nothing guess", "TV projection", "The goal") is 50 to 120 px wide, centred on its mark. A mark within about 60 px of an end would have half its label outside the card.
- **The goal and the TV projection are always one margin apart** (3 runs). On the design's scale that is 17.6% of the track: about 100 px on desktop, but only about 50 px at 360 px, where the labels "The goal" (50 px) and "TV projection" (85 px) cannot sit side by side. So the narrow layout needs a rule for staggering labels, not just smaller type.

## Decision 1: The server works out the goal value and the scale

`goal.py` gets a function that takes the two displayed average misses and returns the whole meter: the goal's value (the TV projection's displayed miss minus `MARGIN_RUNS`, to one decimal, the same way `verdict()` works), the scale, the three marks, a caption and a text equivalent. `reference_api.py` adds it to the response as one object, `meter`.

- **Why the server**: `reference.ts` today types no number and no sentence, and `goal.py` already defines the goal and the displayed-figure arithmetic. Putting the new arithmetic beside them keeps one source, lets pytest check it on made-up numbers (including rounding), and means the page and the verdict can never disagree about the goal's value.
- **What stays in the browser**: turning a value and a scale into a percentage along the line. That is geometry, not a figure, and it is tested in Vitest.
- **One object, not two fields**: the brief suggests `goal.target_miss` and a separate `scale`. I put the goal's value in the meter's marks (the mark with id `goal`) and the scale beside them, so the value is stored once. `goal` itself gains only the lead sentence (Decision 3).
- **Failure**: if the figures cannot be worked out, `meter` is `null`, as `figures` is.

**Alternative considered**: compute everything in `reference.ts`. Rejected: it would be the first number the page works out itself, and the rounding rule would live in two places.

## Decision 2: The scale rule, and how positions are rounded

The three values (the two misses and the goal) set the scale: `low` and `high` are the smallest and largest, and the padding on each side is `P = max(3, ceil(0.2 × (high − low)))` runs. The scale is `min = floor(low − P)` and `max = ceil(high + P)`, whole runs (named constants `SCALE_MIN_PAD = 3` and `SCALE_PAD_SHARE = 0.2` in `goal.py`).

On today's data: values 18.8, 21.8 and 29.4, so `P = max(3, ceil(2.12)) = 3`, the scale is 15 to 33 and the marks sit at 21.1%, 37.8% and 80.0%. Each end keeps at least about 20% of the track free, which at 300 px is about 60 px, enough for half of the widest wrapped label.

Why not the design's suggestion (`floor(goal − 4)` to `ceil(know-nothing + 3)`): it assumes the order goal < projection < know-nothing and gives the two ends different room. If the projection were worse than the know-nothing guess it would clip. Using the smallest and largest of the three works in any order, and a goal at or below zero simply extends the scale below zero (the edge case in the spec).

A position is `(value − min) / (max − min) × 100`, rounded to one decimal place and kept between 0 and 100. Because the scale always includes every value with padding, no mark is ever at 0 or 100.

## Decision 3: The lead line is built on the server

`goal()` gains a `lead` field: "At 10 overs, the TV shows a projected score. The agent tries to beat it: predict the final total, and miss by N runs less on average." with N from the same margin that builds `text`. It needs no figures, so it is available even when the figures are not (the figures-missing state still has something honest to say). The page types none of it.

This makes the lead line a second sentence about the goal, written next to the first in `goal.py`, so the one-source rule from feature 006 still holds: change `MARGIN_RUNS` and both change. A test checks it.

**Alternative considered**: interpolate the margin in `reference.ts`. Rejected: it is the number the earlier features worked to keep out of the page, and it would need a hand-written sentence in the page.

## Decision 4: Positioned HTML, not inline SVG

The meter is ordinary HTML elements positioned along a track with `left: N%` and `transform: translateX(-50%)`, as in the design.

- **Text scaling and wrapping**: labels and values are real text in `rem`, so they grow with the visitor's text size and wrap onto two lines when there is no room. SVG text neither wraps nor reflows; a `viewBox` that shrinks on a phone also shrinks the text, which is the opposite of what a 360 px layout needs.
- **Dark mode**: plain CSS variables from `:root`, with no extra rules (SVG fills would need the same variables plus `currentColor` plumbing).
- **Accessibility**: the figure (top row and track) is one `role="img"` element with an `aria-label` holding the server's text equivalent, and its visual parts are hidden from assistive technology so nothing is read twice. The footer sits outside it so the goal's text stays readable by screen readers (children of `role="img"` are not exposed).
- **Geometry**: the one thing SVG does better, exact shapes, is not needed: a dot, a short line and a shaded bar are all simple boxes.

## Decision 5: Keeping labels apart

At any width the marks keep their true positions. Label collisions are avoided by a rule, applied in CSS from data attributes the page sets from a small pure function (`layoutRows`, in Vitest):

- **Wide screens (760 px and up)**: all labels sit above the line and all values below it, as in the design. Two marks closer than 14% of the track (a starting value, kept as a named constant; the widest label pairs need about 15.5% at 768 px, so the 768 px test may raise it) get different vertical rows (the later one is pushed down), so close values still do not overlap.
- **Narrow screens (below 760 px)**: the goal's label and value go **above** the line (with a short stem to it) and the references' labels and values go **below** it, so the goal can never collide with the TV projection, the pair that is always only a margin apart. Two references closer than 30% of the track get different rows. Names wrap (a maximum width of about 6.5 em) and values shrink to 1.1 rem. The "better" and "worse" end labels are not shown.

The thresholds are in the function as named constants. A Playwright test measures every mark's name and value boxes at 360, 390, 768 and 1280 px, for the real data and for crafted responses (the projection worse than the know-nothing guess, a goal below zero, a large margin), and fails on any overlap or any box outside the card.

## Decision 6: The pieces of the page, and who builds them

| Piece | Built by | Why |
|---|---|---|
| Eyebrow, title, chips, the first closed section (the two paragraphs, word for word) | `index.html`, static | They need no figures and must not change |
| Lead line, the meter, the goal footer | `reference.ts`, from `/api/reference`, inside the region that keeps `aria-live="polite"` | They are the figures |
| The second closed section's content (headline sentence, table, note) | `reference.ts` | Unchanged from today, but inside a closed section |

The goal's test identifier moves to the meter's footer, which reads "The goal:" and the server's goal text, so the existing checks for "The goal:" and "at least 3 runs" still hold. The headline sentence keeps `reference-lead` and moves to the top of the second section (the spec's assumption); the new lead line is `intro-lead`.

**When the server answers without figures** (`meter` is `null`): the lead line and a plain goal line (the same `goal` element, "The goal: …") still show, the meter is not drawn, the error message shows, and the second section is hidden. This keeps feature 006's behaviour that the goal is shown even when the figures are not. **When the request itself fails**: the lead line, meter and goal are hidden and only the message shows, as today.

## Decision 7: CSS that becomes dead, and what replaces it

Removed from the single `<style>` block in `index.html`:

| Rule | Why it is dead |
|---|---|
| `.intro-body`, `.intro-body p`, `.intro-body strong`, and its `@media (max-width: 760px)` rule | The two paragraphs move into a closed section with their own light styling |
| `.goal` (the old left-bordered box) | The goal is now the meter's footer |
| `.intro-ref`, `.intro-ref .goal`, and its `@media` rule | The two-column goal-and-table row is gone |
| `.reference`, `.reference p`, `.reference .reference-lead` | The region's old text styling; replaced by the meter styles and a smaller set for the second section |

Kept: `.table-scroll` (also used by the results tables), the `table.reference-table` rules (the table is unchanged), `.reference-error`, `.sr-only` (already defined, used by the table caption). Added: `.intro-lead`, `.meter` and its parts, `.chips`, `.chip`, and `details.intro-more`.

## Decision 8: Colours

All from the existing `:root` tokens, so dark mode follows without extra rules: line `--border`; goal zone fill `--win-bg` with a `--win` border; goal mark and text `--win`; TV projection `--text`; know-nothing `--muted`; language-model chip `--accent`; card border `--border`. A Vitest test reads `index.html` and checks, as the chart colours test does, that each of these has at least 4.5:1 against its background for text and 3:1 for graphics in both themes. Nothing relies on colour alone: marks have names and values, the references are dots and the goal is a line with a shaded zone.

## Decision 9: Height and words

The new section is lighter than today's, but SC-007 (Play no lower than about 750 px at 1280 × 800) is tested, not assumed: the first task measures Play's position with the redesigned section before anything else is polished. SC-002 (at most 120 visible words) is checked by counting the section's rendered text with both closed sections closed; closed content is not rendered text.

## Open questions

None blocking. One judgement call to check when you first look at the page: the narrow-screen arrangement (goal above the line, references below it).
