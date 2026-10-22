// The round feed (app-specific, pure): one row for each round the agent has had so far, in plain words. It reads the round
// views the Scorebook's model list already uses (found/view.ts), so a round means the same thing everywhere. The agent's
// reasoning is the agent's own words, unchanged. A round is spoken once, in one short line, when it gets its final status.
import { term } from "./terms";
import { fromTenths, type RoundView } from "./found/view";
import type { Labeller } from "./setup";

export type FeedStatus = "scoring" | "first_score" | "new_best" | "no_better" | "rejected" | "finished" | "failed";

export interface FeedRow {
  round: number;
  /** The idea in plain words: the clue added, or the full list for a fresh start. */
  idea: string;
  /** The seasons choice, in the server's words. */
  seasons: string | null;
  /** The agent's own reasoning, verbatim (empty when it gave none). */
  reason: string;
  /** Average miss on the check seasons, one decimal; null until scored. */
  score: string | null;
  status: FeedStatus;
  statusText: string;
  /** The proposal's other settings in plain words (seasons learned from, recency weighting, which innings). */
  settings: string[];
}

export const STATUS_WORDS: Record<Exclude<FeedStatus, "rejected" | "failed">, string> = {
  scoring: "being scored",
  first_score: "first score",
  new_best: "new best",
  no_better: "no better",
  finished: "agent finished",
};

const list = (ids: string[], label: (id: string) => string) => ids.map(label).join(", ");

export function ideaWords(r: RoundView, label: (id: string) => string): string {
  if (!r.features.length) return r.kind === "finished" ? "No new idea" : "No clues proposed";
  if (r.change === "same") return "Keeps the same clues";
  if (r.change === "added") return `Adds ${list(r.added, label)}`;
  if (r.change === "first") return `Starts with ${list(r.features, label)}`;
  return `Tries ${list(r.features, label)}`;
}

/** The server's words for why code refused an idea, in the plain words the Scoreboard uses (the README's glossary): an idea, not a
 *  candidate model; clues, not features; check seasons, not validation. The reason itself is unchanged. */
export function plainWords(text: string): string {
  // keep a capital at the start of a word: "Candidate models" becomes "Ideas"
  const swap = (plain: string) => (m: string) => (m[0] === m[0].toUpperCase() ? plain[0].toUpperCase() + plain.slice(1) : plain);
  return text
    .replace(/candidate models/gi, swap("ideas")).replace(/candidate model/gi, swap("idea"))
    .replace(/\bfeatures\b/gi, swap("clues")).replace(/\bfeature\b/gi, swap("clue"))
    .replace(/\bvalidation\b/gi, swap("check seasons"));
}

/** The feed's one line keeps the point of a repeat's reason: "That idea was already tried: the same clues, window, weighting and training
 *  innings." reads as "That idea was already tried." (the full reason is the server's, shown in the graph's event panel). */
export function shortReason(text: string): string {
  return text.replace(/: the same (?:clues|features), window, weighting and training innings\.$/, ".");
}

function statusOf(r: RoundView): { status: FeedStatus; text: string } {
  switch (r.kind) {
    case "fitted": {
      const status: FeedStatus = r.firstScore ? "first_score" : r.improved ? "new_best" : "no_better";
      return { status, text: STATUS_WORDS[status] };
    }
    case "pending": return { status: "scoring", text: STATUS_WORDS.scoring };
    case "rejected": return { status: "rejected", text: `code rejected: ${shortReason(plainWords(r.message))}` };
    case "finished": return { status: "finished", text: STATUS_WORDS.finished };
    default: return { status: "failed", text: `stopped: ${plainWords(r.message)}` };
  }
}

/** The rows for the rounds on display. `label` names a clue; `menu` words a setup choice. */
export function feedRows(rounds: RoundView[], label: (id: string) => string, menu: Labeller, short: Labeller = menu): FeedRow[] {
  const before: Partial<Record<"window" | "weighting" | "training_innings", string>> = {};
  return rounds.map((r) => {
    const { status, text } = statusOf(r);
    // a round's settings are listed when they are new or changed: the first round gives them all, a later one only what it changed
    const settings = (["weighting", "training_innings"] as const)      // the seasons are in the idea line already
      .filter((part) => typeof r[part] === "string" && r[part] !== before[part]).map((part) => short(part, r[part] as string));
    for (const part of ["window", "weighting", "training_innings"] as const) if (typeof r[part] === "string") before[part] = r[part] as string;
    return {
      round: r.round, idea: ideaWords(r, label), seasons: typeof r.window === "string" ? menu("window", r.window) : null,
      reason: r.reason, score: r.miss === null ? null : fromTenths(r.miss), status, statusText: text, settings,
    };
  });
}

/** The one line spoken for a round that has its final status. Short: the round, how it went (without the reason code gave, which
 *  is on the page to read), and the score if it has one. */
export function spokenLine(row: FeedRow): string {
  const how = row.statusText.split(":")[0];
  return `Round ${row.round}: ${how}${row.score ? `, ${row.score} runs off` : ""}.`;
}

export interface AnnounceState { cursor: number; spoken: ReadonlySet<number> }

/** What to say now. A round is spoken once, when it first has its final status and the replay got there by playing or by one
 *  step forward. Going back, jumping several steps, or showing a finished run at once says nothing (and marks the rounds as
 *  heard, so they are not read out later). */
export function nextAnnouncement(prev: AnnounceState, now: { cursor: number; rows: FeedRow[] }): { line: string | null; state: AnnounceState } {
  const final = now.rows.filter((r) => r.status !== "scoring");
  const spoken = new Set(prev.spoken);
  const forwardOne = now.cursor === prev.cursor + 1;
  const fresh = final.filter((r) => !spoken.has(r.round));
  for (const r of final) spoken.add(r.round);
  if (!forwardOne || !fresh.length) return { line: null, state: { cursor: now.cursor, spoken } };
  return { line: spokenLine(fresh[fresh.length - 1]), state: { cursor: now.cursor, spoken } };
}

/** The line under the rounds when the language model did not take part or stopped early; null when it did its work. The
 *  reason is the server's, in its own words. */
export function llmNotice(status: string | undefined, failure: string | null | undefined, rounds: number): string | null {
  if (status !== "failed" && status !== "not_used") return null;
  const why = failure ? `: ${failure}` : ".";
  return rounds
    ? `The ${term("agent")} stopped early${why} Its best ${term("idea")} so far was kept, and the ${term("brute_force")} carried on.`
    : `The ${term("agent")} did not take part in this run${why} The ${term("brute_force")} carried on alone.`;
}
