// What both result tabs share about the two exams (app-specific): validation, the check seasons used again and again to
// choose a candidate model, and the test, the final season used once to judge it. This is the only place the "too close to
// call" threshold is defined; both tabs import it, and the server never decides it. Scores are compared as the page shows
// them (one decimal), in tenths of a run, so the page can never call a gap "too close" that its own figures show as 0.5 or
// more. Everything is set as text.
import { h } from "./dom";

/** Two models' average misses on the same exam closer than this many runs are called too close to call. */
export const TOO_CLOSE_RUNS = 0.5;

export type Exam = "validation" | "test";

/** Tenths of a run as shown: 12.34 and 12.3 are both 123. */
export const tenths = (x: number): number => Math.round(x * 10);
export const fromTenths = (t: number): string => (t / 10).toFixed(1);
export const shown = (x: number): string => fromTenths(tenths(x));

/** The displayed scores differ by less than TOO_CLOSE_RUNS. 0.49 is too close; exactly 0.5 is not. */
export function tooClose(a: number, b: number): boolean {
  return Math.abs(tenths(a) - tenths(b)) < TOO_CLOSE_RUNS * 10;
}

export interface SplitYears { first_year: number; checks: { year: number }[]; test_year: number }
export interface ExamYears { checks: number[]; first: number; last: number; test: number }

/** The check years and the test year, as the run's split gives them. */
export function examYears(split: SplitYears | undefined): ExamYears | undefined {
  if (!split || !split.checks.length) return undefined;
  const checks = split.checks.map((c) => c.year);
  return { checks, first: checks[0], last: checks[checks.length - 1], test: split.test_year };
}

/** "2023–2025", or just "2023" when there is one check season. */
export const yearsText = (y: ExamYears): string => (y.first === y.last ? String(y.first) : `${y.first}–${y.last}`);

/** A piece of a sentence: plain, bold, or the phrase "too close to call" (marked so tests and styles can find it). */
export interface Seg { text: string; kind?: "strong" | "tooclose" }

/** The segments as nodes: bold ones in <strong>, the too-close phrase in a marked <strong>. Always text, never markup. */
export function renderSegs(segs: Seg[]): Node[] {
  return segs.map((seg) => seg.kind === "strong" ? h("strong", {}, seg.text)
    : seg.kind === "tooclose" ? h("strong", { class: "too-close", "data-testid": "too-close" }, seg.text)
    : document.createTextNode(seg.text));
}

/** The pill that names an exam: amber VALIDATION or dark TEST. The word is always there, so colour is never the only cue. */
export function examPill(exam: Exam): HTMLElement {
  return h("span", { class: `exam-pill exam-pill-${exam}`, "data-testid": "exam-pill", "data-exam": exam },
    exam === "validation" ? "VALIDATION" : "TEST");
}

/** The full-width banner under a tab's lead: the pill, then what the exam is. The text wraps under the pill when narrow. */
export function examBanner(exam: Exam, ...content: (Node | string)[]): HTMLElement {
  return h("div", { class: `exam-banner exam-banner-${exam}`, "data-testid": "exam-banner", "data-exam": exam },
    examPill(exam), h("p", { class: "exam-banner-text" }, ...content));
}
