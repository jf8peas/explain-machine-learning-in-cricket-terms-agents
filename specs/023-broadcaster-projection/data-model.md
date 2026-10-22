# Data Model: The Broadcaster's Projected Score

No new stored data. Two shapes change, both already sent to the page.

## Term (backend `methods.Term`, page `terms.Term`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | unchanged; `tv` keeps its id |
| `plain` | string | the long form, used at every level: "broadcaster's projection" |
| `short` | string or null | **new**. The form for running text: "the broadcaster". Null for every other term |
| `short_possessive` | string or null | **new**. The short form's possessive: "the broadcaster's". Null for every other term |
| `technical` | string | "run rate × 20 overs" (unchanged) |
| `meaning` | string | reworded: "The broadcaster's forecast: the runs per over so far, times 20." |
| `order` | int | unchanged |
| `alt_plain` | string or null | unchanged |

Rules: `short`, when present, starts with "the " and has no apostrophe; `short_possessive`, when present, is `short` plus "'s", written in the term list and nowhere else (research R3). `short(term_id)` returns `plain` when `short` is null; `short_possessive(term_id)` returns `plain` when it is null. `terms_version` is a hash of the list and changes with this edit.

## Definitions (`definitions()` and `TermsPayload.definitions`)

| Key | Value |
|---|---|
| `brute_force`, `brute_force_technical`, `brute_force_honest` | unchanged |
| `projected_score` | **new**: "the broadcaster's projected score"; used by the h1 and checked against the static title and preview tags |

## Banned patterns (`BANNED`, `banned_payload()`)

Adds three entries with no allowed regions: `\bTV projection\b`, `\bthe TV\b`, `\bTV\b`, all case-insensitive. Unchanged: the agent's quoted reasoning is exempt.

## Unchanged, listed for the record

Term id `tv`; method id `broadcaster`; fact ids (`tv_gap`, `tv_test_miss`, `tv_bias_runs`, `tv_bias_direction`, `tv_bias_large`); reference keys (`tv_miss`, `tv_projection`, `goal_card.tv`); CSS classes (`tv-figures`, `tv-figure`, `tv-sentence`, `tv-footnote`); test ids (`tv-miss`, `tv-said`, `tv-sentence`, `tv-footnote`, `tryit-tv`); chart colour token `--tv`.
