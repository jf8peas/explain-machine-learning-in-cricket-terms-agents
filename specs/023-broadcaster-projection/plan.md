# Implementation Plan: The Broadcaster's Projected Score

**Branch**: `023-broadcaster-projection` (work is on `main`; no branch hook ran) | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)
**Input**: The specification and [design/README.md](design/README.md) (source of the wording; the canvas is a visual reference only). Decisions are in [research.md](research.md), the term list's shape in [data-model.md](data-model.md), the interfaces in [contracts/api.md](contracts/api.md), and the checks in [quickstart.md](quickstart.md).

## Summary

Wording only. The hero question becomes "Can an AI agent build a regression model that beats the broadcaster's projected score?" and "TV" becomes "broadcaster" everywhere a visitor sees or hears it. The glossary entry `tv` (id unchanged) gets the plain term "broadcaster's projection", a new short form "the broadcaster", its possessive "the broadcaster's" and the technical term "run rate × 20 overs". Every sentence builder and front-end label takes the long or short form from the glossary and never adds "'s". The reword prompt's example, the fixed HTML text and the banned-term list follow. No behaviour, node, edge, score, gate or data change, and no new dependency.

## Technical Context

**Language/Version**: Python 3.12 (FastAPI, LangGraph 1.2); TypeScript 5 (Vite 5, no framework, custom elements)
**Primary Dependencies**: none new
**Storage**: none
**Testing**: pytest (`apps/linear_regression/tests`), Vitest (`web/tests/unit`), Playwright (`web/tests/e2e`, scripted fake models)
**Target Platform**: as 020 to 022 (390 × 664 phones up to desktop, light and dark)
**Project Type**: web app inside the monorepo (`apps/linear_regression`)
**Performance Goals**: unchanged
**Constraints**: wording only; term id `tv`, fact names (`tv_gap`, `tv_test_miss`, `tv_bias_*`), CSS classes (`tv-figure`), test ids (`tv-miss`, `tv-said`, `tryit-tv`) and state keys are not renamed; every number still from the backend; 021's banned-term check and 022's word limits (500 simple, 1,200 everything open) hold; the h1, goal sentence and Start button fit 390 × 664 without scrolling
**Scale/Scope**: about 22 changed source files (14 backend, 8 front end, plus 2 HTML files and the README), about 20 changed Python test files and about 20 changed web test files and fixtures, 0 new source files, 2 to 3 new test files

## Constitution Check

No constitution exists, so there are no gates. Principles carried from earlier features: one source for each fact (every name of the yardstick comes from the glossary); no new dependency; identifiers and test ids are not renamed; the test season stays sealed (untouched here).

**Re-check after design**: no violations. One decision to flag (research R2): the h1 and the page title say "projected score", a phrase the glossary's `tv` entry does not carry, so it is sent as one more server-supplied definition rather than typed in the page or built with "'s".

## Project Structure

### Documentation

```text
specs/023-broadcaster-projection/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md        # the term list's new field, the new definition, the banned list
├── checklists/requirements.md
├── design/                 # README.md is authoritative; the canvas is a visual reference
└── tasks.md                # created later by /speckit-tasks
```

### Source (all under `apps/linear_regression`)

Existing layout, no new folders.

## Hits for the literal "TV" and their fixes

Found with a case-sensitive word search of `backend/linreg`, `web/src`, `web/*.html` and `README.md`. "Long" is `term('tv')` (the glossary's plain term, "broadcaster's projection"); "short" is `short('tv')` ("the broadcaster"). Where a hit is a comment or docstring it is reworded in the same pass.

### Backend

| File | Hits (line) | Fix |
|---|---|---|
| `methods.py` | `Term("tv", "TV projection", …)` (32); module docstring | New plain term, `short`, meaning; add `short()` helper, `Banned` entries, definitions key (R2) |
| `accuracy_text.py` | `PROJECTION`, `_CAP_PROJECTION` comment (15), `_name_as_label` docstring (48), sentence at 108 ("the TV projection, the agent's models alike") | Long form from the glossary; the label helper capitalises with `cap()`; sentence uses `PROJECTION` |
| `cricket_blocks.py` | docstring (4); topic strings (32, 34); verdict sentences (60 to 70: "beat the TV projection", "The TV projection was …"); (80 to 91: "The TV misses by"); titles and sentences (144 to 153: "the TV forgets it", "The TV expects more", "the TV is about right"); (163 to 175: "When the TV shows", "The TV's projection is about right") | Long form for "…projection" phrases; short form for "the TV" phrases (title case via `cap()`); the possessive "The TV's projection" becomes the long form ("The broadcaster's projection is about right…") |
| `cricket_facts.py` | comment (27), docstring (157) | Reword; the mapping at line 23 and 29 already reads `term("tv")` |
| `evaluation.py` | docstring (20) | Reword ("The broadcaster's projected score …") |
| `goal.py` | `lead` (31: "the TV shows a projected score"; no front-end code reads it, the page's lead is the constant in `hero.ts`); `text` (29) and line 97 already use `term('tv')` | Short form in `lead` so the word check stays clean; check 29 and 97 read correctly with the new plain term |
| `headlines.py` | "beat/edged/held" lines (25 to 27); verdict lines (61 to 70); result strip (92 to 93, 106 to 107, docstring 90) | Short form everywhere ("Then it beat the broadcaster.", "The broadcaster held on this time.", "the agent beat the broadcaster by …", "The {who} was 17.9 runs out, the broadcaster 21.4.", "… closer than the broadcaster") |
| `hero_text.py` | constants comments (14, 15); docstrings (29, 40, 46, 79, 121); "Knowing the score at 10 overs … helps the TV" (54 to 60); caption (88: "The TV's straight line", 97, 100: "The TV projection", "The TV's …"); goal card sentence (125) and figure label (127) | Short form for "the TV", long form for "…projection"; the possessive "The TV's straight line said …" becomes "The broadcaster's straight line said …" via `short_possessive` (R3); goal sentence = "Beat the " + long + " by at least {shown} runs on average."; label = "runs: how far out " + short + " usually is, on past innings (…)" |
| `llm_fake.py` | fake reply sentences (73 to 82) | Reply wording with "the broadcaster"; add a second fake reply that still says "the TV" for the fallback test (R4) |
| `nodes.py` | docstring (172); `tv` dict key (414) is an identifier | Reword docstring only |
| `prompts.py` | example in the reword prompt (169) | "the TV projection guesses …" becomes "the broadcaster guesses …"; nothing else in the prompt changes |
| `state.py` | comment (57) | Reword |
| `stage_info.py`, `wording.py` | use `term('tv')` (49, 67; 35, 79, 101, 132) | No literal "TV"; read each result sentence once against the new plain term ("the broadcaster's projection (current run rate x 20 overs) misses …") and the step "doing" lines |
| `reference_api.py`, `writing_reply.py` | none | Send the new `short` field (inherited from `terms_payload()`); the reply check picks up the new banned patterns |

### Front end

| File | Hits | Fix |
|---|---|---|
| `page/terms.ts` | `Term` type, `TermId`, doc comment (70) | Add `short` and `short_possessive` (both `string \| null`); add `shortTerm(id)`, `shortPossessive(id)` and `definition("projected_score")`; update the comment |
| `page/hero.ts` | `question()` (14); comment (2); `${term("tv")}, average miss` (41) | `question()` builds "Can an {agent} build a regression model that beats {projected_score}?"; the lead text; Commentary uses the short form |
| `page/problem.ts` | tile "What the TV said" (31); comment (1) | Tile reads "Broadcaster said" via `cap()` of the bare short form; h2 at 14 and 23 already read `term("tv")` |
| `page/tryit.ts` | caption "the TV projected score" (92); the lead in `index.html` (52); tile label "TV: 164" | "Broadcaster: 164" and "next to the broadcaster's." from the glossary (R3) |
| `page/run-state.ts` | comment (179) | Reword |
| `page/worm.ts`, `worm-layout.ts` | marker text `TV ${tv}` (95), `TV's usual miss, ±` (110), comments | Marker text uses the bare short form capitalised ("Broadcaster 164"); the usual-miss label reads "Usual miss, ±x" so no "'s" is added; re-run the worm tests for label fit |
| `page/predict.ts`, `final/view.ts` | comments (39; 81) | Reword |
| `page/final/copy.ts` | uses `term("tv")` (52, 54) | Check the three sentences read correctly with the new plain term |
| `page/under-the-hood/*` | `data-figure` keys `tvMiss`, `tvBias` | Identifiers, not renamed; the prose they fill is in `under-the-hood.html` |

### HTML and README

| File | Hits | Fix |
|---|---|---|
| `web/index.html` | `<title>` (7), `og:title` (11), the preview description, "next to the TV's" (52), `twitter:*` tags if present | Title and preview title "Can an AI agent beat the broadcaster's projected score?"; description reworded; line 52 per the README |
| `web/under-the-hood.html` | stage cards 4 (177) and 7 (179), and any other prose | Wording through the glossary markers the 021 static-text test checks |
| `README.md` | lines 31, 33, 59, 99, 107 and the list of identifiers | Reword prose; do not rename identifiers |

## File-by-file order

1. **Term list and backend wording**: `methods.py` (`short`, plain term, definitions key, `short()` helper), then `accuracy_text.py`, `cricket_blocks.py`, `cricket_facts.py`, `evaluation.py`, `goal.py`, `headlines.py`, `hero_text.py`, `nodes.py`, `state.py`, `stage_info.py`, `wording.py`, `llm_fake.py`. Run the backend suite after each pair of files; tests that assert old wording are updated in step 6, but a failing old-wording assertion is the signal that a sentence changed.
2. **Front end**: `terms.ts`, then `hero.ts`, `problem.ts`, `tryit.ts`, `worm.ts`, `final/copy.ts`, and the comments.
3. **Fixed text**: `web/index.html` and `web/under-the-hood.html` exactly as in the design README, with the README and docstrings reworded.
4. **Prompt example**: `prompts.py` only.
5. **Banned list**: `methods.py` `BANNED` entries and `banned_payload()`.
6. **Tests and the phone check**: fixtures first (`headline_cases.json`, `terms.json`, `under-the-hood-reference.json`, `fake-run.json`, `linreg-structure.json`, `old_explanation_sentences.json`), then unit and e2e assertions, then the new tests, then the phone measurement and word counts (see [quickstart.md](quickstart.md)).

## Tests

- **Update**: the 18 Python test files and 20 web test files and fixtures that contain "TV" in expected text (`headline_cases.json` has the most, 45); `old_explanation_sentences.json` keeps its old wording only if it is a record of historical text, otherwise it is re-derived.
- **New**:
  - `test_wording_no_banned.py` gains cases: a planted "TV", "the TV", "TV projection" fails; "television" and "tvs" inside a longer word do not; the agent's reasoning stays exempt.
  - `test_writing_reply.py` and `test_write_step.py`: a fake reply with "the broadcaster" is accepted; one with "the TV" is rejected by the reply check and the step falls back to 021's template wording.
  - `test_terms.py`: the `tv` entry's three fields and the `short` field are present, and the definitions key is sent.
  - A Python static test that no source string literal in `backend/linreg` reads "TV" as a word (comments and docstrings reworded too; identifiers excluded).
  - A Vitest case in `no-literal-terms.test.ts` for the same in `web/src`.
  - An e2e case that walks every row of the design README's examples table on a finished fake-model run (`web/tests/e2e/broadcaster-wording.spec.ts`).
- **Reuse**: 021's banned-term e2e check and 022's word counts run unchanged on both pages after a fake-model run; the first-screen test (`idle.spec.ts`) stays and must pass.

## Phone first screen

Measure the 390 × 664 first screen before changing anything (the bottom edge of the Start button and the h1's height, recorded in `research.md` R5) and again after the new h1. The new h1 is 91 characters against 66, so it likely adds a line at 2rem. If the Start button's bottom edge passes 664, reduce the phone h1 in `simple.css` line 27 (for example 2rem to 1.75rem), keeping 2.5rem at the wide breakpoint (line 47), rather than shortening the copy.

## Complexity Tracking

None: no violations to justify.
