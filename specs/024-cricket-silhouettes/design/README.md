# Cricket silhouettes: a bowler behind the hero, a batter behind the run-by-over chart

Design drafted 2026-10-23 in Claude Design, on top of feature 023 as committed (`4d0eb83`).

Files:

- `assets/bowler-silhouette.svg`: a fast bowler in the load-up (gathered in the air, about to bowl). 630 × 1013, 15.7 KB.
- `assets/batter-silhouette.svg`: a batter in the follow-through with the stumps and a ground line. 838 × 870, 4.8 KB.
- `canvas/HeroSimple.dc.html`, `canvas/HeroEverything.dc.html`: the hero at the two detail levels (visual reference only).
- `canvas/PhoneHero.dc.html`, `canvas/PhoneWorm.dc.html`: the hero and the chart card at 390 px (visual reference only;
  their `fit` setting is `focus` for the hero and `width` for the card, the chosen rows C and B).
- `canvas/WormCard.dc.html`: the run-by-over chart card with the batter behind it (visual reference only; the chart in it is a
  screenshot laid over the silhouette, not a rebuild).
- The canvas itself (private to John): https://claude.ai/artifact/H1VfFPxw5zVYwomjNMsspY

**This file is the specification; where it and the canvas differ, this file wins.** Decoration only: no wording, number,
behaviour, data or test id changes, and no new dependency.

## 1. The two silhouettes

Both SVGs are **masks**, not pictures: a black shape whose alpha carries the detail (the body at full alpha, the folds of the
kit and the overlapping limbs at half alpha). The page paints them with a colour token through CSS `mask-image`, so one file
serves both themes and the colour lives in `theme.css`, never in the SVG. Each was traced from a photo, then simplified: the
bowler's head is plain silhouette (no face), and the batter's bat and stumps were redrawn as clean shapes.

They are decoration: `aria-hidden`, no alt text, no text node, not focusable, `pointer-events: none`, never selected by a
test id that counts words. They are not printed.

## 2. The hero: the bowler

| | Value |
|---|---|
| Where | Behind everything in the hero band (`.hero-band`), above the band's background, below all text and cards |
| Colour | `#cbd5e1` (the band is fixed dark in both themes, so one fixed colour, as a new token `--silhouette-on-dark`) |
| Strength | 9 % opacity |
| Horizontal | Centred in the band |
| Size | Height about 94 % of the band at the **"Show me everything"** level (where the Commentary panel is open); width follows the SVG's aspect ratio |
| Vertical | Anchored to the top of the band (about 30 px down) |
| Facing | As drawn (running to the right) |

**Simple view opens into the full view.** The bowler's size and position do not change between the two detail levels. The
band clips him (`overflow: hidden`): at the simple level (no Commentary panel) the band is shorter, so only the top half shows,
head, gathered arms and torso to about the waist; switching on "Show me everything" opens the Commentary panel, the band grows
and the rest of him (legs and the landing boot) comes into view. He must not jump or rescale when the level changes.

Because his size is set by the "everything" height, it cannot simply be `height: 94%` of the band at whichever level is
showing: the plan decides how to fix it (for example a height derived from the band's width and the SVG's aspect ratio, or a
fixed height per breakpoint).

The goal card and the hero Commentary panel stay translucent (as now) and gain a light frosting, `backdrop-filter: blur(3px)`,
so the bowler reads through them softly rather than sharply.

## 3. The run-by-over chart card: the batter

| | Value |
|---|---|
| Where | Inside the chart card (`.worm-card`, in The problem's Commentary), behind the chart and the "About this chart" toggle |
| Colour | `var(--text)` (dark ink on the light theme, light ink on the dark theme), as a new token `--silhouette` |
| Strength | 7 % opacity (a light background shows a shape more than a dark one, so it is fainter than the bowler) |
| Horizontal | Centred in the card |
| Size | Height close to the card's height (about 95 %); width follows the aspect ratio |
| Facing | As drawn (stumps on the right) |

The chart's own backgrounds (the grey context band, the zoom panel) may cover parts of him; that is fine. Chart marks, labels
and the zoom panel are drawn on top, unchanged.

## 4. Phones and small screens

Mocked at 390 px on 2026-10-23 (canvas rows "Phone A/B/C"; C chosen for the hero, B for the chart card). Keeping the
height and centring, as first drafted (row A), crops the bowler's head off on a phone and cuts the batter's bat and stumps.

**The bowler (hero): keep his height, crop around his head and torso (row C).** His size is the same rule as on desktop
(height about 94 % of the band at the "Show me everything" level), so the simple view still shows only his top half and
"Show me everything" still reveals the rest. Horizontally:

- when the band is at least as wide as he is, he is centred (desktop, as in section 2);
- when the band is narrower, the crop is anchored on a focal point **30 % of his width in from his left edge** (his head
  and shoulders): that point sits at the centre of the band, clamped so he always covers the band edge to edge (no empty
  strip at either side). On a 390 px phone this shows his head, shoulders, gathered arms and, at "Show me everything",
  his back leg; the front arm and landing boot are cropped.

**The batter (chart card): fit to the card's width (row B).** When the card is at least as wide as his natural width at
95 % of the card's height (desktop), section 3 applies unchanged. When it is narrower, he shrinks to the card's width
(the whole figure, bat and stumps included, aspect ratio kept) and is centred vertically in the card.

Neither silhouette ever causes horizontal scrolling.

## 5. Checks that must still pass

- Contrast: every text colour on the band and in the card still meets its ratio **over the silhouette's strongest point**
  (the 9 % or 7 % tint), in both themes; feature 020's contrast check gains those two backgrounds.
- Word counts (022) and the banned-term check (021) are unchanged: the silhouettes add no text.
- The h1, the goal sentence and the Start button still fit 390 × 664 without scrolling.
- No layout shift: the silhouette is absolutely positioned and takes no space.

## 6. Image rights

Both silhouettes were traced from photos John supplied (press photos). Before the site goes public, confirm the traced
outlines may be used, or replace them with silhouettes from a licensed or self-shot photo; the SVG shape and placement rules
above stay the same.
