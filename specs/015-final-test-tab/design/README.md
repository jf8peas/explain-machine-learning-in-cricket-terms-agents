# "The final test": who won, how close, and what it means

Design for The final test tab of the linear regression app (approved 2026-10-19).
`final-test-tab.html` is a picture of the design, not something the page ships. **Every figure, ranking, takeaway and
the rule of thumb in it is a placeholder**; on the live page they come from the run being shown. This file is the
specification for layout, copy and data.

## The problems it fixes

- The result is spread across a coloured comparison box and a table of figures. Together they're too much, and neither
  says plainly who won.
- The predicted-versus-actual scatter plot is hard to read: visitors can't tell from it which method is more accurate on
  average.
- "In cricket terms" is a collection of facts with no takeaway.

## What replaces what

| Today | After |
|---|---|
| The comparison box, the accuracy table | Section 1: a ranked bar race and one verdict line |
| The predicted-versus-actual scatter plot and its method toggles | Section 2: one "how close" bar per method |
| "In cricket terms" blocks (feature 012) | Section 3: three takeaways and a rule of thumb |
| The "How it was chosen" block | Not on this tab (it lives on What the agent found, feature 014) |
| "Miss as a share of a typical total", R² | Not shown |

The "no method can be perfect" note stays, as the closing line of section 2.

## Layout (top to bottom)

All sections share one heading style: a numbered h3 with a short lead. None is collapsible. No eyebrow.

### Header
- h2 "The final test".
- Lead: "<test year>: a season nothing learned from or was chosen on. For each of its <n> innings, four predictions of
  the final total, made at the halfway mark and then compared with what really happened."

### 1. Who won the prediction race?
- Lead: "The **average miss**: how many runs each prediction was off the real final total, on average. **Shorter bar =
  more accurate.**"
- Four rows, sorted by average miss, best first. Each row: a place label (1st to 4th, the first larger and in its
  colour), the method's name in its colour with a one-line description, and a horizontal bar from zero whose length is
  the average miss, with the value printed at its end.
- Method names and descriptions: "The AI agent's model" (the chosen one says "our pick, chosen before the test"; the
  other model has no extra note), "The rival's model" ("forward selection"), "The TV projection" ("run rate × 20
  overs"), "The know-nothing guess" ("always the average total").
- An axis under the bars: 0, then gridline labels every 10 runs, and "runs off, on average".
- The bars share one scale starting at zero. Bars are told apart by their labels; the TV bar is also hatched and the
  know-nothing bar grey, so colour is never the only cue.
- Under the bars, a verdict line with a shape and words:
  - goal reached: a tick, "**Goal reached.** The <chosen> beat the TV projection by **<runs> runs** on average. The goal
    was <margin>.";
  - beat the TV but not by the margin: a dash, "**Goal missed.** The <chosen> beat the TV projection, but only by <runs>
    runs. The goal was <margin>.";
  - did not beat the TV: a cross, "**Goal missed.** The TV projection was <runs> runs more accurate than the <chosen>."
- "Won the race" (the shortest bar) and "the chosen model" can differ: the chosen model was picked on the check seasons,
  before the test. When the rival's model has the shorter bar, add one sentence under the verdict saying so, and that
  the choice was made before the test, as it must be.

### 2. How close did each one get?
- Lead: "Every innings sorted by how far off the prediction was. More of the bar in the darkest shade means more innings
  called closely."
- A key: "within 10 runs" (darkest), "10 to 20 runs off" (middle), "more than 20 runs off" (lightest).
- One full-width bar per method, in the same order as section 1, split into the three shares. Each segment prints its
  percentage; the three always add to 100.
- Beside each bar, the method's name and its bias in words: "guesses about right on average", or "guesses <n> runs too
  low on average" / "too high", using the existing bias rule. A large bias is emphasised in the TV colour.
- Closing line: "Even the winner was within 10 runs of the real total only <share in words> of the time. No method can
  be perfect from the halfway mark: collapses, a batter getting going and the weather all happen after it." The share
  words follow the figure (for example "about a third", "less than half").

### 3. In cricket terms: what this tells us
- Heading on the left; on the right the label "Written by <model name> · every number from code" (or "Template wording
  · every number from code" when the template is used, feature 012).
- Three takeaway cards side by side (stacked on a phone), each with "Takeaway N", a short headline you could repeat to
  a friend, and one or two sentences:
  1. **What the run rate alone is worth**: compares the TV projection with the know-nothing guess (for example "The run
     rate alone barely helps").
  2. **What drives the final total**: the cost of a wicket lost by the halfway mark, plus a small chart of each feature
     in the chosen model, showing how far a typical difference moves the predicted total: bars to the right for features
     that add runs, to the left for those that cost runs, biggest first, each labelled with its sign and value.
  3. **Why the TV gets it wrong**: the TV's bias, for example "Sides speed up, and the TV forgets it".
- A dark **rule of thumb** banner that a fan can use while watching, built from the TV's bias and the wicket effect
  (for example "add about <n> runs to the TV's projection; a bit more if wickets are in hand, a bit less if not").
- Every headline, sentence and the rule of thumb must stay true to the figures: if the TV guesses too high, takeaway 3
  and the rule of thumb say "take off" instead of "add"; if the TV clearly beats the know-nothing guess, takeaway 1 says
  so; if the chosen model has no wicket feature, takeaway 2 leads with its biggest factor instead; if the TV's bias is
  small, the rule of thumb is about wickets alone.
- Wording follows feature 012: the language model writes titles and sentences from named facts with placeholders, code
  fills every number, and the template wording is the fallback. The three takeaways and the rule of thumb become that
  feature's blocks.

## Data

Every number comes from the run's state; nothing is typed into the page.

| Item | Source |
|---|---|
| Test year, number of test innings | The run's split and final scoring |
| Each method's average miss, within-10 and within-20 shares, bias | The final test's accuracy figures (feature 006) |
| Which model was chosen, goal margin, verdict | The winner decided before the test (feature 008) and the goal (feature 006) |
| Feature effects for a typical difference, wicket cost | The chosen model's facts (feature 012) |
| Model name, template or model wording | The run's wording step (feature 012) |

The "10 to 20 runs off" share is the within-20 share minus the within-10 share; "more than 20" is 100 minus the
within-20 share. Both are worked out from the displayed figures so they add up exactly.

## When things are missing

- The language model didn't take part: section 1 has three rows (no AI model), and the verdict names the rival's model.
- Before the final test step is shown, the tab shows its existing "not ready" sentence (feature 011).

## Look

- Tokens: `--m-llm` for the AI model (reference #1d6fe0), `--m-forward` for the rival (#1f7a46), the TV token from
  feature 013 (#b35c00), grey for the know-nothing guess, `--win` / `--win-bg` for a reached goal and `--lose` /
  `--lose-bg` for a missed one. The three shares in section 2 are three steps of the text colour (darkest = within 10),
  with their percentages printed.
- Both themes must work. Nothing animates. System font stack.

## Phone width

Sections stack. In section 1 the method name moves above its bar; in section 2 the name and bias sit above the bar; the
takeaway cards stack. No horizontal page scroll at 360 px.
