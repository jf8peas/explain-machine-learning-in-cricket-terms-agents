# Research: The Broadcaster's Projected Score

Decisions for the open points in the plan. Each has the decision, the reason and the alternatives rejected.

## R1. The glossary entry `tv` carries four forms

- **Decision**: `Term` gains `short: str | None = None` and `short_possessive: str | None = None`. For `tv`: `plain = "broadcaster's projection"`, `short = "the broadcaster"`, `short_possessive = "the broadcaster's"`, `technical = "run rate × 20 overs"` (unchanged), `meaning` reworded to start "The broadcaster's forecast…". Python gets `short(term_id)` (falls back to `plain` when no short form) and the page gets `shortTerm(id)`; both send and read `short` through the existing `terms` list in `/api/reference`. `terms_version` changes with the content, as in 021.
- **Reason**: the design README ("Grammar") needs two forms and says builders take both from the term list. The list is already the single source and already reaches the page.
- **Rejected**: a second term id (`tv_short`), which splits one concept in two and breaks the "one plain term per concept" rule; deriving the short form by string surgery (`"the " + plain.split("'")[0]`), which is the hidden "'s" handling the README forbids.

## R2. "projected score" in the h1 and the page title

- **Decision**: add one server-supplied definition, `projected_score` ("the broadcaster's projected score"), to `definitions()` and to the page's `DefinitionKey`. `question()` in `hero.ts` builds the h1 from `term("agent")` and `definition("projected_score")`. The static `<title>` and preview tags in `index.html` are literal text, as before, and are checked by the 021 static-text test against the term list and this definition.
- **Reason**: the h1 uses "projected score", not the glossary's "projection". Typing it in the page would put a method name outside the term list; building it as `short + "'s projected score"` adds "'s". One more entry in an existing payload is the smallest fix.
- **Rejected**: leaving the whole h1 as literal static text (no glossary check, and it must change with the agent term); a fifth `Term` field (`possessive`), more surface than one definition.

## R3. Possessive and capitalised uses

- **Decision**: the term list carries the possessive too (`short_possessive`, "the broadcaster's"), so the README's lines that need it are verbatim and no code appends "'s": "the broadcaster's straight line" (run-by-over chart caption), "next to the broadcaster's." (Your turn lead, which is fixed text in `index.html` checked by the static-text test). Sentences that name the method use the long form ("The broadcaster's projection is about right on average"). Capitalised label uses ("Broadcaster said", "Broadcaster: 164", "Broadcaster 164") use `cap(bare(short))`, where `bare()` removes a leading "the ".
- **Reason**: the design README requires these exact lines (spec SC-006) and forbids "'s" in builders. A third form in the one list satisfies both.
- **Rejected**: rewording the possessive away ("Its straight line said …"), which breaks SC-006; appending "'s" in a helper (forbidden).

## R4. The reply check and the fake model

- **Decision**: `llm_fake.py` writes "the broadcaster" in its takeaway sentences, and a second scripted reply keeps "the TV" so the fallback path is tested. The new `BANNED` patterns (R6) make `has_banned()` reject the second reply, which `writing_reply.py` already treats as unusable, so `write_in_cricket_terms` falls back to 021's template wording.
- **Reason**: no change to the reply check's logic, only its list.
- **Rejected**: a separate check for "TV" in `writing_reply.py`; the one list stays the single source.

## R5. Phone first screen

- **Decision**: measure before editing: load `/` at 390 × 664 with the 022 build and record the h1 height and the Start button's bottom edge (`idle.spec.ts` already asserts the bottom edge ≤ 664). The new h1 has 91 characters against 66. If the new bottom edge exceeds 664, set the phone h1 to 1.75rem in `simple.css` line 27 and keep 2.5rem at line 47.
- **Reason**: the copy is fixed by the README; size is the only free variable.
- **Rejected**: shortening the h1, or moving the goal card, which changes the design.

## R6. Banned patterns

- **Decision**: add to `BANNED` (all case-insensitive, allowed nowhere): `\bTV projection\b`, `\bthe TV\b` and `\bTV\b`. The third makes the first two redundant for matching, but the three are listed as 021's list is, so a report names the phrase. `\b` keeps "television" and "tvs" clear. `banned_payload()` sends them, and the page's e2e banned-terms check reads them from the same payload; its allow-list file (`banned-terms.allow.ts`) gets no new entry. The agent's quoted reasoning stays exempt as in 021.
- **Reason**: matches the README ("Keeping it").
- **Rejected**: banning "tv" without word bounds (would hit "televised" and test ids in attributes).

## R7. Fixtures that mention "TV"

- **Decision**: edit the shared fixtures by hand with the new wording rather than regenerating them from the code under test, so the tests keep checking the wording against an independent copy. `old_explanation_sentences.json` records pre-021 sentences and is left alone if it is only compared for numbers; if a test asserts its wording, update that expectation.
- **Reason**: regenerated fixtures would pass whatever the code said.
- **Rejected**: bulk search-and-replace of "TV" in fixtures, which would miss the grammar changes ("the TV's" becomes "the broadcaster's projection").

## R8. Out of scope, confirmed

The agent's nodes, edges, scoring, the run gate, the data, the recipe-agent app and the main site are not touched; internal identifiers keep "tv".

## R5 measurements (390 × 664, headless Chromium)

| | h1 box (y, height) | goal sentence bottom | Start button bottom |
|---|---|---|---|
| Before (022, `a166173`) | 142.6, 143.3 px (4 lines at 2rem) | 392 px | 630.75 px (33 px spare) |
| After the new h1 at 2rem | 142.6, ~180 px (5 lines) | n/a | 712.7 px (48.7 px over 664): the Start button no longer fits |
| After, phone h1 at 1.75rem (`simple.css` line 27; 2.5rem on wide screens unchanged) | 142.6, 125.4 px (4 lines) | 400 px (goal sentence now wraps to 3 lines) | 659.0 px (5 px spare) |

The margin is thin because "broadcaster's projection" makes the goal sentence a line longer than "TV's projection". The copy is unchanged, as planned.
