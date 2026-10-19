# "What the agent found": the contest, explained

Design for the What the agent found tab of the linear regression app (approved 2026-10-19).
`found-tab.html` is a picture of the design, not something the page ships. **Every figure, round, quoted reason and
candidate model in it is a placeholder**; on the live page they all come from the run being shown. This file is the specification
for layout, copy and data.

## The problem it fixes

Today the tab shows a leaderboard, the rival's grid and the model's reasoning as separate blocks with headings that only
name them. A visitor can't tell that they are two contestants and a scoreboard, what "forward selection" is, why there
is a rival at all, or what "each check year" means.

## What the tab must answer, in order

1. Who is competing, and how does each one search? (the AI agent and the rival)
2. Why is there a rival? (it is the yardstick for the AI's reasoning)
3. How is every candidate model scored? (three check seasons; the final test is locked)
4. Who found the smaller miss, and what goes forward to the final test?
5. What did the AI try, why, and how did each try go?
6. How did the rival search? (grid search over hyperparameters)
7. The full ranking.

## Layout (top to bottom)

All sections share one heading style: a numbered h3 ("1. …" to "6. …") with a one- or two-sentence lead where shown.
No section is collapsible.

### Header
- h2 "What the agent found".
- Lead: "Two methods competed to pick the best clues for the prediction. One thinks like an analyst, the other searches
  like a machine. This is how each one searched, and which candidate model goes forward to the final test."
- No eyebrow.

### 1. The contest: two ways to choose the clues
Two cards side by side (stacked on a phone), each outlined in its method colour:
- **The AI agent** · "a language model · up to N tries" (N = the round cap).
  "**Thinks like an analyst.** It reads the results so far, uses what it knows about cricket, and proposes the next
  candidate model to try, saying why." Small print: "Code checks every proposal and does all the fitting and scoring. The AI never
  supplies a number."
- **The rival: forward selection** · "plain code · N candidate models" (N = the number of grid combinations).
  "**Searches like a machine.** For every combination of settings it starts with no clues, adds whichever single clue
  cuts the miss most, and repeats until nothing helps." Small print: "No judgement, no cricket knowledge: just trying
  things in order."

Under the cards, a tinted strip with two short paragraphs:
- "**Why have a rival?** It's the yardstick. If the AI can't beat a simple mechanical search, its reasoning isn't adding
  anything."
- "**What's a candidate model?** The clues (features), how many past seasons to learn from, whether recent seasons count more, and
  which innings to learn from."

### 2. How every candidate model is scored: three check seasons
- Lead: "Each candidate model learns from earlier seasons, then predicts three past seasons it hasn't seen. Its score is its
  **average miss** across the three, in runs. Lower is better. The final test season stays locked until the very end."
- A strip of seasons: one wide segment for the learning seasons (first year to the year before the first check), one
  segment per check season, and a dark segment for the test season labelled "final test, locked". Years come from the
  run's split.
- Small print: "Each check only learns from the seasons before it, so <second check> is checked on a model that learned
  up to <first check>, and so on."
- This section replaces the leaderboard's "Each check year (runs)" column, which is removed.

### 3. The race: who found the smaller miss?
Left: a chart card. Right: the winner panel.

**Chart** (hand-built SVG):
- x = the AI's rounds (1 to the rounds used), labelled "AI agent's round". y = average miss across the check seasons
  (runs), lower is better, with gridlines at whole runs and a range that fits every plotted value.
- One mark per round: a filled dot for a fitted candidate model that set a new best; an open dot for a fitted candidate model that was no
  better; a cross labelled "rejected" for a proposal code rejected; the word "done" for a round where the AI said it
  was finished (or "failed" if it failed).
- A solid step line in the AI colour for the AI's best so far, ending in a label "AI <best>".
- A dotted horizontal line in the rival colour at the rival's best, labelled "Rival <best>".
- A dashed horizontal line in the TV colour at the TV projection's average miss on the same check seasons, labelled
  "TV <value>".
- End labels never overlap.
- Caption: "Filled dots: a new best. Open dot: no better. ✕: code rejected the proposal. The solid line is the AI's best
  so far."
- Text equivalent: every round's outcome and score, the rival's best and the TV's.

**Winner panel** (tinted in the winner's colour):
- Small caps: "Goes forward to the final test".
- Big line: "The AI agent's candidate model" or "The rival's candidate model".
- "It missed by **<winner> runs** on average across the check seasons, against **<loser>** for <the other>: <gap> runs
  better." For a tie: say it was a tie and that the AI's candidate model goes forward (the existing tie rule).
- "Chosen before the final test season was touched. Both candidate models still sit the final test."
- Link: "See the final test →" (to the final test tab).
- Before the winner is decided, the panel says the search is still going.

### 4. The AI's rounds: what it tried, why, and how it went
- Lead: "Each round, the AI proposes a candidate model and explains its thinking in its own words. Code then checks it, fits it and
  scores it on the check seasons."
- One card per round, in order, with three columns (stacking on a phone): the round number; the proposal (the clues in
  bold, with "+ <clue>" when it adds to the previous round's clues, or "Same clues", then the other candidate model parts in plain
  words) and the AI's reason as a quotation; and the result.
- Results: a fitted round shows its average miss, plus "new best ▼<drop>" or "no better" (the first fitted round says
  "first score"); a rejected round shows "✕ Rejected" and code's reason in plain words; a finished round shows "stopped";
  a failed round shows "failed" and the reason.
- The round that produced the AI's best is outlined in the AI colour; rejected rounds are dashed and greyed.
- Small print: "The AI's words are shown exactly as it wrote them. Scores are average misses across the three check
  seasons, worked out by code."
- This replaces "The model's reasoning". The reasons are still shown verbatim, as text, never as HTML.

### 5. The rival's grid search: trying every combination
- Lead: "The rival can't reason, so it tries everything. Each cell is one combination of settings, chosen before learning
  starts. Settings like these are called **hyperparameters**, and trying every combination is called a **grid search**.
  In each cell the rival adds clues one at a time, keeping whichever cuts the miss most."
- One small grid per training-innings choice (side by side, stacked on a phone): rows are the training windows, columns
  the recency weightings, each cell the best average miss found in that combination.
- Cells are shaded by value (darker = smaller miss) in the rival colour's tint, and the value is always printed, so
  shade is never the only cue. The best cell is outlined, bold and starred.
- Below: "**★ The rival's best: <value> runs.** <the winning cell's settings in plain words>, with <its clues> as clues.
  Darker cells missed by less."
- Row, column and grid labels come from the setup menus' plain labels (short forms may be added to the same settings, not
  typed into the page).

### 6. Every candidate model tried, ranked
- Lead: "The AI's tries and the rival's best from each cell of its grid, in one list, ordered by average miss across the
  check seasons."
- Table columns: #, Candidate model (clues and settings in plain words), Found by (AI agent or Rival, in the method colour),
  Average miss (runs). No per-season column.
- Below the last row: "The TV projection missed by <value> on the same seasons."
- The table scrolls inside its own box on a phone.

## Data

Every number and every candidate model description comes from the run's state; nothing is typed into the page.

| Item | Source |
|---|---|
| Round cap, number of grid combinations | Server settings (round cap; the setup menus) |
| Learning, check and test years | The run's split (rolling checks) |
| Each round: proposal, reason, outcome, code's message | The run's rounds |
| Each fitted attempt: candidate model, average miss, improved, proposer | The run's attempts |
| Rival's grid: every cell's best miss, best cell, its candidate model and clues | The run's grid result |
| TV projection's average miss on the check seasons | The run's baseline step |
| Which candidate model goes forward, and both best misses | The winner decision made before the final test |

The tab fills in step by step as the replay advances, as it does today.

## When the language model doesn't take part

The AI card says it did not take part (and why, in one line). The race chart shows only the rival's and the TV's lines,
section 4 is replaced by one sentence saying the AI made no proposals, and the winner panel names the rival.

## Look

- Reuse the page's tokens: `--m-llm` for the AI (reference #1d6fe0), `--m-forward` for the rival (reference #1f7a46),
  the TV colour token from feature 013 (reference #b35c00), plus `--text`, `--muted`, `--border`, `--surface`.
- Method colours are always paired with words or shapes (labels, filled versus open dots, crosses, stars), never colour
  alone. Both themes must work. Nothing animates.
- System font stack. Section headings about 22 px; the tab heading about 34 px.

## Phone width

Everything stacks to one column: the two contest cards, the season strip (it may wrap the learning segment onto its own
row), the chart then the winner panel, round cards (round number above the proposal, result below), the two grids. No
horizontal page scroll at 360 px.
