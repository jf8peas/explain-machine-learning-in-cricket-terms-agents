# Implementation Plan: A Visual "In Cricket Terms", Then Written by the Language Model

**Branch**: `012-visual-cricket-terms` (work is currently on `main`; no branch hook ran) | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)
**Input**: The specification (with its clarification) and the planning brief. **The brief was cut off in its Story 2 section** (it ends at "…and an instruction not to"), so everything about Story 2 after that point (the reply shape, validation, budget, fallbacks and tests) is planned here from the spec's own rules and is marked in [research.md](research.md) for you to confirm.

## Summary

Two graph steps, matching the two stories. `explain_in_cricket_terms` (stage 8, code) is rebuilt: it computes a fixed set of named **facts** from the run state (reusing every existing calculation) and builds the five **blocks** with template wording written in `{fact_id}` placeholders, filled by one substitution function. That alone delivers the visual section. A new `write_in_cricket_terms` step (stage 8, language model) runs after it, before the end, and asks the run's model for titles and sentences, also in placeholders; code validates the reply (no digit written by the model, only known placeholders, length limits), fills the placeholders through the same substitution function, and replaces wording only, block by block, falling back to the templates already in state. The state key `explanation` is kept (the try-your-own form's readiness depends on it) with a new shape. The web section renders titles, a verdict badge, a bar chart, a large wicket figure and a year strip from that state, each chart with a text equivalent. No new dependency.

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript, no framework (web)
**Primary Dependencies**: existing only (LangGraph, numpy, pandas, pydantic, httpx client for the model). No new dependency
**Storage**: None
**Testing**: pytest (the scripted fake model only; no test reaches the network), Vitest, Playwright (fake model, in-memory limit store)
**Target Platform**: Vercel (static plus the Python function); evergreen browsers, light and dark themes, phone width
**Project Type**: web app inside the uv-workspace monorepo (`apps/linear_regression`)
**Performance Goals**: the writing step uses only the time the run has left; the run still finishes inside feature 004's deadline
**Constraints**: every number in the section comes from a fact; the model writes words only; the model's reply is never shown unless it passes every check; `explanation` stays the state key; no animation; charts readable in both themes and at phone width without relying on colour
**Scale/Scope**: 5 blocks, about 20 to 25 facts, 1 new graph node, 1 new prompt, 1 reply checker, 1 web module

## Constitution Check

No constitution exists (`.specify/memory/constitution.md` is absent), so there are no gates. Principles applied from earlier features and the brief:

| Principle | How the plan meets it |
|---|---|
| The model chooses words, never numbers | Placeholders only; any digit written by the model rejects its reply; code fills every number from facts |
| One source for each fact | One facts module, reusing the existing calculations; templates and model wording share one substitution function |
| A failing model never fails the run | The writing step catches every failure and keeps the template wording, with a one-line reason |
| The model cannot change what is judged | It may only reorder blocks 2 to 4 and choose the closing sentence's lead fact, from a fixed list |
| No new dependencies | none |

**Re-check after design**: no violations. Departures under Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/012-visual-cricket-terms/
├── plan.md
├── research.md
├── data-model.md          # the full fact list, blocks, the new `explanation` state, the reply shape
├── quickstart.md
├── contracts/explanation.md   # state shape, model reply schema, prompt contract, DOM and test ids
├── checklists/requirements.md
└── tasks.md               # created later by /speckit-tasks
```

### Source code (changes in `apps/linear_regression/`)

```text
backend/linreg/
├── cricket_facts.py        # NEW: build_facts(state) -> {id: Fact(value, unit, display, meaning)}; reuses existing calculations
├── cricket_blocks.py       # NEW: block templates in {fact_id} syntax, fill(text, facts), build_blocks(facts) -> state value
├── writing_reply.py        # NEW: parse and validate the model's reply (digits, placeholders, lengths, order, lead fact)
├── cricket_explanation.py  # REMOVED (its calculations move into cricket_facts.py)
├── prompts.py              # CHANGED: build_writing_request(facts, blocks, limits)
├── run_budget.py           # CHANGED: a call reserved for the writing step (see Complexity Tracking)
├── nodes.py                # CHANGED: explain_in_cricket_terms rebuilt; write_in_cricket_terms added
├── graph.py                # CHANGED: node, edge, NODE_ACTORS, NODE_STAGES
├── llm_fake.py             # CHANGED: scripted writing replies (valid, digit, unknown placeholder, too long, missing block, markup, broken)
├── stage_info.py           # CHANGED: the Interpret note (the text that says the model cannot write) is updated; its numbers test follows
└── state.py                # CHANGED: the `explanation` shape documented
tests/                      # CHANGED: test_explanation_*.py rewritten for facts and blocks; NEW test_cricket_facts.py, test_cricket_blocks.py,
                            #          test_writing_reply.py, test_write_step.py; graph, structure, stage and e2e fixtures updated
web/src/page/
├── cricket-terms.ts        # NEW: renders the blocks (badge, bar chart, large figure, year strip, label, fallback line) with text equivalents
├── results.ts              # CHANGED: renderFinal uses it; finalComparison reads facts, not the old comparison dict
└── readiness.ts            # unchanged (still reads `explanation`)
web/tests/                  # CHANGED: e2e explanation, reference, reuse (node list), stages; NEW unit tests for the renderer helpers
```

**Structure Decision**: keep the app's layout. The facts, the blocks and the reply checker are separate pure modules so that the number rule can be tested without a model or a graph.

## Design

### Facts (`cricket_facts.py`)
`build_facts(state, labels, margin)` returns a dictionary keyed by fact id. Each fact is `{ value, unit, display, meaning }`: `value` is the raw number or string, `display` is the exact text substituted into wording (rounded the way the page already rounds: runs to one decimal, shares as whole percentages, years as years), `meaning` is the plain description given to the model. It reuses, without change: the importance figure (`|coefficient × feature_iqr|`), the goal verdict and percentage (`goal.py`, `accuracy` results), the accuracy figures (`share_within_10`), the rolling-check and test years (`state["split"]`), the validation errors and winner. The full list is in [data-model.md](data-model.md).

### Blocks and templates (`cricket_blocks.py`)
Each block has an id, a title, one or two sentences and the data its visual needs. Templates are strings with `{fact_id}` placeholders; `fill(text, facts)` replaces them with `display` values and raises on an unknown id. The verdict has three template variants (reached, beat but missed the goal, did not beat); the wicket block has three (cost, did not cost runs, omitted); every other block has one. `build_blocks(facts)` returns the block list in default order (verdict, drivers, wicket, how_chosen, closing) with the visual data:
- drivers: bar rows `{ feature, label, fact_id, effect_runs (signed), display }` sorted by absolute effect, biggest first;
- wicket: the fact id of the figure;
- how_chosen: year segments `{ kind: training|check|test, from, to }`.

### The new `explanation` state
`{ facts, blocks, order, source: "template" | "language model", model, fallback_reason }`. The old `sentences`, `comparison`, `figures` and `importance` are gone; the web renders from `facts` and `blocks`. `most_important` is a fact (`biggest_factor`). The old comparison and setup sentences are dropped, because their figures remain in the accuracy table and the best-setup lines on the same tab (FR-007).

### Graph (`graph.py`)
`final_test → explain_in_cricket_terms → write_in_cricket_terms → END`; both nodes in stage `interpret`; `NODE_ACTORS["write_in_cricket_terms"] = "llm"`. The reuse fixture, the structure fixture and every test that expects `explain_in_cricket_terms` to be last are updated. The graph then shows the code/model split inside stage 8.

### The writing step (`write_in_cricket_terms`)
1. If the run's model did not take part, is unavailable, or no call or time is left (`RunBudget`), keep the template wording and set `fallback_reason` (one short line); no call is made.
2. Otherwise build the request from the facts (ids, plain meanings, units, display values), the fixed blocks and what each shows, the placeholder rule, the length limits and the instruction not to state anything as a statistic that is not a fact (and not to write any digit), take one call from the budget (with the writing step's own reserved call), and send it through the existing client.
3. Parse and check the reply (`writing_reply.py`): JSON in the agreed shape; every title and sentence free of digits; every `{placeholder}` a known fact id; lengths within limits; block ids in the fixed set. A reply that fails as a whole (not parseable, or any digit or unknown placeholder anywhere) is rejected entirely and the templates stay, with the fallback line. A well-formed reply that leaves out a block's title or sentence keeps the template for that block only. The block order (for blocks 2 to 4) and the closing sentence's lead fact are accepted only if they come from the fixed lists.
4. Fill placeholders with the same `fill`; set `source`, `model` and the new order; the step's summary says what was kept.
5. Every error path (timeout, unavailable, other model error, unusable reply) is caught: the run never fails or waits past its deadline because of this step.

### Budget (`run_budget.py`)
The call counts towards `LLM_MAX_CALLS`, but the proposing rounds may not use it up: one call is reserved for the writing step. Its timeout is whatever the deadline allows after a small reserve; if less than `MIN_CALL_SECONDS` is left the step makes no call and keeps the templates.

### Web (`cricket-terms.ts`)
Renders the blocks in `order`: the verdict headline with a badge (words plus a shape: a tick or cross mark in a rounded shape, not colour alone); a horizontal bar chart (inline SVG, with a diverging axis, each bar labelled with its value and plain name, bars and labels sized so the smallest stays visible) with a visually hidden table giving the values; a large wicket figure; a year strip (segments for training, check and test years, labelled with words and ranges, with a text equivalent); the closing sentence. A small label says the wording was written by the language model and names the model, styled like the model's reasoning block; when the template wording is shown after a fallback, one short line says so. No animation; colours from the page's tokens so both themes work. The section keeps the `explanation` test id on its container so existing tests find it.

## Complexity Tracking

| Departure | Why |
|---|---|
| `cricket_explanation.py` is removed and its calculations moved | The brief says the facts module replaces its role; keeping both would give two sources of the same numbers |
| `LLM_MAX_CALLS` default grows by one | The writing call must not be starved by proposing retries; a reserved call keeps "counts towards the existing limits" true without changing how many proposing calls a run gets (to be confirmed in tasks; the alternative is to take the call from the same pool) |
| The Interpret stage note changes | Its text says the model cannot write; with this feature the model writes words, so the note and its numbers test are updated |
| Two nodes in one stage | Intended: shows the code/model split in the graph |

## Testing

- **pytest** (the scripted fake only): facts for several run states (reached, beat but missed, did not beat; wicket cost, wicket helped, no wicket feature, wickets-in-hand variant; one feature; very unequal effects); every number in every block text equals a fact's display, for templates and for model replies; reply checker rejects any digit (including digits inside words like "10th"), unknown placeholders, over-length text, unknown block ids, and accepts omission of a block's text; the writing step with the fake model for every reply kind and for model absent, failed, timed out, no budget (templates kept, fallback line set, run completes); the call is counted; word count of the new section's text is at most half the old list's for the same run state (the old list's text is kept in the test as a fixture of sentences, since the module is removed).
- **Vitest**: the pure helpers of the renderer (bar scaling, label placement, strip segments, text equivalents).
- **Playwright**: the section shows the blocks in order with the badge, chart, figure and strip; a text equivalent exists for each chart; light and dark and phone width have no sideways scroll; the label and fallback line show in the right cases; stepping back shows the template wording at the explain step and the model's at the write step; the graph shows the new node as a language-model step; existing e2e that expected the old sentences or `explain_in_cricket_terms` last are updated.

## Changes made while implementing

- `write_in_cricket_terms` is called only when the run's language model took part and finished ok; otherwise no call is made and the templates stay with a one-line reason ("did not take part", "stopped early", "no time or budget", "could not be reached", "could not be used").
- The fake model answers writing requests separately (`FakeLlm.writers`, `writing_requests`) so a writing request never consumes a proposing reply and `requests` still counts proposing calls only. The default writer builds good wording from the fact ids and block ids named in the request.
- The charts are plain HTML and CSS (grid rows, a track with a zero line, a flex strip), not SVG: they wrap at phone width, take the page's colour tokens, and give each a visually hidden table or list as its text equivalent. The badge uses a small inline SVG shape (circle with a tick, rounded square with a cross) beside its words.
- A line of the graph's layout never reaches further right than the widest multi-step line above it (the whole line moves left), so the two new stage-8 steps do not widen the drawing.
- The Interpret stage note now describes the facts, the template wording, the model's wording from placeholders and the checks.
