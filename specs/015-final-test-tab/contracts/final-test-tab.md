# Contract: "The final test" tab

## Run state (replay event) changes

- `state.chart_points` and the `chart_points` key in the `final_test` step event are **removed**. `final` gains `bias_phrases` (method id → "guesses about right on average" / "guesses N runs too low on average"). Nothing else in `final` changes (`accuracy`, `methods`, `method_defs`, `bias_words`, `verdict`, `winner`, `llm_took_part` as today).
- `explanation.order` is the fixed block order. `explanation.closing_lead` is removed. `explanation.facts` gains the facts in [data-model.md](../data-model.md).

```json
{
  "explanation": {
    "facts": { "tv_bias_direction": {"value": "low", "unit": "text", "display": "too low", "meaning": "..."}, "...": {} },
    "blocks": [
      {"id": "verdict", "title": "Goal reached", "sentences": ["..."],
       "visual": {"variant": "reached", "shape": "tick", "race_leader_differs": false}, "from_model": []},
      {"id": "takeaway_run_rate", "title": "...", "sentences": ["..."], "visual": {}, "from_model": ["title", "sentences"]},
      {"id": "takeaway_drivers", "title": "...", "sentences": ["..."],
       "visual": {"rows": [{"feature": "runs_at_10", "label": "...", "fact_id": "effect_runs_at_10", "effect_runs": 28.8, "display": "28.8"}],
                  "wicket": {"fact_id": "wicket_cost", "figure": "9.4", "direction": "cost"}}, "from_model": []},
      {"id": "takeaway_tv", "title": "...", "sentences": ["..."], "visual": {}, "from_model": []},
      {"id": "rule_of_thumb", "title": "...", "sentences": ["..."], "visual": {}, "from_model": []}
    ],
    "order": ["verdict", "takeaway_run_rate", "takeaway_drivers", "takeaway_tv", "rule_of_thumb"],
    "source": "template", "model": null, "fallback_reason": null
  }
}
```

- `verdict.visual.variant` is `reached` (tick), `missed_beat` (dash) or `missed_worse` (cross). `visual.wicket` is `null` when the model has no wicket feature.
- `from_model` lists what the language model wrote for the block; it is always empty for `verdict` and `rule_of_thumb`.

## Writing step (language model)

- Offered blocks: `takeaway_run_rate`, `takeaway_drivers`, `takeaway_tv` only. The reply shape is `{"blocks": {<takeaway id>: {"title", "sentences"}}}`; there is no `order` or `closing_lead`. A reply naming other blocks has those entries ignored.
- A reply is **rejected as a whole** (`UnusableReply`, template wording kept) if, outside placeholders, a title or sentence has a digit or numeric character (as today) or a direction word: `too low`, `too high`, `under`, `over` (whole word), `add`, `take off`, `underestimate`, `overestimate`, `underestimates`, `overestimates`, `underestimating`, `overestimating`, `adds`, `adding`, `takes off`, `taking off`, `lower than`, `higher than`. Matching is case-insensitive on whole words.

## DOM (test ids)

| Element | `data-testid` |
|---|---|
| Tab heading and lead | `final-header` (no eyebrow element) |
| Sections 1 to 3 | `final-section-1` ... `final-section-3`, each an `h3` starting "1. " to "3. "; none uses `details` or a toggle |
| Race row, bar, value | `race-row` (`data-method`, `data-place`), `race-bar` (`data-method`, `data-hatched` for the TV), `race-value` |
| Our pick note | `race-pick` (inside the chosen model's row) |
| Axis | `race-axis`; tick labels `race-tick` |
| Verdict line | `verdict` with `data-variant`; shape `verdict-shape`; extra sentence `verdict-leader` |
| Closeness row, segments | `close-row` (`data-method`), `close-seg` (`data-band` = `within10`, `within20`, `over20`); bias words `close-bias` (`data-large`) |
| Key, closing line | `close-key`, `close-note` |
| Writer label | `writer-label` (`data-source` = `language model` or `template`) |
| Takeaway cards | `takeaway` (`data-block`, `data-n` 1 to 3) |
| Section 3's body (takeaways and rule of thumb) | `explanation` (kept so earlier tests and helpers can tell the explanation step has been shown), containing `takeaways` |
| Drivers chart, text equivalent | `drivers-chart`, `drivers-table` |
| Rule of thumb | `rule-of-thumb` |
| Not-ready sentence | unchanged from feature 011 |

The previous test ids `comparison`, `winner`, `accuracy-table`, `accuracy-row`, `reference-finding`, `bias-finding`, `expectations-note`, `cricket-block` and the scatter plot's ids no longer exist (`explanation` stays, now naming section 3's body).
