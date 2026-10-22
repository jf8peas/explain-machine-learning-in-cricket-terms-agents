// The final test tab's pure view of the run state (app-specific): the methods as rows, shortest average miss first, with the
// page copy the design README gives each method, and the two exams' scores for the "why the scores differ" section.
// Nothing here draws; the section modules do.
import { examYears, tenths, type ExamYears } from "../exam";
import type { Attempt } from "../leaderboard";
import { cap, methodModel, term, technical } from "../terms";
import type { CricketExplanation, Fact, FinalState } from "./types";

/** Page copy per method id: the name is the glossary's plain term, the description its technical term (both from the server's list). */
export function copyFor(id: string): { name: string; description: string } {
  const technicalOf: Record<string, Parameters<typeof technical>[0]> = {
    llm: "agent", forward: "brute_force", broadcaster: "tv", know_nothing: "average_total",
  };
  const t = technicalOf[id];
  return { name: cap(methodModel(id)), description: t ? technical(t) : "" };
}

/** The colour token of each method; always paired with the name, a hatch or a shape, never the only cue. */
export const TOKEN: Record<string, string> = {
  llm: "var(--m-llm)", forward: "var(--m-forward)", broadcaster: "var(--tv)", know_nothing: "var(--m-know-nothing)",
};

const COUNT_WORDS = ["no", "one", "two", "three", "four"];

export interface Row {
  id: string;
  name: string;
  description: string;
  miss: number;
  within10: number;
  within20: number;
  bias: number;
  phrase: string;
  isChosen: boolean;
}

/** The methods in `final.methods`, sorted by average miss ascending; ties keep the order of `final.methods`. */
export function rows(final: FinalState): Row[] {
  const list = final.methods.filter((id) => final.accuracy[id]).map((id, i) => ({ id, i, a: final.accuracy[id] }));
  list.sort((x, y) => x.a.average_miss - y.a.average_miss || x.i - y.i);
  return list.map(({ id, a }) => ({
    id, name: copyFor(id).name, description: copyFor(id).description,
    miss: a.average_miss, within10: a.within_10, within20: a.within_20, bias: a.bias,
    phrase: final.bias_phrases?.[id] ?? "", isChosen: id === final.winner,
  }));
}

/** The header lead: the innings count, the test year and how many predictions were made (all from the state). */
export function headerLead(testYear: number | undefined, innings: number | undefined, methods: number): string {
  const year = testYear === undefined ? `the ${term("test_season")}` : String(testYear);
  const each = innings === undefined ? "each innings" : `each of the ${innings} innings`;
  const words = COUNT_WORDS[methods] ?? String(methods);
  return `For ${each} of ${year}, ${words} predictions of the final total, made at the halfway mark and then compared with what really happened.`;
}

export function fact(e: CricketExplanation | undefined, id: string): Fact | undefined {
  return e?.facts?.[id];
}

export function factText(e: CricketExplanation | undefined, id: string): string | undefined {
  return fact(e, id)?.display;
}

export function factFlag(e: CricketExplanation | undefined, id: string): boolean {
  return fact(e, id)?.value === true;
}

// ---------------- the two exams ----------------

/** Two models' scores on one exam, in tenths of a run as displayed. `ai` is null without the AI's model. */
export interface ExamScores { rival: number | null; ai: number | null }

export interface ExamView {
  validation: ExamScores;          // from final.validation_mae
  test: ExamScores;                // from final.accuracy
  aiTook: boolean;                 // the AI's model took part and has a score on both exams
  chosen: "ai" | "rival";          // final.winner: the choice made on validation, before the test
  years: ExamYears;
  innings: number;
  candidateModels: number;         // the AI's fitted attempts plus the grid's allowed cells
  tv: number | null;               // the broadcaster's projection's and the average-total guess's test misses (tenths)
  knowNothing: number | null;
}

const tenthsOrNull = (x: number | null | undefined): number | null => (x === null || x === undefined ? null : tenths(x));

/** How many candidate models were scored on the check seasons: the AI's fitted attempts plus the grid's allowed combinations. */
export function countCandidateModels(attempts: Attempt[] | undefined, grid: { cells?: { allowed?: boolean }[] } | undefined): number {
  const ai = (attempts ?? []).filter((a) => a.proposer === "llm").length;
  const cells = (grid?.cells ?? []).filter((c) => c.allowed).length;
  return ai + cells;
}

/** The two exams' scores for the run, or undefined until the final test is on display. */
export function examView(state: Record<string, unknown>): ExamView | undefined {
  const final = state.final as FinalState | undefined;
  const years = examYears(state.split as Parameters<typeof examYears>[0]);
  if (!final || !final.accuracy || !years) return undefined;
  const acc = final.accuracy;
  const val = final.validation_mae ?? { llm: null, forward: null };
  const aiScores = final.llm_took_part && acc.llm !== undefined && val.llm !== null && val.llm !== undefined;
  const first = Object.values(acc)[0];
  return {
    validation: { rival: tenthsOrNull(val.forward), ai: aiScores ? tenthsOrNull(val.llm) : null },
    test: { rival: tenthsOrNull(acc.forward?.average_miss), ai: aiScores ? tenthsOrNull(acc.llm?.average_miss) : null },
    aiTook: aiScores,
    chosen: final.winner === "llm" ? "ai" : "rival",
    years, innings: first ? first.n : 0,
    candidateModels: countCandidateModels(state.attempts as Attempt[] | undefined, state.grid as { cells?: { allowed?: boolean }[] } | undefined),
    tv: tenthsOrNull(acc.broadcaster?.average_miss), knowNothing: tenthsOrNull(acc.know_nothing?.average_miss),
  };
}
