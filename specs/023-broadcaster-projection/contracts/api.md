# Contract: wording the page receives

Only the changes since feature 022. Routes, events and every number are unchanged.

## `/api/reference` (and the reference part of the run) : `terms`, `definitions`, `banned`, `terms_version`

```json
{ "id": "tv", "plain": "broadcaster's projection", "short": "the broadcaster", "short_possessive": "the broadcaster's",
  "technical": "run rate × 20 overs",
  "meaning": "The broadcaster's forecast: the runs per over so far, times 20.", "order": 3, "alt_plain": null }
```

- Every other term carries `"short": null` and `"short_possessive": null`.
- `definitions.projected_score` = `"the broadcaster's projected score"`.
- `banned` gains `\bTV projection\b`, `\bthe TV\b` and `\bTV\b` (case-insensitive, no allowed regions).
- `terms_version` changes.

A page that has not received the list shows "not available right now" in place of a method name, as in 021. The h1 is the exception, because it is the first thing a visitor sees: until the list arrives `question()` shows the neutral "Can an agent build a regression model that beats the projected score?", the same fallback 022's `question()` already uses for "agent".

## Sentences built by the backend

All carry the new names; the shapes are listed in [../design/README.md](../design/README.md) section 2. Any field named `*_sentence`, `lead`, `label`, `headline`, `verdict`, `result_strip`, `doing`, `caption`, `takeaways[*]` and every stage note is checked by the banned-term test for "TV".

## Language-model contract

`write_in_cricket_terms` prompt: the example reads "the broadcaster guesses {tv_bias_runs} runs {tv_bias_direction}". Fact ids and placeholders keep `tv_`. A reply using "TV" in any form is unusable and the step falls back to the template wording.
