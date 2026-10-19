# Research: Validation versus Test

No NEEDS CLARIFICATION remained. These are the decisions that needed checking against the code.

## 1. Where the too-close threshold lives

- **Decision**: one browser module, `web/src/page/exam.ts`, exports `TOO_CLOSE_RUNS = 0.5` and `tooClose(a, b)`. Both tabs import it. The server holds no copy and never decides "too close to call" (clarification 3).
- **Why in the browser**: the comparison is between displayed one-decimal scores of two models on one exam. The browser already computes every found-tab gap from displayed tenths (`found/view.ts`), so the rule sits beside the existing practice and the page can never contradict its own figures.
- **Comparison**: tenths of a run, `Math.abs(round(a·10) − round(b·10)) < 5`. Integer tenths avoid floating-point surprises at exactly 0.5 (for example 17.8 − 17.3).
- **Alternatives considered**: a server fact such as `race_close` (rejected by the clarification; it would also need a copy of the threshold in Python). Putting the helper in `found/view.ts` (rejected: the final tab would import from the other tab's folder).
- **Moves**: `tenths`, `fromTenths` and `shown` move to `exam.ts` and are re-exported from `found/view.ts`, so existing imports keep working.

## 2. Which state fields reach the browser

Every step event carries all of a node's state changes except `summary` and `data_path` (`graph_api.py`, `HIDDEN_KEYS`), and the replay accumulates them. So everything below is already in the page's state at the step that produces it; no field needs to be added, and nothing needs a new calculation.

| Need | Field | Reaches the browser | From step |
|---|---|---|---|
| Check years, first learning year, test year | `split` (`first_year`, `checks[].year`, `test_year`) | yes (already used by the season strip) | load |
| The choice made before the test | `validation_winner` (`winner`, `reason`) | yes (already read by `found/view.ts`) | `grid_search` |
| AI's best candidate model and score | `llm_best` (`validation_mae`); also `attempts` with `proposer: "llm"` | yes (`attempts` already used) | AI rounds |
| Rival's best candidate model and score | `forward_best` (`validation_mae`) | yes (used by `found/view.ts` once `grid` exists) | `grid_search` |
| Both models' validation scores beside the test | `final.validation_mae` (`llm`, `forward`; `llm` is null without the AI's model), a copy of `llm_best` and `forward_best` | yes, inside `final` | `final_test` |
| Test scores of all four methods | `final.accuracy[m].average_miss`, `final.test_mae` | yes | `final_test` |
| Who took part | `final.llm_took_part`, `final.methods` | yes | `final_test` |
| Chosen model | `final.winner` (a code name, never shown) | yes | `final_test` |
| Number of candidate models scored | count of `attempts` with `proposer === "llm"` plus count of `grid.cells` with `allowed` | yes | `grid_search` |
| TV on the check seasons | `baseline_validation_mae` | yes (already used) | `baseline` |

- **Decision**: the final tab reads its validation scores from `final.validation_mae` (same step as the test scores, so section 2 can never show one exam without the other). The found tab keeps reading `attempts`, `forward_best` and `validation_winner`, as it does now. `llm_best` is not needed by either tab but equals `final.validation_mae.llm`.
- **Test figures before the final test step**: `final.accuracy` first appears in the `final_test` step event. The found tab never reads it. The test year already appears in `split` (the season strip says "final test, locked") and is only scored in `final_test` (feature 008).
- **Nothing to pass through**: no existing value is missing from the replay state, so the backend change stays limited to takeaway 1, the prompt and word fixes.

## 3. Takeaway 1: "totals have risen"

- **Rule** (decided by code, in `cricket_facts.py`): the know-nothing guess passes the existing large-bias rule (`accuracy.is_large_bias`: bias at least `LARGE_BIAS_SHARE` of its average miss) **and** leans too low (its bias is negative, as `accuracy_text.bias_words` reads it: "too low"). No new threshold.
- **New facts**: `know_nothing_rising` (yes/no), `know_nothing_bias_runs` (absolute, one decimal) and `know_nothing_bias_direction` (`"too low"`, `"too high"`, `"about right"`, by the same zero test as the TV's), so the direction word reaches the wording only through a placeholder.
- **Variants** (all by code): when `know_nothing_rising` and the TV clearly beats the know-nothing guess (`run_rate_state` is "clearly"), the title is "Scores keep climbing" and the sentence says the average-total guess is `{know_nothing_bias_runs}` runs `{know_nothing_bias_direction}` because totals keep rising, so beating it says less than it seems, with the TV and know-nothing misses as before. When the TV only barely helps or does not beat it, feature 015's wording stays (a "barely helps" or "does not help" headline needs no softening, and "Scores keep climbing" would sit oddly beside it). When the guess is far off but leans too high, or is not far off, nothing changes. The language model may rewrite the title and sentence through the existing path (placeholders, digit and direction-word rejection, per-block fallback).

## 4. "Winner" in visible text

- **Found**: `race.ts` (the winner panel) and its CSS classes and test id. Renamed `choice-*`.
- **Final**: `closeness.ts` ("Even the winner…") becomes "Even our pick…" and reads the chosen model's within-10 share (`share_within_10_words`, which already exists) instead of the race leader's. The race-leader facts (`race_leader*`, `leader_within_10*`) and the verdict's extra sentence were only for the removed sentence and are dropped.
- **Backend text the model reads**: fact `meaning` strings that say "winner" are reworded to "chosen candidate model" so a written takeaway is not prompted to say it. `winner_name` stays a fact only if a template uses it; otherwise it is dropped.
- **Not touched**: code names (`final.winner`, `validation_winner`, `winner_mae`), which the page never shows, and the model's own free-text reasons shown verbatim on the found tab (feature 014 rule).

## 5. The prompt

- `prompts.py` line for `"reason"` currently asks for "one or two sentences in plain cricket language, which may mention any part of the candidate model". New wording: plain cricket words, no figures, no column names; feature ids and menu ids must not appear. The same rule is stated once among the numbered rules. The reply schema is unchanged. The page still shows reasons verbatim as text; this change is an instruction to the model, not a filter, so existing tests that script reasons are unaffected.

## 6. Contrast and tokens

- A new `--val` token: light `#a35d00` (amber) with white text on the pill, and `#fdf6e7` for the pale fill; dark values chosen so the pill's text and the pale panel's text keep 4.5:1. The TEST pill uses the page's text colour as fill and the page background as its text, so it follows the theme. A Playwright test computes the contrast ratio from the page's own computed colours in both themes for the pills, the banners and the cards.

## 7. Choice panel states

- `pending`, `clear`, `whisker` (under 0.5 runs, including a tie and a displayed tie recorded as the rival's), and `noAi`. The old "tie" and "belowDisplay" states fold into `whisker`: the wording "too close to call" covers both, and the recorded winner is never overridden. The existing no-scorable-AI path (rival goes forward, no comparison) stays and never says "too close to call".
