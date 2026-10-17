# Intro hero: "Halfway through a T20 innings. Where will it finish?"

Design for the top of the Working tab of the linear regression app (option C, approved 2026-10-17).
`intro-hero-c.html` is a picture of the design, not something the page ships. This file is the specification for its
layout, copy and data.

## What it must communicate, in order

1. This app is part of the **Explain Machine Learning in Cricket Terms** site.
2. It is an **experiment** in solving a machine learning problem with an **AI agent**.
3. The problem is **linear regression**.
4. The goal: predict a T20 first innings' **final total** from the score after **10 overs**.
5. Success is judged against **the TV projection** and **a know-nothing guess**, and the visitor sees how good the TV
   projection really is.

## What replaces what

Removed from the introduction: the lead line and miss meter (feature 007), the five chips, "How this works, in full",
"Full figures for the two simple guesses", and "What the agent can choose from". Their content moves elsewhere later;
none of it is shown on the Working tab.

Not in the hero: no buttons or links to Play or to the Data tab. The graph's own Play button and the tab bar do those
jobs.

## Layout (top to bottom)

1. **Breadcrumb**: "Explain Machine Learning in Cricket Terms" (a link to the main site) › "Linear regression".
2. **Tab bar** (feature 011) directly under the breadcrumb. Not drawn in the reference.
3. **Header**
   - Eyebrow (uppercase, accent colour, letter-spaced): "An AI agent experiment · linear regression"
   - H1: "Halfway through a T20 innings. Where will it finish?"
   - Lead: "An AI agent learns from past innings to predict the final total from the score after 10 overs. Can it beat
     the TV's projection?"
4. **Two columns** (wrap to one column when narrow; chart first):
   - **Left, about 3/5: the worm chart** in a bordered card, with a caption under it.
   - **Right, about 2/5:** the "How good is the TV projection?" panel, then the three steps.
5. Below the hero, unchanged: the model picker (with the one-line "runs can differ" note under it), the graph container,
   and the live summary line.

**Fold requirement**: at 1280 × 800, the top edge of the graph container (or the model picker) must be visible, so
visitors can see there is more below.

## The worm chart

A runs-by-over chart of one real innings, as cricket broadcasts show it.

- **Axes**: x = overs 0 to 20, ticks at 0, 5, 10, 15, "20 overs". y = runs, 0 to 200, gridlines and labels every 50.
  The scale may extend above 200 if any plotted value needs it.
- **The future**: the region from over 10 to over 20 has a light surface fill. A dashed vertical line at over 10 is
  labelled "10 overs".
- **First 10 overs**: a thick dark line through the innings' real cumulative runs at the end of every over, ending in a
  solid dot labelled with the score at 10 overs ("82/2").
- **Last 10 overs, what actually happened**: a thinner, lighter line through the real cumulative runs for overs 11 to
  20, labelled "what actually happened", ending in a diamond marker at the final total.
- **Wickets**: an open circle on the line at the end of each over in which a wicket fell. Markers that would sit on the
  10-over dot or the final-total diamond are omitted.
- **TV projection**: a dashed line in the TV colour from the 10-over dot to over 20 at (runs at 10 overs × 2).
- **Know-nothing guess**: a dotted grey line from the 10-over dot to over 20 at the average final total.
- **TV's typical miss**: an error bar at over 20 centred on the TV projection, ± the TV's average miss, with the
  annotation "TV's average miss: ±N runs".
- **End labels**, to the right of over 20, stacked so they never overlap whatever the values: "Actual N" (bold, dark),
  "TV projection N" (bold, TV colour), "Know-nothing N" (grey), "The agent: ?" (bold, accent).
- **Caption** (built from the data): "A real innings: <batting team> v <bowling team>, <venue>, <month year>.
  <Batting team> made <runs at 10> in the first 10 overs and <runs in overs 11–20> in the last 10. The TV's straight
  line assumed the same pace, said <TV projection>, and was <miss> runs out: about its typical miss. Open circles mark
  wickets." The "about its typical miss" clause only appears when it is true.
- **Text equivalent**: the chart's accessible label states the innings, the score at 10 overs, the TV projection, the
  know-nothing guess, the actual total, the TV's average miss, and that the agent's prediction is unknown.

## The "How good is the TV projection?" panel

- Two figures side by side: the TV's average miss ("runs off the final total, on average", TV colour) and the
  know-nothing guess's average miss ("runs off for the know-nothing guess", grey).
- One sentence: "Knowing the score at 10 overs barely helps the TV, and it usually guesses **too low**, by N runs on
  average. The agent has to beat it by at least N runs." The "barely helps" wording, the direction ("too low" or "too
  high") and the goal margin all follow the data and the goal; the sentence must stay true if the figures change.
- Footnote: "<N> past innings, <first year> to <last year>: IPL, BBL and full-member internationals."

## The three steps

Numbered circles (outline, accent colour), one line each:

1. **An AI agent picks the clues** from the first 10 overs
2. **Code fits a linear regression** to past innings
3. **Judged on a season it never saw** against the TV and the know-nothing guess

## Data

Every number comes from the server; none is typed into the page.

| Item | Source |
|---|---|
| TV average miss, know-nothing average miss, TV bias, innings count, year range, goal margin | The introduction's reference figures (`/api/reference`, features 006 and 008: test-population innings before the first check year) |
| Average final total (know-nothing value on the chart) | Same source |
| Example innings: teams, venue, date, runs and wickets at the end of each of the 20 overs, final total | Prepared data. The preparation script must record cumulative runs and wickets at the end of every over (at least for the example innings) |
| Which innings is the example | A fixed match id in the server's settings (currently 1223954, Australia v India, SCG, 8 December 2020) |

Values used in the reference (computed from the data on 2026-10-17): TV average miss 22.5, know-nothing average miss
23.9, TV bias 14.3 runs too low, average total 162, 2,133 innings from 2005 to 2022. The example innings: 82/2 after 10
overs, 186/5 final; cumulative runs by over 9, 14, 16, 28, 45, 51, 59, 68, 73, 82, 87, 101, 114, 124, 139, 145, 157,
168, 175, 186; wickets fell in overs 2, 10, 19, 20 and 20.

## Look

- Reuse the page's existing tokens: `--bg`, `--surface`, `--border`, `--text`, `--muted`, `--accent`. Add one token for
  the TV colour (reference value #b35c00, with a dark-mode value that keeps 4.5:1 contrast on `--bg`).
- System font stack, as today. H1 about 44 px desktop and 30 px phone.
- Series are told apart by line style (thick solid, thin solid, dashed, dotted) and labels as well as colour.
- Both themes must work. Nothing animates.

## Phone width

Single column: header, chart card (full width; end labels may move under the chart as a small key if they don't fit),
panel, steps. No horizontal page scroll at 360 px.
