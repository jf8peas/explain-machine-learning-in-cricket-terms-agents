// The Scoreboard card's view (app-specific, pure). The server's headline set holds every word and every displayed average miss
// (headlines.py); this only lays them out and works out the kicker from the test season and the number of unseen innings.
import { fmt } from "./dom";

export interface Scoreboard {
  subject_label: string;
  subject_miss: number | null;
  tv_miss: number;
  facts: { id: string; text: string }[];
}

/** The headline set `final_test` sends (see backend/linreg/headlines.py). */
export interface Headlines {
  case: "beat" | "edged" | "held" | "no_llm";
  hero_h1: string;
  lead: string;
  verdict_h2: string;
  vs_search: string | null;
  scoreboard: Scoreboard;
}

export interface CardView {
  kicker: string;
  subject: { label: string; miss: string };
  tv: { label: string; miss: string };
  facts: { id: string; text: string }[];
}

export const TV_LABEL = "TV projection";

/** The card for a finished final test, or null before there is one. `innings` is the number of unseen innings scored. */
export function cardView(headlines: Headlines | undefined, testYear: number | undefined, innings: number | undefined): CardView | null {
  const card = headlines?.scoreboard;
  if (!card || card.subject_miss === null) return null;
  const season = testYear === undefined ? "" : `${testYear} SEASON, `;
  const unseen = innings === undefined ? "UNSEEN INNINGS" : `${innings} UNSEEN INNINGS`;
  return {
    kicker: `SCOREBOARD · ${season}${unseen}`,
    subject: { label: card.subject_label, miss: fmt(card.subject_miss) },
    tv: { label: TV_LABEL, miss: fmt(card.tv_miss) },
    facts: card.facts,
  };
}
