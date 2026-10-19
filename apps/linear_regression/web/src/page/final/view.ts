// The final test tab's pure view of the run state (app-specific): the methods as rows, best average miss first, with the
// page copy the design README gives each method. Nothing here draws; the section modules do.
import type { CricketExplanation, Fact, FinalState } from "./types";

/** Page copy per method id (names and one-line descriptions come from the design README, not from the run). */
export const COPY: Record<string, { name: string; description: string }> = {
  llm: { name: "The AI agent's model", description: "" },
  forward: { name: "The rival's model", description: "forward selection" },
  broadcaster: { name: "The TV projection", description: "run rate × 20 overs" },
  know_nothing: { name: "The know-nothing guess", description: "always the average total" },
};

/** The note on the chosen model's row. */
export const PICK_NOTE = "our pick, chosen before the test";

/** The colour token of each method; always paired with the name, a hatch or a shape, never the only cue. */
export const TOKEN: Record<string, string> = {
  llm: "var(--m-llm)", forward: "var(--m-forward)", broadcaster: "var(--tv)", know_nothing: "var(--m-know-nothing)",
};

const PLACES = ["1st", "2nd", "3rd", "4th"];
const COUNT_WORDS = ["no", "one", "two", "three", "four"];

export interface Row {
  id: string;
  place: number;
  placeLabel: string;
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
  return list.map(({ id, a }, k) => ({
    id, place: k + 1, placeLabel: PLACES[k] ?? `${k + 1}th`,
    name: COPY[id]?.name ?? id, description: COPY[id]?.description ?? "",
    miss: a.average_miss, within10: a.within_10, within20: a.within_20, bias: a.bias,
    phrase: final.bias_phrases?.[id] ?? "", isChosen: id === final.winner,
  }));
}

/** The header lead: the test year, the innings count and how many predictions were made (all from the state). */
export function headerLead(testYear: number | undefined, innings: number | undefined, methods: number): string {
  const year = testYear === undefined ? "The test season" : String(testYear);
  const each = innings === undefined ? "its innings" : `each of its ${innings} innings`;
  const words = COUNT_WORDS[methods] ?? String(methods);
  return `${year}: a season nothing learned from or was chosen on. For ${each}, ${words} predictions of the final total, ` +
    "made at the halfway mark and then compared with what really happened.";
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
