# Hero chart: context, prediction and a zoom on the finish

Design for the worm chart in the hero of The Run tab (feature 013's chart), approved 2026-10-20. `hero-zoom.html` is a
picture of the design, not something the page ships. Its figures follow the current example innings (Australia v India,
Sydney, December 2020: 82/2 at 10 overs, 186 final, TV 164, know-nothing 162, TV's average miss 22.5); on the page every
number comes from `/api/reference`, as today. This file is the specification; everything it doesn't mention stays as
feature 013 built it. The title, the description, the "How good is the TV projection?" panel and the three steps don't
change, apart from the full-width rule below.

## The problem

- The first 10 overs take half the chart, but they're only context: they don't show the goal.
- The part that matters, where each prediction lands at 20 overs, is cramped: the TV (164) and the know-nothing guess
  (162) sit almost on top of each other, and the gaps between them and the actual total are hard to see.
- The TV's typical miss is an error bar squeezed against the end labels.

## The idea

One chart in two panels, side by side inside the chart card:

| Panel | Share of the chart's width | Shows |
|---|---|---|
| Line graph | 60% | All 20 overs, evenly spaced: the first 10 as grey context, the last 10 as the white prediction area |
| Zoom on the finish | 40% | A magnified ruler of the totals at 20 overs: where each prediction landed, the miss, the TV's usual miss, and the agent's "?" |

## Line graph (left 60%)

- **Overs are evenly spaced** across the panel: over 10 is exactly halfway. Axis labels 0, 5, 10, 15 and **20 overs**
  (the last in bold). The y axis is unchanged (0 to 200 in steps of 50, growing as today).
- **Context band** (overs 0 to 10): a light grey fill. Above it, a two-line heading: "CONTEXT" (small caps, muted) and
  "first 10 overs". The runs line here is mid grey (not the text colour), 3 px; the wicket circle(s) are grey too.
- **Prediction area** (overs 10 to 20): the page's surface colour (white in the light theme). Above it: "THE PREDICTION"
  (small caps, text colour) and "where will the last 10 overs take it?".
- A dotted vertical line at 10 overs separates the two; the dot at 10 overs and its "82/2" label stay as now.
- **What actually happened** from 10 to 20 overs is a solid line in the text colour, 3 px (it was faded before), with its
  label "what actually happened" sitting entirely in the white area, above the line. Wickets after 10 overs are open
  circles in the text colour.
- The TV's dashed line and the know-nothing guess's dotted line run from the dot to 20 overs, as now.
- **The finish line**: a solid vertical line at 20 overs in the text colour. The diamond (actual), the TV's dot and the
  know-nothing's open dot sit on it.
- The end labels beside the old chart and the TV's error bar **are removed from the line graph**; they move to the zoom.
- A small rounded **lens box** on the finish line marks the range the zoom shows, with two faint lines joining its top
  and bottom to the zoom panel's top-left and bottom-left corners.

## Zoom on the finish (right 40%)

- A white card with the chart card's border colour and rounded corners, full height of the plot. Above it: "ZOOM ON THE
  FINISH" and "total after 20 overs".
- **Range**: from the nearest 10 below the lowest of (actual, TV, know-nothing, TV − average miss) to the nearest 10
  above the highest of (actual, TV, know-nothing, TV + average miss), with a little padding at both ends so no marker
  sits on the edge. Ticks every 10 runs on a vertical ruler near the left of the card, labelled on its left.
- **Markers on the ruler**: the diamond for the actual total, the TV's filled orange dot, the know-nothing's open grey dot
  (same shapes as on the line graph).
- **The TV's usual miss**: a narrow, pale orange bar just right of the ruler from TV − average miss to TV + average miss.
  At the foot of the card, a small key: a swatch of the same orange and "TV's usual miss, ±<average miss>".
- **The miss**: an orange bracket from the TV's value to the actual total, with "<n> runs short" (or "<n> runs over"
  when the TV was above the actual total; "spot on" when they're equal) beside its middle, bold, in the TV colour.
- **Labels** to the right of the bracket, at each marker's height, pushed apart so they never overlap (reuse
  `spreadLabels`): "Actual <total>" (bold, text colour), "TV <projection>" (bold, TV colour), "Know-nothing <guess>"
  (regular, muted).
- **The agent box**: a solid box in the accent colour with white text, "The agent: ?" (bold) over "where will it land?",
  placed under the lowest label and above the key, never overlapping either. Its text must keep 4.5:1 contrast on the
  box in both themes (use a token for the box text, not a literal white, if the dark accent is light).
- Type in the zoom is larger than on the line graph (labels about 15 px, the know-nothing label 14 px, at the desktop
  chart width), because it's where the eye should go.

## Caption

The server's caption keeps its facts and wording rules but describes the new chart: it starts "A real innings: <match>."
then the fixed sentence "The first 10 overs, in grey, are context; the white part is what everyone is trying to
predict.", then "<team> went from <runs>/<wickets> to <total>. The TV's straight line said <projection> and was <n> runs
<short|over>: <about its usual miss|…existing rule>." and ends "Open circles mark wickets." The chart's text equivalent
(`chart_text`) mentions the zoom: where each prediction landed, the miss, and the TV's usual miss.

## Copy above the chart

The title and the description run the full width of the container: no max-width on the header, the description or the
title, and no balanced line wrapping on the title, so at desktop width it fits on one line.

## Data

Nothing new is calculated or fetched. Everything comes from `/api/reference` as today:

| Item | Source |
|---|---|
| Runs by over, wicket overs, 82/2, final total | `example` |
| TV projection | `example.tv_projection` |
| Know-nothing guess | `average_total` |
| TV's usual miss | `figures.broadcaster.average_miss` |
| Caption, text equivalent | `hero.caption`, `hero.chart_text` (server) |

The miss in the bracket is the actual total minus the TV projection, in whole runs, worked out from those two displayed
values so it always matches them.

## Look

- Tokens: the TV colour (#b35c00), the accent for the agent box (#1d6fe0), the text, muted and border colours; add a
  context-band token (reference #eef0f3) and a context-line token (reference #8a93a3) with dark-theme values. The
  prediction area and the zoom card use the surface colour.
- Series are still told apart by shape, line style and label as well as colour. Nothing animates.
- Both themes keep 4.5:1 text contrast (3:1 for the grey context line against its band).

## Narrow widths

Below the existing narrow threshold (`NARROW_BELOW`), the zoom moves **under** the line graph at full width (the line
graph keeps all 20 overs evenly spaced), and the old key under the chart is replaced by the zoom. No sideways page scroll
at 360 px.

## When things are missing

As today: with no example innings the chart card is left out; without figures nothing numeric is shown.
