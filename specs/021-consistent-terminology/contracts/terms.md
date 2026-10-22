# Contract: terms, regions and the banned-term check

## 1. `GET /api/reference` (additions)

Same route, same cache header. New fields `terms`, `definitions`, `banned`, `terms_version` as in [data-model.md](../data-model.md). Sent with and without the accuracy figures. `methods[*].name` and `.note` change wording only.

## 2. Front-end term module (`web/src/page/terms.ts`)

```ts
export interface Term { id: string; plain: string; technical: string; meaning: string; order: number; alt_plain: string | null }
export function setTerms(payload: TermsPayload): void;      // called once when /api/reference (or the recorded run's reference) arrives
export function term(id: TermId): string;                   // plain term; "not available right now" marker before setTerms
export function termWithTechnical(id: TermId): string;      // "plain (technical)"
export function meaning(id: TermId): string;
export function definition(key: "brute_force" | "brute_force_technical" | "brute_force_honest"): string;
```

`TermId` is a string union of the ten ids (the only place ids are typed in the page; they are identifiers, not words). A lint-style unit test (`no-literal-terms.test.ts`) fails if any file under `web/src/page` (except `terms.ts` and CSS) contains a glossary plain term or banned pattern inside a string literal or template literal.

## 3. Region markers

| Attribute | Placed on | Meaning for the check |
|---|---|---|
| `data-region="commentary"` | every Commentary panel | "forward selection" allowed only inside brackets after a plain term |
| `data-region="scorebook"` | the Scorebook panel and each full reference view | same: only inside brackets after a plain term |
| `data-region="definition"` | the Words we use list and the brute-force definition paragraphs | "forward selection" allowed anywhere in the region |
| `data-region="reasoning"` | every element showing the agent's words verbatim | every banned pattern allowed |

Nested regions: the nearest ancestor with `data-region` wins. Text with no region ancestor is Scoreboard text: nothing banned is allowed.

## 4. Anchor

`/under-the-hood.html#brute-force` → the paragraph with `id="brute-force"` in part 3 · Inside the agent (Scoreboard level, visible without opening Commentary). `anchors.ts` moves focus to it and scrolls it into view.

## 5. Banned-term check (`web/tests/e2e/banned-terms.spec.ts`)

Inputs: both pages × {recorded run finished, fake-model live run finished} with `?view=everything` and each Scorebook panel opened in turn.

Collects: text nodes (with their region), `aria-label`, `aria-labelledby` targets, `alt`, `title`, SVG `<title>`/`<desc>`, live-region text and announcements seen during playback, `document.title`, `<meta>` preview tags.

Failure message per hit: `banned "<pattern>" on <page> in <landmark>: "<30 characters of context>"`.

Allowlist: `web/tests/e2e/banned-terms.allow.ts` exports approved phrases that contain "setup" (empty at the start; the check is green only if nothing needs it).

Self-test: the spec first injects a text node "the rival" into an unmarked region and into a `reasoning` region and asserts that exactly the first is reported, so a broken collector cannot pass silently.

## 6. Python tests

| Test | Asserts |
|---|---|
| `test_terms.py` | list shape, unique plain terms, no banned pattern in plain/alt/meaning, ten ids, order stable |
| `test_terms_sources.py` | `METHOD_LABELS`, `method_defs`, node summaries and `headlines` take their words from the list (changing a term in a temporary list changes their output) |
| `test_wording_no_banned.py` | every backend wording function's output, run on the fixtures, has no banned pattern outside "forward selection" in technical strings |
| `test_recorded_run.py` (extended) | file's `wording_version` equals the code's; a fresh rebuild of every code-worded string equals the file's |
| `test_reword_script.py` | the script is idempotent, changes no number, no proposal reason, no fingerprint; refuses a file whose fingerprint does not match the data |
| `test_static_terms.py` | `index.html` and `under-the-hood.html`: no banned pattern; glossary terms spelled as in the list; no known variants |
| `test_writing_reply.py` (extended) | a reply containing a banned term is rejected and falls back to the template wording |
