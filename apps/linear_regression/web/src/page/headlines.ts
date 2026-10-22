// The headline set `final_test` sends (app-specific, types only; the words are the server's, see backend/linreg/headlines.py).
export interface Scoreboard {
  subject_label: string;
  subject_miss: number | null;
  tv_miss: number;
  facts: { id: string; text: string }[];
}

export interface ResultStrip { label: string; text: string }

export interface Headlines {
  case: "beat" | "edged" | "held" | "no_llm";
  hero_h1: string;
  lead: string;
  verdict_h2: string;
  vs_search: string | null;
  scoreboard: Scoreboard;
  result_strip: ResultStrip;
}
