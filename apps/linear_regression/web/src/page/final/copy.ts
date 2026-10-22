// The final test tab's sentences that depend on the figures (app-specific, pure). Numbers in, strings out, so tests can drive
// each one with figures alone. Every number is the run's; the wording that is typed here contains no figure. "Too close to
// call" is decided by the shared rule in exam.ts, on the scores as displayed, and only when both models are present.
import { fromTenths, tooClose, type Seg } from "../exam";
import { term } from "../terms";
import type { ExamScores, ExamView } from "./view";

export type Lead = { who: "ai" | "rival" | "level"; close: boolean };

const both = (s: ExamScores): s is { rival: number; ai: number } => s.rival !== null && s.ai !== null;
const runs = (tenths: number) => `${fromTenths(tenths)} runs`;
const T = (n: number) => n / 10;                       // tenths back to runs for the shared rule

/** Who was ahead on one exam (the lower displayed average miss) and whether the gap is too close to call. Undefined without both scores. */
export function lead(s: ExamScores): Lead | undefined {
  if (!both(s)) return undefined;
  if (s.ai === s.rival) return { who: "level", close: true };
  return { who: s.ai < s.rival ? "ai" : "rival", close: tooClose(T(s.ai), T(s.rival)) };
}

/** The gap between the two models on one exam, in tenths. */
export function gap(s: ExamScores): number | undefined {
  return both(s) ? Math.abs(s.ai - s.rival) : undefined;
}

const name = (who: "ai" | "rival") => `${term(who === "ai" ? "agent" : "brute_force")}'s ${term("idea")}`;

type Verdict = "both" | "ai" | "rival" | "none";
function beating(s: { rival: number; ai: number }, reference: number | null): Verdict | null {
  if (reference === null) return null;
  const ai = s.ai < reference, rival = s.rival < reference;
  return ai && rival ? "both" : ai ? "ai" : rival ? "rival" : "none";
}

/** The sentence under the bars: who was more accurate on the test (or "too close to call"), and whether they beat the references. */
export function compareSentence(v: ExamView): Seg[] {
  const s = v.test;
  if (!v.aiTook || !both(s)) return [];
  const l = lead(s) as Lead;
  const out: Seg[] = [];
  if (l.close) {
    out.push({ text: `On ${v.years.test}, the ${term("agent")}'s and the ${term("brute_force")}'s ${term("idea")}s are ` }, { text: "too close to call", kind: "tooclose" },
      { text: ` (${fromTenths(s.ai)} and ${fromTenths(s.rival)} runs). ` });
  } else {
    const who = l.who as "ai" | "rival";
    out.push({ text: `On ${v.years.test}, the ${name(who)} was more accurate, by ${runs(gap(s) as number)}. ` });
  }
  const tv = beating(s, v.tv), kn = beating(s, v.knowNothing);
  const phrase = (b: Verdict, ref: string) => b === "both" ? `Both beat ${ref}` : b === "none" ? `Neither beat ${ref}`
    : `Only the ${name(b)} beat ${ref}`;
  if (tv && kn && tv === kn) {
    out.push({ text: `${tv === "both" ? "Both beat" : tv === "none" ? "Neither beat" : `Only the ${name(tv)} beat`} the ${term("tv")} and the ${term("average_total")}.` });
  } else {
    if (tv) out.push({ text: `${phrase(tv, `the ${term("tv")}`)}. ` });
    if (kn) out.push({ text: `${phrase(kn, `the ${term("average_total")}`)}.` });
  }
  return out;
}

/** "On the check seasons the brute-force search was ahead; on 2026 the AI agent edged it." and its variants; empty without both models. */
export function leadSentence(v: ExamView): string {
  const a = lead(v.validation), b = lead(v.test);
  if (!v.aiTook || !a || !b) return "";
  const who = (w: "ai" | "rival") => `the ${term(w === "ai" ? "agent" : "brute_force")}`;
  const year = String(v.years.test);
  if (a.who === "level" && b.who === "level") return `On the ${term("check_seasons")} and on ${year} the two were level.`;
  const first = a.who === "level" ? `On the ${term("check_seasons")} the two were level` : `On the ${term("check_seasons")} ${who(a.who)} was ahead`;
  if (b.who === "level") return `${first}; on ${year} the two were level.`;
  if (a.who === b.who) return `On the ${term("check_seasons")} and again on ${year} ${who(a.who)} was ahead.`;
  return `${first}; on ${year} ${who(b.who)} ${b.close ? "edged it" : "came out ahead"}.`;
}

/** "Both gaps are tiny." only when both exams' gaps are under the threshold. */
export function bothTiny(v: ExamView): string {
  const a = lead(v.validation), b = lead(v.test);
  return v.aiTook && a && b && a.close && b.close ? "Both gaps are tiny." : "";
}

/** The second reason: the run's own count of ideas tried on the check seasons. */
export function reasonTwo(v: ExamView): string {
  const checks = term("check_seasons"), idea = term("idea");
  return v.candidateModels === 1
    ? `1 ${idea} was tried on the ${checks}. Some of its score is luck, so it usually slips on fresh data.`
    : `${v.candidateModels} ${idea}s were tried on the ${checks} and the best one kept. Some of that best score is luck, so it usually slips on fresh data.`;
}

/** One shared scale end for the two exam cards: the largest score rounded up to the next whole 5 runs (at least 5). */
export function scaleMax(v: ExamView): number {
  const all = [v.validation.rival, v.validation.ai, v.test.rival, v.test.ai].filter((x): x is number => x !== null);
  const top = Math.max(0, ...all) / 10;
  return top <= 0 ? 5 : Math.ceil(top / 5 - 1e-9) * 5;
}
