# Contract: the two tabs (extends [014](../../014-found-tab/contracts/found-tab.md) and [015](../../015-final-test-tab/contracts/final-test-tab.md))

Everything not listed here is as features 014 and 015 define it.

## Run state

- **No new field and no field removed.** Every figure comes from an existing replay-state field (see [research.md](../research.md) §2). `final.validation_mae` (`llm`, `forward`) is read by the final tab for the validation scores; `attempts`, `grid`, `forward_best`, `validation_winner` and `split` are read as before.
- **Explanation facts**: gains `know_nothing_rising`, `know_nothing_bias_runs`, `know_nothing_bias_direction`; loses `race_leader`, `race_leader_label`, `race_leader_differs`, `leader_within_10`, `leader_within_10_words`. The verdict block's `visual` loses `race_leader_differs`, and its `sentences` has one entry.
- **Takeaway 1** (`takeaway_run_rate`): title "Scores keep climbing" when `know_nothing_rising` is yes and `run_rate_state` is not `"none"`; otherwise feature 015's titles.
- The server never sends a "too close to call" flag, text or threshold.

## Shared test ids (both tabs)

| Element | `data-testid` |
|---|---|
| Exam banner (full width, under the lead) | `exam-banner` with `data-exam` = `validation` or `test` |
| Exam pill | `exam-pill` with `data-exam`; text "VALIDATION" or "TEST" |
| Any text that says two scores are too close | `too-close` (the element holding the phrase "too close to call") |

## What the agent found

| Element | `data-testid` / change |
|---|---|
| Tab lead | `found-header`; as wide as the container |
| Banner | `exam-banner` (`data-exam="validation"`): VALIDATION pill, then "Every score on this tab comes from the check seasons, <first>–<last> (cross-validation)…" |
| Section 2 | `found-section-2`; heading ends "(cross-validation)"; strip segments `season-check` carry class `exam-validation`, `season-test` the test outline; caption row `season-caption` with items `season-caption-validation` ("VALIDATION: USED TO CHOOSE") and `season-caption-test` ("TEST") |
| Section 3 | `found-section-3`; heading "3. The race on the check seasons"; the chart's y-axis label "average miss on check seasons"; caption ends "All scores are on the check seasons." |
| Choice panel (was `winner-panel`) | `choice-panel` with `data-state` = `pending`, `clear`, `whisker` or `noAi`; label "Chosen on validation"; link `to-final` (unchanged) |
| Sections 5 and 6 | `grid-best` line and the ranking column heading say "on the check seasons" ("Average miss on check seasons (runs)") |

Removed ids: `winner-panel` (renamed `choice-panel`). The CSS classes `winner-*` become `choice-*`.

## The final test

Four numbered sections, one heading style, none collapsible (no `details`):

| Section | Heading | Test ids |
|---|---|---|
| 1 | "1. How did our pick do?" | `final-section-1`; `pick-card` (the chosen model's test miss, `pick-miss`), `verdict` card beside it (unchanged variants, `data-variant`), `race`, `race-row` (`data-method`; no `data-place`), `race-pick` tag (outlined "our pick"), `race-bar`, `race-value`, `race-axis`, `compare-line` (the AI-versus-rival sentence) |
| 2 | "2. Why the scores differ from What the agent found" | `final-section-2`; `differ-lead`; `exam-card` with `data-exam` = `validation` or `test` (each holds `exam-bar` per model, `data-method`, and `exam-value`); `exam-scale`; `reasons` holding `reason` with `data-reason` = `seasons`, `flatters`, `clean`; `reason-count` inside `flatters` |
| 3 | "3. How close did each one get?" | `final-section-3`; `close-row`, `close-seg`, `close-bias`, `close-key`, `close-note` ("Even our pick…") |
| 4 | "4. In cricket terms: what this tells us" | `final-section-4`; `explanation`, `takeaways`, `takeaway`, `rule-of-thumb`, `writer-label` |

- Banner: `exam-banner` (`data-exam="test"`): TEST pill, then "Every score on this tab comes from <year>, a season that was never used for learning, tuning or choosing. These are the honest numbers." The lead (`final-header`) reads "For each of the <n> innings of <year>, four predictions of the final total, made at the halfway mark and then compared with what really happened." (three predictions without the AI's model) and is as wide as the container.
- Removed: the `data-place` attribute and the 1st to 4th labels; `verdict-leader` (the "another method had the shortest bar" sentence); the old `final-section-2` and `final-section-3` meanings (now sections 3 and 4).
- Timing: sections 1 (except the verdict card), 2 and 3 appear at the `final_test` step; the verdict card, `close-note` and section 4 one step later, as in feature 015.
- Without the AI's model: `race-row` and `close-row` count 3; `exam-card` shows the rival's score alone; `compare-line` and the "who was ahead" part of `differ-lead` are absent; the three `reason`s stay; `too-close` does not appear on either tab.

## Vocabulary check (both tabs)

The visible text of both tabs never contains the word "winner" (case-insensitive), for a run with the AI's model, a run without it, and a run where the pick scored worse on the test than the other model. Code names and test ids are not visible text.
