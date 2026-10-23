# Research: Cricket Silhouettes

Decisions for feature 024. Everything is CSS plus two tiny DOM additions; no new dependency, no backend change.

## R1 — The batter against the chart's opaque backgrounds

**Decision**: (a) an overlay above the chart, blended with the page: `mix-blend-mode: multiply` on the light theme, `screen` on the dark theme, `pointer-events: none`, `aria-hidden`. The blend mode is a theme token (`--silhouette-blend`), so the theme switch needs no extra rule.

**Rationale**:
- `worm.ts` paints three opaque fills (`--context-band`, `--surface` for the prediction area, `--surface` for the zoom card). Strictly behind the chart he would show only in the gaps, which is not the approved look.
- One element covers both layouts. Wide is one SVG, narrow is two stacked SVGs (below 560 px); an overlay on the chart host centres one batter across both. Option (b) would have to split one figure across two drawings and change `worm.ts`, its pure plan and its tests.
- `drawWorm` / `wormPlan` stay unchanged, so every existing chart test is untouched.
- Contrast stays safe: multiply with a dark ink at 7% only darkens (dark text on a light card gains contrast). Screen with a light ink at 7% on the dark theme lightens the card by at most about 14 levels and the text by about 2, so the weakest text (muted `#98a3b5` on the lightened surface) falls from about 6.6:1 to about 5.7:1, still above 4.5. The contrast test checks it exactly (R7).

**Alternatives**: (b) a layer inside the SVG(s): rejected for the reasons above. Making the chart fills translucent: changes the chart's look and its own contrast, out of scope. Strictly behind: nearly invisible.

**Spec amended**: US2 scenarios 1 and 2, FR-006, SC-006 and the "About this chart" edge case.

## R2 — Holding the bowler's size fixed across the two levels

**Decision**: CSS only. The band becomes a size container (`container-type: inline-size`). The bowler's height is a function of the band's **width**, never of its current height: `height = k × 100cqw + b`, with `(k, b)` set per layout range and calibrated once against the band's height at the "Show me everything" level. Ranges follow the hero's existing breakpoints: stacked (below 760 px viewport), two columns (760 to 1100 px) and capped (the page is at its 1100 px maximum, so a constant). His width is `height × 630 / 1013`; his top is a constant 30 px.

**Rationale**:
- The band's height depends on the Commentary panel (the point of the feature), the result strip after a run, and server text, so any rule written in terms of the band's current height would move him. A function of width alone cannot change when the level or the strip changes: 0 px difference by construction.
- No JavaScript, no measuring after first paint, nothing to flicker or animate.
- "About 94%" is the target, not an equality. Calibration is done on the band before a run at the "everything" level; the test accepts 94% ± 5 points at 390, 768, 1024 and 1280 px. Different server text or a result strip can change the band's height by a few lines; he deliberately does not follow it.

**Alternatives**: JavaScript measuring the band at the "everything" level: it needs the panel open to measure, so it would measure after layout and risk a jump. A hidden ghost copy of the panel: duplicates text (breaks word counts and screen-reader output). `height: 94%` of the current band: rejected by the design (he would rescale).

**Calibration** is task one: a throwaway Playwright script prints the band height at "everything" for widths 360 to 1280 in 40 px steps. `(k, b)` per range come from a least-squares line through those points × 0.94. The constants live in `silhouette.css` as custom properties, with the sample table in a comment.

**Fallback**: if a container query on the band proves unreliable for the `::before`-free element (it should not: the span is a child of the container), the same constants are expressed with viewport media queries and `100vw - 32px` for the band width.

## R3 — Phone rules (README section 4)

**Bowler.** Let `cw` be the band width (`100%` in `left`) and `w` his width.
- `w ≤ cw`: centred, `left: calc((100% - w) / 2)`.
- `w > cw`: `left: clamp(100% - w, 50% - 0.3 * w, 0px)`. The focal point (30% of his width in) lands on the band's centre, and the clamp keeps `left ≤ 0` and `left + w ≥ cw`, so he covers the band edge to edge with no strip either side.
- The switch between the two is a container query on the band at the width where `w` equals `cw`. It follows from R2's line (`w = 0.622 × (k × cw + b)`), so the crossover width is solved in calibration and written beside the constants. Both rules give `left = 0` at the crossover, so nothing jumps while resizing.
- A clamp is used rather than a mask-position percentage because the percentage form (`p × (cw − w)`) is undefined when `w = cw`.

**Batter.** The overlay box is the chart host inset 2.5% top and bottom, with `mask-size: contain; mask-position: center`. `contain` is exactly the README rule: when the box is wide enough he is 95% of the host's height and centred; when narrower he shrinks to the host's width with aspect ratio kept and is centred vertically. No query, no switch, no JavaScript. The host is never wider than the card, so the bat and all three stumps are inside the card.

## R4 — The batter is sized from the chart area

**Decision**: the overlay is a sibling of the chart host inside a new wrapper `div.worm-stage` (position relative) that contains only the chart host and the overlay. The "About this chart" `<details>` stays outside the wrapper. Opening it changes the card's height but not the wrapper's, so the batter's box is unchanged. The chart redraw (`host.replaceChildren`) never touches the overlay because it is a sibling of the host, not a child. Edge case amended in the spec.

## R5 — Frosting

`backdrop-filter: blur(3px)` (with the `-webkit-` prefix) on `.hero-band .goal-card` and `.hero-band .commentary`, inside `@supports`. Without support the existing translucent fills (`rgba(255,255,255,.06)`) stand on their own; nothing else depends on the blur. Scoped to the hero band so "Your turn" (also `.on-dark`) is unchanged. Blur does not change colours, so the contrast model needs no change for it.

## R6 — Where the files live, and the tokens

**Decision**: the two SVGs are copied unchanged into `web/src/page/silhouettes/` and referenced by relative `url()` from a new `silhouette.css`, so Vite fingerprints them and honours any `base`. They are not put in `public/`. Tokens go in `theme.css` (shared with Under the hood, where they are unused and harmless):

```css
:root { --silhouette: var(--text); --silhouette-alpha: .07; --silhouette-blend: multiply;
        --silhouette-on-dark: #cbd5e1; --silhouette-on-dark-alpha: .09; }
@media (prefers-color-scheme: dark) { :root { --silhouette-blend: screen; } }
```

`--silhouette` follows `--text` in both themes, so it needs no dark override.

**Note on the files**: both SVGs carry a `<metadata>` block with a C2PA content-credentials manifest from the design tool (about 7.7 KB of base64 in the bowler). It is inert in a CSS mask. Used as-is as instructed; stripping it would roughly halve the shipped bytes and is listed as an open item.

## R7 — Element, not pseudo-element; and how the tests see them

**Decision**: each silhouette is a real `<span class="silhouette ..." aria-hidden="true" data-testid="silhouette-bowler|silhouette-batter">` with no children and no text, created by a small `silhouette(kind)` helper. The bowler is added as the first child in the same `replaceChildren` that builds the hero; the batter is added in `problem.ts` inside `div.worm-stage`.
- A pseudo-element cannot be measured (`getBoundingClientRect` does not exist for it), and the geometry tests are the heart of this feature.
- It cannot take focus (a `span` without tabindex), has no text node (word counts and `visibleMainText` are unaffected; it is also `aria-hidden`), and is `display: none` in print.
- It takes no layout space: `position: absolute`, `pointer-events: none`.

**Contrast model.** `contrastOf` gains two behaviours, both at the silhouette's strongest point (mask alpha 1, so the full 9% or 7%):
1. Hero: while walking up the ancestors, an ancestor with a `.silhouette-bowler` child adds a `[203, 213, 225, 0.09]` layer on top of that ancestor's own background and below the backgrounds above it (so the goal card's and Commentary's translucent fills sit on the tinted band).
2. Chart: for a target inside `.worm-stage` with a `.silhouette-batter` sibling, the computed background and the text colour are both passed through the blend with the token ink at 0.07 (`multiply`: `x·(1−a) + a·x·c/255`; `screen`: `x·(1−a) + a·(255 − (255−x)(255−c)/255)`), chosen by the page's colour scheme. SVG text uses its `fill`.
The hero and chart selectors are added to `contrast.spec.ts` where missing (chart axis and label text, the result strip, goal card text).

## R8 — Tests that need a real run

All e2e tests use the scripted fake models and `?interval=40`. Geometry is read from the two elements' `getBoundingClientRect()` (the element box, not clipped by the band, which is what must be identical between levels). "Covers edge to edge" and "head inside" are checked against the band's rect and the focal point `left + 0.3 w`. A screenshot at 390 × 664 is reviewed once by eye to confirm the 30% focal point really is his head in the supplied shape.

## R9 — Not doing

Under the hood is untouched. No animation, parallax or reduced-motion branch is needed. No change to `worm.ts`, `worm-layout.ts`, the backend, the glossary or any wording.
