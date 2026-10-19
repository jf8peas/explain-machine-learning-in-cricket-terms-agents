# Data model: Validation versus Test

Nothing new is calculated. The types below are pure views of values the run state already holds (see [research.md](research.md) §2). Misses are handled in tenths of a run as displayed, so every comparison can be checked by subtraction.

## `web/src/page/exam.ts` (shared by both tabs)

```ts
export const TOO_CLOSE_RUNS = 0.5;                    // the only definition of the threshold
export type Exam = "validation" | "test";

export const tenths = (x: number): number => Math.round(x * 10);       // moved from found/view.ts
export const fromTenths = (t: number): string => (t / 10).toFixed(1);
export const shown = (x: number): string => fromTenths(tenths(x));

/** Two displayed scores differ by less than TOO_CLOSE_RUNS. 0.49 is too close; exactly 0.5 is not. */
export function tooClose(a: number, b: number): boolean;     // |tenths(a) − tenths(b)| < TOO_CLOSE_RUNS × 10

export interface ExamYears { checks: number[]; first: number; last: number; test: number }
export function examYears(split: Split | undefined): ExamYears | undefined;

export function examPill(exam: Exam): HTMLElement;           // amber VALIDATION or dark TEST, with words
export function examBanner(exam: Exam, ...content: Node[]): HTMLElement;   // full width, pill then text
```

## What the agent found

```ts
/** Replaces WinnerView. gap, scores in tenths; never negative. */
export interface ChoiceView {
  state: "pending" | "clear" | "whisker" | "noAi";
  chosen: "ai" | "rival" | null;            // which candidate model goes forward (the recorded decision, never overridden)
  chosenMiss: number | null;                // tenths
  otherMiss: number | null;
  gap: number | null;                       // tenths
  tooClose: boolean;                        // state === "whisker"
}
export function choiceView(w: ValidationWinner | undefined, ai: number | null, rival: number | null): ChoiceView;
```

| Input | State |
|---|---|
| no `validation_winner` yet | `pending` |
| recorded winner is the AI with a score, rival present, gap ≥ 5 tenths | `clear`, chosen `ai` |
| same, gap < 5 tenths (includes a tie) | `whisker`, chosen `ai` |
| recorded winner is the rival, AI scorable, gap ≥ 5 | `clear`, chosen `rival` |
| same, gap < 5 (includes a displayed tie recorded as the rival's) | `whisker`, chosen `rival` |
| AI has no scorable candidate model (or the rival alone) | `noAi`, chosen `rival`, no gap, `tooClose` false |

Copy (pure, in `found/view.ts`): `choiceHeading(v)` ("The AI agent's candidate model" or "The rival's candidate model", plus ", by a whisker" when `tooClose`) and `choiceText(v)` (the README's text with the two scores and either the too-close sentence or "<gap> runs better", then the "A choice still has to be made, so the lower score goes forward…" clause only when `tooClose`).

## The final test

```ts
export interface ExamScores { rival: number | null; ai: number | null }        // tenths; ai null without the AI's model
export interface ExamView {
  validation: ExamScores;                   // from final.validation_mae
  test: ExamScores;                         // from final.accuracy.forward / .llm average_miss
  aiTook: boolean;                          // final.llm_took_part and both ai scores present
  chosen: "ai" | "rival";                   // final.winner
  years: ExamYears;                         // from split
  innings: number;                          // final.accuracy[m].n
  candidateModels: number;                  // attempts with proposer "llm" + grid cells with allowed
}
export function examView(state: Record<string, unknown>): ExamView | undefined;

export type Ahead = "ai" | "rival" | "close";
export function ahead(s: ExamScores): Ahead | undefined;                         // undefined unless both scores exist; "close" when tooClose
```

Pure sentences (in `final/copy.ts`; numbers in, strings out; each tested on at least three figure sets):

| Function | Output |
|---|---|
| `compareSentence(v)` | under the bars: "too close to call" when the AI and the rival on the test are within the threshold, otherwise which was more accurate and by how many runs; plus whether both beat the TV projection and the know-nothing guess (from the displayed test misses); empty without the AI's model |
| `leadSentence(v)` | "On the check seasons the rival was ahead; on <year> the AI edged it." (and its variants: ahead on both, ahead on one, close on one or both), built from `ahead()` on each exam; empty without the AI's model |
| `bothTiny(v)` | "Both gaps are tiny." only when both exams' gaps are under the threshold |
| `reasonTwo(v)` | "<candidateModels> candidate models were tried on the check seasons and the best one kept. Some of that best score is luck, so it usually slips on fresh data." |
| `scaleMax(v)` | one shared scale end for the two cards: the largest of the four scores rounded up to the next whole 5 runs (so bars share one axis from zero) |

The section's other copy ("Different seasons", "The test is the clean one", card captions) is fixed number-free text, except the year, which comes from `years`.

## Facts added on the server (takeaway 1 only)

| Fact id | Value | Display | Notes |
|---|---|---|---|
| `know_nothing_rising` | `is_large_bias(know_nothing figures)` and bias < 0 | yes / no | existing rule; no new threshold |
| `know_nothing_bias_runs` | absolute know-nothing bias | one decimal | |
| `know_nothing_bias_direction` | `"low"`, `"high"` or `"none"` | `"too low"`, `"too high"`, `"about right"` | same zero test as the TV's |

Dropped (only the removed verdict sentence used them): `race_leader`, `race_leader_label`, `race_leader_differs`, `leader_within_10`, `leader_within_10_words`, and the verdict's `visual.race_leader_differs`.
