# Data model: "The final test" Tab Redesign

Nothing new is calculated. Every item below is a named view of a figure the run state already holds.

## State read by the tab

| Field | Used for |
|---|---|
| `final.methods` | rows in sections 1 and 2 (`llm` absent when the language model did not take part) |
| `final.accuracy[m]` | `average_miss`, `within_10`, `within_20`, `bias`, `n` (one decimal, as displayed) |
| `final.winner`, `final.llm_took_part` | the chosen model and its "our pick, chosen before the test" note |
| `split.test_year`, `final.accuracy[m].n` | header lead (year, innings count) |
| `explanation.facts` / `.blocks` / `.source` / `.model` | verdict, takeaways, rule of thumb, label |
| `final.chart_points` | **removed** (was `state.chart_points`) |

## New facts (`cricket_facts.py`)

Each is `{value, unit, display, meaning}` as today.

| Fact id | Value | Display | Notes |
|---|---|---|---|
| `test_innings` | `final.accuracy[winner].n` | integer | `test_year` already exists |
| `know_nothing_miss` | `accuracy.know_nothing.average_miss` | 1 dp | `tv_test_miss` already exists |
| `tv_gap` | know-nothing miss − TV miss, absolute | 1 dp | the gap |
| `run_rate_state` | `"barely"`, `"clearly"` or `"none"` | same | `hero_text.barely_helps` first, then gap > 0 (research §1) |
| `tv_bias_runs` | absolute TV bias | 1 dp | |
| `tv_bias_direction` | `"low"`, `"high"` or `"none"` | `"too low"`, `"too high"`, `"about right"` | `accuracy_text` rule (research §2) |
| `tv_bias_large` | `accuracy.is_large_bias(tv figures)` | yes/no | small bias = not large; the page reads this fact for the TV emphasis, so the rule lives once |
| `rule_verb` | `"add"` / `"take off"` / `"none"` | same / empty | from the bias direction; `"none"` when the bias is not large |
| `rule_runs` | `tv_bias_runs` when a verb applies | 1 dp | |
| `chosen_label` | by `final.winner` | `"AI agent's model"` / `"rival's model"` | |
| `race_leader` | method id with the lowest `average_miss` (chosen wins ties) | id | |
| `race_leader_label` | label of the leader | `"AI agent's model"`, `"rival's model"`, `"TV projection"`, `"know-nothing guess"` | |
| `race_leader_differs` | `race_leader != final.winner` | yes/no | |
| `share_within_10_words` | the chosen model's `within_10` | phrase from the table in research §4 | `share_within_10` already exists |
| `leader_within_10`, `leader_within_10_words` | the leader's `within_10` | 1 dp / phrase | used by section 2's closing line |

Kept as they are: `goal_reached`, `beat_tv`, `beat_tv_by`, `goal_margin`, `short_of_goal_by`, `beat_know_nothing*`, `winner_name`, `winner_test_miss`, `tv_test_miss`, `effect_<feature>`, `typical_difference_<feature>`, `biggest_factor`, `biggest_factor_effect`, `n_features`, `wicket_cost*`, `wicket_in_hand*`, `test_year`, `within_runs_threshold`.

Removed if nothing else uses them: `winner_validation_error`, `check_year_1..3`, `training_from`, `training_to`, and `CLOSING_LEADS`.

## Blocks (`cricket_blocks.py`)

`{id, title, sentences, visual, from_model}` as today. Fixed order, `MOVABLE = ()`.

| Id | Written by | Title / sentences | `visual` |
|---|---|---|---|
| `verdict` | code only | Variant by facts: **reached** (`goal_reached`); **missed_beat** (`beat_tv` and not reached); **missed_worse** (not `beat_tv`). Sentence 1 per README. Optional sentence 2 when `race_leader_differs`: the leader had the shortest bar, but the choice was made before the test, as it must be | `{variant, shape: "tick"\|"dash"\|"cross", race_leader_differs}` |
| `takeaway_run_rate` | language model, template fallback | Variant by `run_rate_state` | `{}` |
| `takeaway_drivers` | language model, template fallback | With a wicket feature: leads with the wicket cost. Without: leads with the biggest factor. If the wicket coefficient has the odd sign, the existing cautious wording | `{rows: [{feature, label, fact_id, effect_runs, display}] (biggest first), wicket: {fact_id, figure, direction}\|null}` |
| `takeaway_tv` | language model, template fallback | Variant by `tv_bias_direction` (low, high, none) | `{}` |
| `rule_of_thumb` | code only | Verb from `rule_verb`; wickets-only when not `tv_bias_large`; plain sentence when also no wicket feature | `{}` |

Wording limits unchanged (`MAX_TITLE` 50, `MAX_SENTENCE` 130, two sentences). The language model sees only the three takeaway blocks.

## Derived view models (front end, pure)

- **Row** (`final/view.ts`): `{id, place (1–4), name, description, average_miss, within_10, within_20, bias, isChosen, isLeader}`, sorted by `average_miss` ascending (ties keep the display order of `final.methods`).
- **Race scale**: `max = ceil(largest average_miss / 10) * 10` (10 when the largest is 0); gridlines every 10 from 0; bar width % = `average_miss / max * 100`.
- **Closeness shares** (`shares(w10, w20)`): `a = round(w10)`, `b = round(w20)` (the displayed figures to whole percent, `b = max(a, b)`); segments `[a, b − a, 100 − b]`. They sum to 100 for every input in 0..100.
- **Bias phrase**: the server's new `final.bias_phrases[m]`, shown as sent: "guesses about right on average" when the one-decimal bias is 0.0, otherwise "guesses N runs too low on average" / "too high" (N = absolute bias, one decimal; "1 run" is not special-cased, matching `accuracy_text._plural`). It is built in `accuracy_text.bias_phrase` from the same zero test and direction as `bias_words`, which stays as it is for the other tabs. TV row emphasised when the fact `tv_bias_large` is yes.
- **Drivers bars**: `bars(rows)` as in 012 (diverging axis, biggest first, minimum width), moved to `final/takeaways.ts`.
