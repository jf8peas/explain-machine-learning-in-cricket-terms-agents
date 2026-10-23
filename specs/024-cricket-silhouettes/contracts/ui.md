# UI contract: Cricket Silhouettes

The feature's only interface. No API or data contract changes.

## DOM

- `#hero > span.silhouette.silhouette-bowler[aria-hidden=true][data-testid=silhouette-bowler]` (first child, before `.hero-inner`). Empty. Not focusable. `pointer-events: none`. `display: none` under `@media print`.
- `figure.worm-card > div.worm-stage > (div[data-testid=worm-chart], span.silhouette.silhouette-batter[aria-hidden=true][data-testid=silhouette-batter])`. The `details.worm-about` stays a sibling of `.worm-stage` inside the figure. Existing test ids and the chart's drawing are unchanged; `worm-chart` is only re-parented one level.
- No new text anywhere. `visibleMainText`, word counts and the banned-term check see nothing new.

## Geometry guarantees (testable)

| # | Guarantee | How it is measured |
|---|---|---|
| G1 | Bowler box identical at simple and "everything" | `getBoundingClientRect` of `silhouette-bowler` at both levels, 390 × 664 and 1280 × 800: x, y, width, height equal |
| G2 | Bowler height about 94% of the band at "everything" | height ÷ band height, 94% ± 5 points at 390, 768, 1024, 1280 |
| G3 | Simple level shows about the top half | band bottom at 35% to 65% of his height, from his top |
| G4 | Phone: edge to edge, head inside | `left ≤ band.left`, `right ≥ band.right`, focal point `left + 0.3w` inside the band, top 30 px below the band top |
| G5 | Wide: centred | centre of the box equals the centre of the band ± 1 px |
| G6 | Batter whole figure inside the card at 390 | box inside `worm-card`'s rect; box height ≤ 95% of the stage |
| G7 | Opening "About this chart" does not move him | batter box before and after, equal |
| G8 | No layout shift | every `[data-testid]` rect with the silhouettes `display:none` equals the rect with them shown |
| G9 | No horizontal scroll | `scrollWidth ≤ clientWidth` of the document, both themes, both levels |

## Style rules (`web/src/page/silhouette.css`, imported after `simple.css`)

- Both shapes: `position: absolute; pointer-events: none`; `mask` (and `-webkit-mask`) from the file, no-repeat; background colour from the token; `opacity` from the token alpha.
- Hero: `.hero-band { position: relative; overflow: hidden; isolation: isolate; container-type: inline-size }`, `.hero-inner { position: relative; z-index: 1 }`.
- Batter: `.worm-stage { position: relative }`; the overlay is `inset: 2.5% 0`, `mask-size: contain`, `mask-position: center`, `mix-blend-mode: var(--silhouette-blend)`.
- Frosting: `.hero-band .goal-card, .hero-band .commentary { backdrop-filter: blur(3px) }`, inside `@supports`.
