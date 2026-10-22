// The run's attempts and rounds as the state carries them, and the leading attempt (app-specific). The tab that shows them
// is built in found/; the summary line under the graph names the same leader.
import { cap, methodName } from "./terms";
import type { CheckError } from "./setup";

export interface Attempt {
  features: string[];
  proposer: "llm" | "forward_selection";
  window?: string;
  weighting?: string;
  training_innings?: string;
  checks?: CheckError[];
  validation_mae: number;
  validation_r2: number;
  improved: boolean;
  round: number;
}
export interface RoundNote {
  round: number;
  features: string[];
  window?: string | null;
  weighting?: string | null;
  training_innings?: string | null;
  reason: string;
  finished: boolean;
  outcome: "fit" | "rejected" | "finished" | "failed";
  message?: string;
}

const who = (p: Attempt["proposer"]) => cap(methodName(p === "llm" ? "llm" : "forward"));
/** The attempt with the lowest average error over the check years (the earliest wins a tie): the leading setup so far.
 *  The summary line under the graph names this one. */
export function leader(attempts: Attempt[]): Attempt | null {
  let best: Attempt | null = null;
  for (const a of attempts) if (best === null || a.validation_mae < best.validation_mae) best = a;
  return best;
}

/** Who proposed an attempt, as the summary line words it. */
export const proposerName = who;
