# Research: "The final test" Tab Redesign

No NEEDS CLARIFICATION remained. These are the decisions that needed checking against the code.

## 1. Where the "barely helps" threshold lives

- **Finding**: `hero_text.py` defines `BARELY_HELPS_SHARE = 0.10` and `barely_helps(know_nothing_miss, tv_miss)` (feature 013). `goal.py` has a separate `CLEARLY_BETTER_SHARE = 0.10` used for `reference_finding`.
- **Decision**: `cricket_facts.py` imports `barely_helps` from `hero_text.py`. Nothing is moved, because 013's constant is already in one module that both can import (`hero_text` imports only `accuracy_text`, so there is no cycle).
- **Rule for takeaway 1** (decided by code, in this order): `barely_helps` true → "barely" ; otherwise TV gap over the know-nothing guess > 0 → "clearly" ; otherwise → "none". Checking "barely" first removes the exact-10% overlap between the two constants.
- **Alternatives considered**: using `reference_finding.finding` directly. Rejected: at exactly 10% it reports `clearly_better` while the hero says "barely helps", so the two tabs could disagree.

## 2. Bias direction and the "small bias" rule

- **Decision**: direction comes from `accuracy_text.bias_short`'s own test (the one-decimal display equals "0.0" → none; bias > 0 → "too high"; bias < 0 → "too low"). A bias is **small** when `accuracy.is_large_bias` is false (less than half the average miss). Both existing; no new threshold.
- **Rule of thumb**: bias not small → verb "add" (TV too low) or "take off" (TV too high) with the bias in runs; bias small → wickets only. If the model also has no wicket feature, the rule is a plain "treat the TV's projection as about right" sentence with no figure.
- A bias that is not small but displays as 0.0 cannot occur (not-small implies at least half the average miss, which is positive when there is any miss).

## 3. Race leader versus chosen model (reconciling the spec)

- The brief defines the **race leader** as the lowest test-year average miss among the methods on the page, and the extra sentence appears when it differs from the chosen model (`final.winner`). The spec's wording ("the rival's model has the shorter bar") is the common case of that. **Decision**: follow the brief; the sentence names whichever method leads (including the TV or the know-nothing guess). The spec is amended to match.
- Ties: the chosen model is the leader if it shares the lowest displayed average miss, so no sentence appears for a tie. Otherwise the first lowest in the display order.
- Section 2's closing line ("Even the winner was within 10 runs…") refers to the **race leader** (the first row), and so needs the leader's within-10 words as well as the chosen model's. Both are facts.

## 4. Share-in-words table

A small fixed table, applied to the displayed one-decimal within-10 figure, returning a phrase that ends the sentence "…was within 10 runs of the real total ___." (with "only" included below half):

| Share (%) | Phrase |
|---|---|
| under 15 | only rarely |
| 15 to under 28 | only about a quarter of the time |
| 28 to under 38 | only about a third of the time |
| 38 to under 48 | only a little less than half the time |
| 48 to under 52 | only about half the time |
| 52 to under 62 | a little more than half the time |
| 62 to under 72 | about two thirds of the time |
| 72 to under 85 | about three quarters of the time |
| 85 and over | nearly always |

Boundaries are inclusive at the lower end and unit-tested at each edge. The design's example "less than half" is covered by the 38–48 band wording.

## 5. Why sections 1 and 2 can show before the verdict

`final_test` and `explain_in_cricket_terms` are consecutive replay steps. The bars and bias words come from `final` alone, so they show at `final_test`. The verdict is a block from the explanation, so it appears one step later. The alternative (computing the verdict line again on the page from `final.verdict`) would duplicate the wording rules, which the brief forbids ("verdict block").

## 6. Removing what only 012's old blocks used

`how_chosen` and `closing` go; their facts `check_year_1..3`, `training_from`, `training_to`, `winner_validation_error` and the `CLOSING_LEADS` list go with them if a search at implementation time finds no other use. `wicket` folds into `takeaway_drivers`: the wicket facts stay (they feed the takeaway and the rule of thumb). With `MOVABLE` empty, the `order` and `closing_lead` parts of the writing prompt, schema and parser are removed, and `explanation.order` is the fixed default order.

## 7. Method names

The design's names ("The AI agent's model", "The rival's model", "The TV projection", "The know-nothing guess") differ from `methods.py` ("the language model's model" …). Changing `methods.py` would change the Working tab and the other pages, which must stay unchanged. **Decision**: the final tab keeps its README copy in a fixed table keyed by method id; `methods.py` is untouched.

## 8. `chart_points`

Only `final_test`, `scoring.final_scoring`, `state.py`, the replay event and tests (`test_reference_in_run.py`, `reference.spec.ts`) refer to it. `final_scoring` returns just the additions; the accuracy figures in `final.accuracy` are computed from the unrounded predictions as before.
