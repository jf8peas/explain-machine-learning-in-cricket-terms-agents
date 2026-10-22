# Research: Consistent Terminology

Decisions taken while planning feature 021 on top of feature 020 (commit 1cfc3dd). Paths are under `apps/linear_regression/`.

## R1. Where the old words live

A search of the code for "rival", "know-nothing", "forward selection", "mechanical search" and "setup" found them in five places:

| Place | What | Count (approx.) |
|---|---|---|
| Backend wording | `methods.py`, `cricket_facts.py` (METHOD_LABELS and fact meanings), `cricket_blocks.py`, `accuracy_text.py`, `hero_text.py`, `goal.py`, `nodes.py` (summaries, `winner_name`, verdict reasons, final-test summary), `selection.py` (`why` strings), `setup_settings.py` (`HYPERPARAMETER_NOTE`, grid note), `scoring.py`, `stages.py`, `stage_info.py` | ~110 |
| Front-end copy | `final/copy.ts`, `final/view.ts`, `final/differ.ts`, `found/grid.ts`, `found/ranking.ts`, `found/view.ts`, `leaderboard.ts`, `round-feed.ts`, `verdict-bars.ts`, `verdict.ts`, `tryit.ts`, `worm.ts`, `scorebook.ts`, `catalogue.ts`, `setup.ts` | ~100 |
| Static HTML | `web/index.html` (title, preview tags), `web/under-the-hood.html` (prose) | few |
| Recorded run | `web/public/recorded-run.json`: 6 "rival", 12 "forward selection", 17 "know-nothing", 4 "setup" | 39 |
| Comments, CSS classes, test ids, state keys (`forward_best`, `setup-chip`) | exempt (FR-007) | many |

Many "forward" and "setup" hits are exempt or unrelated ("step forward", `setup_settings.py` as a module name, `setup-chip` classes, `forward` as a method id). The banned-term check works on rendered text, so it needs no source triage; the source work is finding strings that reach the page.

## R2. Recorded run (replaces the FR-012 clarification)

**Finding.** The clarification said the backend maps old terms "when serving" the recorded run. The backend never serves it: `web/public/recorded-run.json` is a static file that the page fetches (`recorded.ts`). Mapping at serve time would be a no-op, and mapping in the page would put method names in the page (against FR-003).

**Decision.** `scripts/reword_recorded_run.py`: no language model, no run. It reads the file, and for each code-worded string rebuilds it from the facts the file already holds, calling the same backend wording functions a live run uses. It touches no number, no agent proposal reason (the `reason` in `propose` events) and not `fingerprint`. It writes a `wording_version` into the file. `tests/test_recorded_run.py` gains a check that rebuilds the wording in memory and fails if it differs from the file, as the fingerprint check already does for the data.

**What counts as code-worded** (found by walking the file; the list in the script is exactly these):
- step `summary` of `baseline`, `check_proposal`, `grid_search`, `final_test`;
- `grid.caption`, `validation_winner.reason`, `decision.reason`;
- `final.winner_name`, `final.winner_reason`, `final.method_defs[*].name` and `.note`;
- `explanation.facts[*].meaning`, `explanation.facts.chosen_label.display`, `explanation.blocks[*].sentences`;
- `headlines` (already worded by `headlines.py`; rebuilt too so one path covers all).

**Rebuild approach.** Each of these strings comes from a backend function that takes numbers and ids. The script folds the events into the final state (as `test_recorded_run.py::folded_state` does), then calls the same functions: `methods.method_defs`, `nodes` wording helpers, `cricket_blocks`, `cricket_facts.build_facts`, `headlines.build`. For this to work, every wording site in `nodes.py` must be a pure function of state or arguments (a small refactor, listed in the plan) rather than an f-string buried in a node body.

**Alternatives rejected.** Re-recording (needs the owner's key and a real run, and would re-roll the agent's proposals); regex find-and-replace over the file (cannot reword "forward selection's best candidate model had the lower average validation error" into the new wording safely, and silently drifts from the backend); mapping in the page (page would type method names).

**The shipped file is `scripted: true`** (fake model). The script and the test treat scripted and real files alike. The release check from 020 that refuses to ship a scripted file is unchanged.

## R3. One name per concept, with the technical term in brackets

Decision B from the planning brief overrides the spec's first draft ("Scorebook uses the technical terms"). Every level uses the plain term, Scorebook chart keys, table columns and grids included. The technical term appears once, in brackets after the plain term, at its first use in each Commentary panel and each Scorebook panel: "brute-force search (grid search with forward selection)".

Mechanism: the term list carries a `with_technical(id)` helper (backend) and a `termWithTechnical` formatter (front end) that returns `"plain (technical)"`. A panel calls it once, the first time it names a concept, and `term(id)` after that. Panels are separate renderers (one per Commentary panel and per Scorebook panel), so "once per panel" is each renderer's own responsibility, and a unit test per renderer asserts the technical term appears once.

Not every glossary row needs brackets in every panel; only the concepts a panel names. "Words we use" lists all rows with the technical term in its own column.

## R4. Static text

Decision C: page `<title>`, preview tags and `under-the-hood.html` prose may stay fixed HTML, because LinkedIn's crawler does not run scripts and the prose is long. A pytest test (`test_static_terms.py`) reads those files and checks:
1. no banned term appears;
2. every glossary plain term that appears in them is spelled exactly as in the term list (case-insensitive, whole phrase), and no known variant of a term (a list of near-synonyms kept in the test: "brute force search", "average total guess", "check years", "candidate model" outside brackets) appears.

This keeps FR-003 true in effect: the test, not the page, enforces that fixed HTML agrees with the backend list.

## R5. Live runs and the reply check

`writing_reply.py::_check_text` rejects digits in the model's rewritten text. Decision D adds a banned-term scan there. The scan reads the banned list from `methods.py` (`BANNED`), so the backend, the pytest tests and the Playwright check use one list; the Playwright spec gets it from the served term payload (`banned`), not a second copy. A rejected reply falls back to the plain template wording, which is the existing behaviour for digits. The prompt's structure is unchanged; the fact `meaning` strings it carries are reworded (in scope).

The agent's own reasoning (proposal `reason`) is not scanned or altered anywhere: it is shown verbatim and marked exempt.

## R6. Where the term list is served

Options: a new route; `/api/catalogue`; `/api/reference`.

**Decision: `/api/reference`.** It already carries `methods` (`method_defs()`), is cached (`s-maxage=3600`), and its failure path already sends the method names with a message when the data cannot be read (`NOT_LOADED`). The term list is data-independent, so it must be sent on that failure path too. `/api/catalogue` is fetched on the main page only; the "How this app was built" page also reads `/api/reference`, and `/api/reference` is needed on both pages.

New fields on `/api/reference`: `terms` (ordered list), `banned` (list of `{pattern, where_allowed}`), `terms_version` (hash of the list, for the wording version). The existing `methods` field is derived from the same list and keeps its shape, so 020's consumers keep working; its `name` and `note` change wording.

The recorded run's `final.method_defs` stays in the file (the page reads method names from the run when it plays the recorded run), reworded by the script.

**Front-end rule.** Pages take every method name from `terms` (via a small `terms.ts` module: `term(id)`, `termWithTechnical(id)`, `meaning(id)`) and never type one. The graph component stays free of cricket and regression words, as in 020.

Before the reference response arrives, a page shows the existing "not available right now" placeholder for any string that needs a term; it never shows a literal fallback name.

## R7. Marked regions for the check

020's detail-level module already marks Commentary (`.commentary` panels, with `[data-commentary-toggle]` buttons and a `data-open` attribute). The check must not rely on CSS classes (brief), so:
- Commentary: add `data-region="commentary"` to every Commentary panel (done where panels are built; checked by a unit test that every `.commentary` element has it).
- Scorebook: `data-region="scorebook"` on `#scorebook-panel` and on every full reference view it shows.
- Agent reasoning: `data-region="reasoning"` on every element that shows the agent's words verbatim (round feed `reason`, step summary text quoting the model, state view proposal reasons).
- Definitions: `data-region="definition"` on the Words we use list and on the brute-force definition paragraphs, so "forward selection" is allowed there.

Allowed-where table (single source in the term payload `banned`): "forward selection" is allowed in `definition` anywhere, and in `commentary` and `scorebook` only inside brackets after a plain term; "rival", "know-nothing", "mechanical search" and "setup" are allowed nowhere except `reasoning`.

Walking up from a text node to the nearest `[data-region]` decides whether it is exempt; the nearest landmark (`main`, `section[aria-labelledby]`, `nav`, `[role=region]`) is used in the failure message.

## R8. What the check collects

For both pages and for each run source (recorded run finished; fake-model live run finished), with `?view=everything` and every Scorebook panel opened in turn:
- visible text: `innerText` of each element outside `[hidden]`/`display:none` (a text walker, so exempt regions can be recognised per node);
- accessible names: `aria-label`, `aria-labelledby` targets, `alt`, `title` attributes;
- SVG `<title>` and `<desc>` (not covered by `innerText`);
- live-region text: `[aria-live]`, `[role=status]` and `[role=alert]` content, plus the announcements emitted while the run plays (captured by a `MutationObserver` installed before the run starts);
- `document.title` and `<meta>` preview tags (`og:*`, `twitter:*`, `description`).

Text inside native `<option>` and placeholder attributes is included. The Scorebook's data grid shows real innings data (team names etc.), which cannot contain banned words; it is not exempt, so the check also proves that.

## R9. The definition and the link

- Scoreboard sentence beside "THE YARDSTICK" row: the graph is a shared component that draws rows from `/api/structure` (`ROW_DEFS`). The row note ("runs when the agent stops") comes from the backend (`stage_info.rows()`). The sentence goes in part 3's page markup directly below the `<graph-replay>` (outside the graph component, so it stays free of cricket words), in a paragraph with `id="brute-force"`. "Beside the row" is met by placing it directly under the graph with a visible line; the graph row's own note gets the plain wording. A true side-by-side placement would need the graph component to host page content, which 020 deliberately avoided. [Flagged as a deviation from "next to the row" in the brief; see Open points.]
- Definition text is fixed HTML in `under-the-hood.html`? No: it uses terms ("brute-force search", "settings", "clues"), so it must follow the backend list. Decision: render it from `terms` with a template in the page's TS, the single copy of the sentence being a backend string `BRUTE_FORCE_DEFINITION` in `methods.py` (sent in `terms`' companion field `definitions`). The page inserts it by anchor; the static-text test checks the markup placeholder. This keeps the sentence out of the page.
- Commentary paragraph: also from `definitions.brute_force_technical`, with 24 and 2^19 computed in the backend (`grid_combinations()` and `2 ** n_features`), not typed.
- Verdict link: the verdict builder wraps the first "brute-force search" in the verdict text in `<a href="/under-the-hood.html#brute-force">`. The verdict h2/sentences are backend strings; the page links the first occurrence of `term("brute_force").plain` in the verdict block by text match on the served term (not a literal). `anchors.ts` (020) already handles hash navigation and focus; `#brute-force` is added to its known list.

## R10. "Words we use" placement

In Commentary of part 4 ("What you see") would put a glossary after three parts that already use the words. Part 1 ("Overview"/big picture) is first on the page. **Decision: Commentary of the Overview block (`#commentary-big`)**, so a visitor who opens Commentary meets the glossary before the parts that use the words. It is a `<dl>` rendered from `terms`, in list order, with `data-region="definition"`. The brief allowed "or the plan's better place"; the Overview is that place. It adds roughly 10 × 12 = ~120 words to the "everything" level only.

## R11. Word counts

020's limits: ≤ 500 simple and ≤ 1,200 everything-open, per page (`word-count.spec.ts`). Expected impact:
- Simple, How it was built: +~50 words (the definition sentence: 47 words) and a few longer terms. Baseline must be measured first (implementation step 0). If the page is over 500, wording is cut in this order: (1) the part 3 lead sentence if it repeats the graph row notes; (2) the hero fact labels; (3) Overview tile captions. The definition sentence itself is fixed by the spec and is never cut.
- Everything-open, How it was built: +~120 (glossary) + ~70 (technical paragraph + honesty note) ≈ +190. Cut order if over 1,200: (1) one-line meanings in "Words we use" trimmed to ≤ 10 words; (2) the Commentary card text of part 4.
- Main page: simple +~10 (longer terms), everything +~30 (brackets).

Before and after numbers are recorded in `quickstart.md` by the word-count step.

## R12. Terms and edge wording

- "AI agent": the Scoreboard shorthand "the agent" (already used in `headlines.py`) is kept: it is not a method name, and "AI agent" is used at first mention in each block. The check does not ban "the agent".
- "idea": replaces "setup" and "candidate model" at the Scoreboard. "candidate model" survives only as the bracketed technical term. The model's own words ("proposal") are in the agent's reasoning (exempt).
- "test season / final test": both accepted; "test year" becomes "test season" where it is visible text (the glossary has "check seasons", so "years" would mix). This is a visible-text change in many places (`season_split`-driven strings); listed in the plan. [Open point.]
- "our pick": already used on the verdict; the technical form "the model chosen on the check seasons" is its bracket in Commentary and Scorebook.
- Fact meanings (`cricket_facts`) are prompt text for the model, not visible, but they flow into the recorded `explanation.facts` the page can show; reworded and covered by the wording check.

## Open points

1. **"Beside the row" (R9).** The sentence sits directly under the graph, not inside the row, to keep the graph component free of page content. If the owner wants it inside the row, the graph needs a slot; that is a change to feature 020's shared component.
2. **"test year" → "test season" (R12; task T036).** The glossary says "test season / final test". Visible text still says "test year" in places. The plan renames them; if the owner prefers to leave "year" (it is not a banned or glossary-conflicting word), drop task T036.
