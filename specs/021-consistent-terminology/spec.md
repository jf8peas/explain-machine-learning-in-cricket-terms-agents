# Feature Specification: Consistent Terminology: One Set of Words, and the Brute-Force Search Defined

**Feature Branch**: `021-consistent-terminology` (work is on `main`; no branch hook ran)
**Created**: 2026-10-22
**Status**: Draft
**Input**: Consistent terminology: one set of words for the methods and ideas across the whole app, and a definition of the brute-force search on the "How this app was built" page. Builds on feature 020 (`specs/020-simpler-pages`) and applies to the pages as 020 leaves them, including the Scorebook views 020 keeps "unchanged in content".

## Context

The same things have different names in different places. The plain-code competitor is "the rival", "Rival", "the rival's model", "forward selection", "mechanical search" and "brute-force search"; the baseline is both "know-nothing guess" and "average-total guess"; "setup", "candidate model" and "idea" all appear. Visitors (data scientists, analysts, marketers, sales, finance, mostly arriving from LinkedIn) cannot tell these are the same things, and nowhere is the brute-force search actually explained.

This feature fixes one plain term per concept and uses it at every level, Scorebook included. The technical term appears in brackets after the plain term, "plain term (technical term)", at its first use in each Commentary panel and each Scorebook panel.

### The glossary

| Plain term (every level) | Technical term (in brackets, Commentary and Scorebook) | Replaces |
|---|---|---|
| AI agent | language-model agent | "the AI" as a method name |
| brute-force search | grid search with forward selection | the rival, Rival, rival's model, forward selection (as a name), mechanical search |
| TV projection | run rate × 20 overs | |
| average-total guess | baseline (the training seasons' average total) | know-nothing guess |
| idea | candidate model | setup |
| clues | features | |
| settings | hyperparameters | |
| check seasons | validation (rolling cross-validation) | |
| test season / final test | hold-out test | |
| our pick | the model chosen on the check seasons | |

## Clarifications

### Session 2026-10-22

- Q: How does the shipped recorded run get the new terms? → A (revised at planning, replacing "the backend maps them when serving it", because the page fetches the file statically and the backend never serves it): a no-model script rewords every code-worded string in the file from the facts it holds, with a stored wording version and a test that fails when the wording is out of date (FR-012).
- Q: How does the check tell a method-term "setup" from an ordinary one? → A: "setup" is banned everywhere except a short allowlist of approved phrases kept next to the check.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See one name for each thing (Priority: P1)

A visitor reading the main page or "How this app was built" meets each method and idea under a single name, from the hero through the race chart, grids, ranked list, check-seasons-vs-test card and takeaways, so they never wonder whether "the rival" and "the brute-force search" are different things.

**Why this priority**: It is the whole point of the feature.

**Independent test**: Render both pages on a finished run with everything open and every Scorebook panel open; the banned-term check (FR-013) passes and a reviewer finds one name per concept.

**Acceptance Scenarios**:

1. **Given** either page at any level (Scoreboard, Commentary, any Scorebook panel), **Then** every visible word, including chart labels and keys, SVG titles and descriptions, table headers, status tags, aria-labels, live-region announcements, tooltips, page titles and preview tags, uses the glossary's plain term, with the technical term only in brackets at its first use in a Commentary or Scorebook panel.
2. **Given** the baseline appears anywhere on the Scoreboard, **Then** it is called "average-total guess", never "know-nothing guess".
3. **Given** a sentence worded by the backend (verdict, summary, takeaway, rule of thumb), **Then** it uses the same terms as the page text.
4. **Given** the agent's own reasoning is shown, **Then** it appears exactly as written, even if it says "rival" or "forward".

---

### User Story 2 - Learn what the brute-force search is (Priority: P1)

A visitor on "How this app was built" wants to know what the competitor "brute-force search" does and why it matters, at Scoreboard level in one sentence and at Commentary level with the technical name and an honest caveat.

**Why this priority**: The competitor is the yardstick for judging the agent; without a definition the comparison is opaque.

**Independent test**: Open the page and check the sentence beside "THE YARDSTICK", the Commentary text, and the verdict link target.

**Acceptance Scenarios**:

1. **Given** part 3 · Inside the agent, **Then**, directly under the graph that carries the "THE YARDSTICK" row, one sentence reads: "The brute-force search is plain code, no AI: it tries every combination of settings and, inside each, adds clues one at a time, keeping whichever cuts the miss most. It is the yardstick: if the agent can't match it, its reasoning isn't adding anything."
2. **Given** that part's Commentary, **Then** it names the technical method: a grid search over 24 combinations of three hyperparameters (which innings, how many seasons, how much recent seasons count), with greedy forward selection of features in each cell.
3. **Given** the same Commentary, **Then** an honest note says "brute-force" refers to the settings: it does not try every possible set of clues (2^19, about 524,000).
4. **Given** the main page's verdict, **Then** its first Scoreboard use of "brute-force search" links to that definition on the "How this app was built" page.

---

### User Story 3 - Look up any term (Priority: P2)

A visitor who meets an unfamiliar word opens a "Words we use" glossary in Commentary on "How this app was built" and finds every plain term with its technical term and a one-line meaning.

**Why this priority**: It backs up the rest, but the pages work without it.

**Independent test**: Open the glossary and compare its rows to the backend's term list.

**Acceptance Scenarios**:

1. **Given** the glossary is open, **Then** it lists every plain term in the table above with its technical term and a one-line meaning, in the same order as the backend's list.
2. **Given** the backend's list changes, **Then** the glossary and every page use of the term change with it, with no page edit.

---

### User Story 4 - Keep the wording from drifting back (Priority: P2)

A maintainer changing copy later is stopped by an automated check if a banned term reappears.

**Why this priority**: Without it the fix decays.

**Independent test**: Add "the rival" to any visible string; the check fails and names the term and where it appeared.

**Acceptance Scenarios**:

1. **Given** a finished run with both pages rendered, everything open and every Scorebook panel open, **When** the check collects all visible text and accessible names, **Then** it fails on any banned term outside the exempt places and passes otherwise.

### Edge Cases

- No language model reachable: the card labelled "Brute-force search" in place of "AI agent" (feature 020) uses the same term.
- "setup" is banned everywhere except allowlisted ordinary phrases (FR-014); the two-word "set up" is not flagged.
- "forward selection" is allowed in Commentary and in Scorebook definitions, where it is the technical name, and nowhere else.
- A technical term appears in brackets after its plain term at the first use in each Commentary panel and each Scorebook panel, and not again in that panel.
- A live model reply that uses a banned term falls back to the plain wording (FR-005).
- If the term list cannot be loaded, the page shows its usual "not available right now" text where a term would go, never an old name; the term list is still sent when the accuracy figures cannot be read.
- The reasoning text and internal identifiers are exempt, so the check must distinguish them from visible copy.
- "Nodes" in Out of Scope means node behaviour and scoring; the wording of node summaries is in scope (FR-003).
- Longer or more explicit terms ("average-total guess", "brute-force search") must not push either page over feature 020's word limits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every visible word the app shows (page text, chart labels and keys, SVG titles and descriptions, table headers and columns, status tags, aria-labels, live-region announcements, tooltips, page titles, preview tags) MUST use the glossary, on both pages, in the Scoreboard, Commentary and every Scorebook panel, including the race chart, the grids, the ranked list, the check-seasons-vs-test card and the takeaways.
- **FR-002**: Every level MUST name a concept by its plain term, Scorebook chart keys, table columns and grids included. The technical term appears once, in brackets after the plain term, at its first use in each Commentary panel and each Scorebook panel, for example "brute-force search (grid search with forward selection)". The Scoreboard carries no technical term.
- **FR-003**: Method names and glossary terms MUST be defined once in the backend (a term list in `backend/linreg/methods.py`: id, plain term, technical term, one-line meaning, order) and sent to the page in an existing cached response; `cricket_facts.METHOD_LABELS`, the node summaries in `nodes.py` and the other backend wording MUST read from it; the page MUST NOT type its own method names.
- **FR-004**: Backend-worded sentences (verdicts, summaries, takeaways, rule of thumb, grid caption, fact meanings) MUST use the same terms.
- **FR-005**: For a live run, the check on the model's rewritten reply (`write_in_cricket_terms`) MUST also reject banned terms, so a reply containing one falls back to the plain wording, as a reply containing digits does today.
- **FR-006**: Static text (page titles, preview tags, the prose in `under-the-hood.html`) MAY stay fixed HTML, but a test MUST check every method and glossary term in it against the backend term list.
- **FR-007**: The agent's own reasoning MUST be shown exactly as written, and internal identifiers (CSS classes, test ids, state keys such as `forward_best`, code comments) MAY keep "rival" or "forward".
- **FR-008**: On "How this app was built", part 3 · Inside the agent MUST carry, directly under the graph that carries the "THE YARDSTICK" row, visible without opening Commentary, the exact one-sentence Scoreboard definition given in User Story 2, with a stable anchor (`#brute-force`).
- **FR-009**: The Commentary of the same part MUST give the technical name (grid search over 24 combinations of three hyperparameters, with greedy forward selection of features in each cell) and the honest note that "brute-force" refers to the settings and not to every possible set of clues (2^19, about 524,000).
- **FR-010**: The main page's first Scoreboard use of "brute-force search" (the verdict) MUST link to that definition.
- **FR-011**: Commentary on "How this app was built" MUST include a "Words we use" glossary listing every plain term with its technical term and a one-line meaning, rendered from the served term list in its order (a collapsible list inside Commentary, so the word limits hold).
- **FR-012**: The recorded run (`web/public/recorded-run.json`) is a static file the page fetches; the backend does not serve it. A script (`scripts/reword_recorded_run.py`, no language model, no re-run) MUST rebuild every code-worded string in it from the facts the file already holds, using the current backend wording functions, and MUST leave every number, the agent's proposal reasons and the data fingerprint untouched. The file MUST store a wording version, and a test MUST fail when the file's wording differs from what the backend would produce now.
- **FR-013**: An automated check MUST render both pages on the recorded run's finished state, and on a fake-model live run, with everything open and every Scorebook panel open; collect all visible text and accessible names (text, aria-label and aria-labelledby targets, SVG titles and descriptions, live-region text, page title, preview tags); and fail, naming the term, the page and the nearest landmark, on any banned term outside the exempt regions: "rival", "know-nothing", "mechanical search", "setup", and "forward selection" except as the bracketed technical term in a Commentary or Scorebook panel or inside a definition. The exempt regions are marked in the page (not by styling).
- **FR-014**: (The ban on "setup" in FR-013 has one exception.) "setup" MUST be banned everywhere in visible text and accessible names, except for approved phrases on a short allowlist kept next to the check.
- **FR-015**: Feature 020's word-count limits MUST still hold (each page: simple view ≤ 500 words, everything open with the Scorebook closed ≤ 1,200, excluding the agent's quoted reasoning).

### Key Entities

- **Term**: a glossary entry with a plain term, a technical term, a one-line meaning and the levels where each is used; the single source for all method names.
- **Banned term**: a word or phrase the automated check rejects in visible text and accessible names, with the places where it is allowed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With everything open and every Scorebook panel open on a finished run, both pages contain zero banned terms outside the exempt places.
- **SC-002**: Each glossary concept appears under exactly one plain name at every level, with its technical term in brackets only at its first use in each Commentary panel and Scorebook panel, and no synonym for the brute-force search or the baseline anywhere.
- **SC-003**: It takes one click from the verdict to the definition of the brute-force search, and the definition is visible without opening Commentary.
- **SC-004**: The "Words we use" glossary lists all 10 glossary rows, each with a technical term and a meaning.
- **SC-005**: Changing a term in the single backend list changes it everywhere on both pages with no page edit.
- **SC-006**: Both pages stay within feature 020's word limits.

## Assumptions

- The glossary table above is final wording; the one-line meanings in "Words we use" are written during planning in the same plain style as the pages.
- "Test season" and "final test" are one concept with two accepted plain forms, each used where it already reads naturally.
- The Scorebook keeps feature 020's content; only its words change.
- The fingerprint rule from 020 is not changed by this feature.

## Out of Scope

- The agent's prompts and the behaviour and scoring of its nodes and edges (the wording of node summaries is in scope).
- Renaming code identifiers (classes, test ids, state keys).
- The recipe-agent app.
- The main site.
