# Validation versus test: making the two tabs agree

Design for changes to the What the agent found tab (feature 014) and The final test tab (feature 015), approved
2026-10-19. `found-tab-validation.html` and `final-test-tab-test.html` are pictures of the design, not something the
page ships. Their figures follow one real run (validation: rival 17.0, AI 17.4, TV 21.6; test 2026: AI 17.7, rival
17.8, TV 21.4, know-nothing 34.5); anything marked [n], and the AI's sixth round and the other grid cells, are
placeholders. This file is the specification for what changes; everything not mentioned here stays as features 014 and
015 built it.

## The problem

What the agent found says the rival won with 17.0. The final test then shows the AI's model "1st" with 17.7. Both are
correct, but the page never says they come from two different exams:

- **Validation** (cross-validation on the check seasons 2023–25): used again and again to compare candidate models and **choose**
  one.
- **Test** (the 2026 season): used once, after the choice, to **judge** it. It played no part in learning, tuning or
  choosing, so it is the clean, honest number.

Visitors read the two tabs as contradicting each other.

## The principles

1. Every score says which exam it comes from, in words and with a consistent visual label.
2. The check seasons **choose**; the test **judges**. The page never calls either one "the winner".
3. The final test leads with **our pick** (the candidate model chosen on validation), not with a ranking.
4. The page explains why the two exams give different numbers, and says the test is the one to trust.
5. Gaps too small to matter are called **too close to call**.

## Shared elements

- **Validation label**: an amber pill reading "VALIDATION" (reference #a35d00, white text), used with an amber outline
  and pale amber fill (#fdf6e7) on validation panels and the check-season segments.
- **Test label**: a dark pill reading "TEST" (the page's text colour, white text), used with the dark fill on test
  panels and the test-season segment.
- Both need dark-mode values that keep 4.5:1 text contrast. Add a validation token beside the existing method tokens.
- **Too close to call**: when two models' average misses on the same exam differ by **less than 0.5 runs** (the named
  constant TOO_CLOSE_RUNS, defined once in one shared browser module that both tabs import; each comparison uses the
  one-decimal scores the page displays, so 0.49 is too close and exactly 0.5 is not; the server never decides it and
  holds no copy), the page says "too close to call" instead of implying one is better. A choice is still made
  on validation (the lower score goes forward, ties to the AI as today), and the wording says so.
- **Vocabulary**: "check seasons" with "(cross-validation)" or "validation" once per tab; "final test" with "test"; "our
  pick" and "chosen on validation" for the chosen candidate model. Never "winner" for either exam.

## What the agent found (validation)

- **Banner** under the lead, full width: VALIDATION pill, then "Every score on this tab comes from the **check seasons,
  <first>–<last check year>** (cross-validation). They are used to **choose** a candidate model, not to judge it. The honest
  verdict comes from the final test."
- The tab lead runs the full width of the container.
- **Section 2** heading gains "(cross-validation)". Its lead adds: "These scores are used again and again to compare
  candidate models, which is exactly why they can't also be the final verdict." The check-season segments take the validation
  outline and fill, and under the strip a caption row labels them "VALIDATION: USED TO CHOOSE" and the test segment
  "TEST".
- **Section 3** heading becomes "The race on the check seasons". The chart's y-axis label reads "average miss on check
  seasons", and the caption ends "All scores are on the check seasons."
- **Winner panel** becomes the **choice panel**: label "Chosen on validation"; heading "The <chosen>'s candidate model" plus ", by
  a whisker" when too close to call; text "It missed by **<a> runs** on the check seasons, against **<b>** for the
  <other>." followed by either "A gap of <gap> runs is **too close to call**: the two are about equally good." or
  "<gap> runs better."; then "A choice still has to be made, so the lower score goes forward. How good it really is gets
  settled by the final test, on a season nothing has seen." (the first clause only when too close to call); then the
  link to the final test. The panel takes the chosen method's colour as its left border.
- **Sections 5 and 6**: every score label says "on the check seasons" (the grid's best-cell line, the ranking column
  heading "Average miss on check seasons (runs)").

## The final test (test)

- **Banner** under the lead, full width, dark: TEST pill, then "Every score on this tab comes from **<test year>**, a
  season that was never used for learning, tuning or choosing. These are the **honest** numbers." The lead drops the
  year (the banner carries it) and runs full width: "For each of the <n> innings of <test year>, four predictions of the
  final total, made at the halfway mark and then compared with what really happened."
- **Section 1 becomes "1. How did our pick do?"**
  - A large card in the chosen method's colour: "Our pick: the <chosen>'s model", its test average miss as the big
    figure with "runs off, on average", and "Chosen on the check seasons, before <test year> was touched."
  - Beside it, the goal verdict card (the existing three variants from feature 015, unchanged in wording).
  - Then "All four predictions on <test year>. **Shorter bar = more accurate.**" and the four bars as now, but **without
    1st to 4th place labels**; the chosen model carries an outlined "our pick" tag. Bars keep test-miss order.
  - Under the bars, one sentence about the AI and the rival on the test: "too close to call" when their gap is under
    the threshold, otherwise which was more accurate and by how much; plus whether both beat the TV and the know-nothing
    guess.
  - Feature 015's extra sentence for "another method had the shortest bar" is replaced by this sentence and section 2.
- **New section 2: "Why the scores differ from What the agent found"**
  - Lead: "The same two models, sat in two different exams." plus one sentence built from the data saying who was ahead
    on each (for example "On the check seasons the rival was ahead; on <test year> the AI edged it."), and "Both gaps are
    tiny." only when both are under the threshold.
  - Two side-by-side cards on **one shared scale** from zero: a VALIDATION card ("Check seasons <years>", "Used to
    choose. Seen many times while comparing candidate models.") and a TEST card ("Final test <year>", "Used once, to judge. Never
    seen before."), each with a bar and value for the rival and the AI.
  - Three short reasons in a row: **Different seasons** ("<test year> is a new season with its own conditions. Any
    model's miss moves a little from one season to the next."); **Choosing flatters the pick** ("<n> candidate models were
    tried on the check seasons and the best one kept. Some of that best score is luck, so it usually slips on fresh
    data."); **The test is the clean one** ("<test year> played no part in learning, tuning or choosing, so nothing was
    fitted to it. When the two disagree, **trust the test**.").
  - <n> is the run's count of candidate models scored (the AI's fitted attempts plus the grid's allowed combinations), never a
    word such as "dozens" typed into the page.
- **Sections 2 and 3 of feature 015 renumber to 3 and 4.** "How close did each one get?" says "Every <test year>
  innings"; its closing line says "Even our pick…". The chosen model's row carries the "our pick" tag.
- **Takeaways** keep feature 015's rules. Takeaway 1 must also handle the know-nothing guess being far off because
  totals have risen (for example "Scores keep climbing"), using its bias.

## Data

Nothing new is calculated. Everything comes from the run's state:

| Item | Source |
|---|---|
| Check years, test year, test innings | The run's split and final scoring |
| Both best candidate models' validation scores, the chosen candidate model | `validation_winner`, `llm_best`, `forward_best` (feature 008) |
| Both models' test scores and the references | The final test's accuracy figures (features 006, 015) |
| Number of candidate models scored | The AI's fitted attempts plus the grid's allowed cells |
| TV on the check seasons | `baseline_validation_mae` |

## When the language model doesn't take part

There is only one model, so section 2 of the final test shows the rival's validation and test scores alone, keeps the
three reasons, and drops the comparison sentence. Neither tab uses "too close to call".

## Phone width

Banners wrap under their pills; the two exam cards and the three reasons stack; no sideways page scroll at 360 px.
