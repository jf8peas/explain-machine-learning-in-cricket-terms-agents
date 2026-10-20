# Research: Hero Chart Zoom

No NEEDS CLARIFICATION remained. These are the decisions that needed checking against the code.

## 1. One SVG or two

- **Decision**: **wide** mode draws **one SVG** whose plot is split 60/40 (line graph, including its axis labels, then zoom card); **narrow** mode (card below `NARROW_BELOW`, 560 px) draws **two SVGs stacked** (the line graph, then the zoom at full width).
- **Why one SVG when wide**: the lens box on the finish line is joined to the zoom card's top-left and bottom-left corners by two faint lines. In a single coordinate system those lines are two ordinary `<line>` elements; across two SVGs they would need page-level geometry (measuring both boxes after layout), which is fragile and not deterministic. One SVG also scales the whole picture together, so the 60/40 split, the lens lines and the type sizes stay in proportion at any card width.
- **Why two when narrow**: stacking inside one SVG would make it very tall and make the line graph's type too small at 360 px, and the two parts have different natural widths (the zoom wants the full phone width). Two SVGs let each use the full width, and the layout stays a plain block flow with no sideways scroll. The lens box stays on the line graph; the joining lines are dropped because the panels are no longer adjacent.
- **Plan stays pure**: `wormPlan(input, mode)` returns the geometry for both panels (in narrow mode two geometries); the same input and mode always give the same plan. `mountWorm` still decides the mode from the card's width and redraws when it crosses the breakpoint.
- **The 60/40 split**: the line graph panel is `[0, 0.60 W]` of the SVG width `W`; the zoom card is `[0.60 W + g, W]` with the gap `g` = 1% of `W` (the lens lines run through it). So the shares are 60% and 39%: within the spec's 1 percentage point tolerance (clarification 2026-10-20). A Playwright test measures the two panels' rectangles; a Vitest test measures the plan.
- **Type size**: the SVG's viewBox is 700 units wide, close to the chart card's width at a 1280 px window (the card sits beside the TV panel), so zoom labels of 15 units render at about 15 px, as the design asks. At other widths the whole picture scales together.

## 2. The zoom range rule

- Values: actual total (`final_total`), TV projection, know-nothing guess (`average_total`), TV − average miss, TV + average miss. All unrounded except `final_total` and `tv_projection`, which are whole numbers already.
- `lo` = the nearest 10 at or below `(min − PAD)`, `hi` = the nearest 10 at or above `(max + PAD)`, with `PAD` = 2 runs. So the range is "the nearest 10 below the lowest" and "the nearest 10 above the highest", and a value that is itself a multiple of 10 still gets room (it never sits on an edge). The range is at least one tick interval (10 runs) wide; if all values coincide, `hi = lo + 10`.
- Ticks every 10 runs from `lo` to `hi` inclusive. The usual-miss bar spans exactly `TV − miss` to `TV + miss` on this scale, so the range always contains it.
- Nothing here is a statistic; it is layout derived from displayed values (clarification and spec Assumptions).

## 3. Keeping `missWords` and the server caption in agreement

- The rule: `n = final_total − tv_projection` on whole numbers (the displayed values). `n > 0` → "<n> runs short" (TV below the total), `n < 0` → "<|n|> runs over", `n = 0` → "spot on"; "1 run" is singular.
- Defined twice (TypeScript for the bracket, Python for the caption) because the caption is built on the server and the bracket on the page. They are kept in agreement by **one shared cases file**, `web/tests/fixtures/miss_words_cases.json`: a list of `{actual, tv, words}` including short, over, spot on, 1 run each way, and large gaps. Vitest checks `missWords(actual, tv)` against it; pytest checks `hero_text.miss_words(actual, tv)` against the same file (the precedent is `web/tests/fixtures/recipe_cases.json`, shared the same way). A Playwright test checks that the page's displayed bracket text equals the words in the displayed caption for the example served.
- The server's `example.tv_miss` (a float) is not used for the direction: the caption's direction and size come from the whole-number difference so they cannot disagree with the bracket.

## 4. The narrow layout

- Below `NARROW_BELOW` the zoom sits under the line graph at full width and replaces the old key (`drawKey` and the `worm-key` list are removed; their CSS goes). The zoom carries the labels, so nothing the old key said is lost. The line graph keeps all 20 overs evenly spaced at the narrow geometry.
- No sideways scroll at 360 px: both SVGs are `width: 100%; height: auto`, the zoom's labels sit inside its card, and the headings above each panel wrap.

## 5. Header copy and tokens

- The hero header, lead and title have no `max-width`; the title has no `text-wrap: balance` (a check that no rule sets it). At 1280 px the 44 px title ("Halfway through a T20 innings. Where will it finish?") fits one line, measured by a Playwright test (its height equals one line).
- New tokens: `--context-band` (light `#eef0f3`, dark a darker neutral), `--context-line` (light `#8a93a3`, dark a lighter neutral so it keeps 3:1 against its band), and `--on-accent` (the agent box's text colour: white in the light theme; in the dark theme the accent `#6ea8ff` is light, so the text is a dark colour that keeps 4.5:1). Contrast is computed from the page's own colours in Playwright, in both themes.

## 6. What does not change

`hero.ts` still calls `mountWorm` with `{example, averageMiss, averageTotal, chartText}`. The TV panel, the three steps, the other tabs and the live summary line are untouched. The chart card is still hidden when there is no example, no caption, no chart text or no average total.
