# Research: A Visual "In Cricket Terms", Then Written by the Language Model

**The planning brief was cut off** at the start of the Story 2 prompt description ("…and an instruction not to"). Decisions 6 to 10 below fill that gap from the spec's own rules; please confirm or correct them.

**Decision 1 - Two nodes, as the brief fixes.** `explain_in_cricket_terms` (code) builds facts and template blocks; `write_in_cricket_terms` (language model) replaces wording only. Alternative: one node doing both (hides the code/model split from the graph).

**Decision 2 - Keep the state key `explanation`.** The try-your-own readiness check (`hasModel`) and many tests read it. Its value changes shape; the old `sentences`, `comparison`, `figures` and `importance` keys go.

**Decision 3 - Facts module replaces `cricket_explanation.py`.** Its calculations (importance as coefficient × feature IQR, the wicket coefficient, the check years and test year, the validation errors, the goal verdict) are reused unchanged inside `cricket_facts.py`. Two modules computing the same numbers is the drift this feature is meant to prevent.

**Decision 4 - One placeholder syntax and one substitution function.** Templates and model wording both use `{fact_id}`, filled by `fill()`. The number rule (every number equals a fact) is therefore checked once, on the filled text, for both stories.

**Decision 5 - The wicket cost fact.** Taken from the coefficient on wickets at 10 overs (sign gives "cost" or "did not cost"); if the model has `wickets_in_hand` instead, the existing "wicket in hand is worth" fact is used for the same block with its own wording; if neither feature is in the model the block is omitted (spec FR-005).

**Decision 6 (to confirm) - The reply is JSON.** `{ "blocks": { "<block id>": { "title": str, "sentences": [str, ...] }, ... }, "order": [ids of blocks 2 to 4], "closing_lead": "<fact id>" }`. JSON because the page's existing proposal reply is JSON and the existing client and parser conventions apply. Free text would be harder to check.

**Decision 7 (to confirm) - Limits.** Title at most 40 characters; at most 2 sentences per block (1 for the closing block); each sentence at most 120 characters. These keep the section well under half the old list's word count (the old list is about 12 sentences of 20 to 30 words; the new section is about 120 to 150 words including labels). A test measures it against the old text on the same run state.

**Decision 8 (to confirm) - Rejecting a reply.** A reply that is not valid JSON in this shape, or that contains any digit anywhere, any placeholder that is not a fact id, or an over-length title or sentence, is rejected as a whole (templates stay, with a one-line reason). A well-formed reply that leaves a block's title or sentences out keeps the template for that block only (spec FR-015). Unknown block ids, or an order or lead fact outside the fixed lists, are treated as a rejection of that part only (order falls back to default, lead to the default fact) rather than of the whole reply, because they cannot put a number or a block on the page.

**Decision 9 (to confirm) - The prompt.** It gives the fact ids with plain meanings, units and display values (so the model knows what a placeholder means), the fixed blocks and what each shows, the placeholder rule, the length limits, and the instruction not to state any number or digit, not to describe anything as a statistic that is not a fact, and not to add blocks. The model sees display values to understand them but must write only placeholders; any digit in its text rejects the reply.

**Decision 10 (to confirm) - Budget.** One call is reserved for the writing step so proposing retries cannot starve it; the call is taken from `RunBudget` like any other and counts towards `LLM_MAX_CALLS` (default grows by one). Its timeout is what the deadline allows after a small reserve; below `MIN_CALL_SECONDS` no call is made.

**Decision 11 - The fake model.** `llm_fake.py` gains scripted writing replies per model id, so every path (valid, digit, unknown placeholder, too long, missing block, markup, broken, timeout) is testable with no network.

**Decision 12 - Rendering.** Inline SVG bar chart with a diverging axis, a visually hidden table as the text equivalent, a badge made of a shape plus words, a segmented strip for years, tokens from the page's theme, no animation. No chart library (none is installed, and the page's existing charts are hand-built SVG).

**Decision 13 - Replay behaviour.** The wording is in the run state, so the replay shows template wording at the explain step and the model's wording from the write step, like any other result. The auto-switch to What the agent found still happens at the last step, which is now the write step.
