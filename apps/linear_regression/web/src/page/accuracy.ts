// The final results' accuracy section (app-specific): every method side by side, then what the figures say in words.
// All figures and sentences come from the run state, which the server built from code; everything goes in as text.
import { renderChart, type ChartPoints } from "./accuracy-chart";
import { fmt, h } from "./dom";
import type { Figures, MethodDef } from "./reference";

export interface FinalAccuracy {
  winner: string;
  llm_took_part: boolean;
  methods: string[];
  method_defs: MethodDef[];
  accuracy: Record<string, Figures>;
  bias_words: Record<string, string>;
  bias_sentence: string | null;
  identical: string[][];
  reference_finding: { finding: string; sentence: string };
}

// Page text, not a figure: no method can be perfect, so the aim is to be clearly better than the references.
const EXPECTATIONS =
  "No method can predict a final total perfectly from the halfway mark. What happens in the last 10 overs (a collapse, " +
  "a batter getting going, rain) is partly unpredictable, so the aim is to be clearly better than the references, not perfect.";

// [column key, plain name, technical name in brackets]
const SINGLE: Record<string, [string, string]> = {
  average_miss: ["Average miss", "mean absolute error"],
  miss_percent: ["Miss as a share of a typical total", "relative error"],
  bias: ["Bias", "mean signed error"],
};

function heading(key: string): HTMLElement {
  const [plain, technical] = SINGLE[key];
  return h("th", { scope: "col", rowspan: "2" }, `${plain} (${technical})`);
}

function tableHead(): HTMLElement {
  return h("thead", {},
    h("tr", {},
      h("th", { scope: "col", rowspan: "2" }, "Method"),
      heading("average_miss"),
      h("th", { scope: "colgroup", colspan: "2" }, "Hit rate (share within a tolerance)"),
      heading("miss_percent"),
      heading("bias"),
      h("th", { scope: "col", rowspan: "2" }, "Innings")),
    h("tr", {}, h("th", { scope: "col" }, "Within 10 runs"), h("th", { scope: "col" }, "Within 20 runs")));
}

function tableBody(f: FinalAccuracy): HTMLElement {
  return h("tbody", {}, ...f.methods.map((id) => {
    const a = f.accuracy[id];
    const def = f.method_defs.find((d) => d.id === id);
    const winner = id === f.winner;
    return h("tr", { "data-testid": "accuracy-row", "data-method": id, class: winner ? "winner" : "" },
      h("th", { scope: "row" }, def?.name ?? id, ...(winner ? [h("span", { class: "tag" }, "winner")] : []),
        h("span", { class: "method-note" }, def?.note ?? "")),
      h("td", { "data-col": "average_miss" }, fmt(a.average_miss)),
      h("td", { "data-col": "within_10" }, `${fmt(a.within_10)}%`),
      h("td", { "data-col": "within_20" }, `${fmt(a.within_20)}%`),
      h("td", { "data-col": "miss_percent" }, `${fmt(a.miss_percent)}%`),
      h("td", { "data-col": "bias" }, f.bias_words[id] ?? fmt(a.bias)),
      h("td", { "data-col": "n" }, String(a.n)));
  }));
}

/** The side-by-side table, then the findings in words. `testYear` only names the year in the caption. */
export function renderAccuracy(f: FinalAccuracy, testYear?: number, points?: ChartPoints): HTMLElement[] {
  const first = f.accuracy[f.methods[0]];
  const caption = h("caption", { "data-testid": "accuracy-caption" },
    `How each method did against the real final totals of the ${first.n} innings in the test year` +
    `${testYear ? ` (${testYear})` : ""}, each scored once.`);
  const parts: HTMLElement[] = [
    h("div", { class: "table-scroll" },
      h("table", { class: "accuracy-table", "data-testid": "accuracy-table" }, caption, tableHead(), tableBody(f))),
    h("p", { class: "finding", "data-testid": "reference-finding" }, `On the test year: ${f.reference_finding.sentence}`),
  ];
  if (f.bias_sentence) parts.push(h("p", { class: "finding", "data-testid": "bias-finding" }, f.bias_sentence));
  if (!f.llm_took_part) {
    parts.push(h("p", { class: "muted", "data-testid": "accuracy-absent" },
      "The language model's model is not in this comparison, because the language model did not take part in this run."));
  }
  if (f.identical.length) {
    const name = (id: string) => f.method_defs.find((d) => d.id === id)?.name ?? id;
    parts.push(h("p", { class: "muted", "data-testid": "accuracy-identical" },
      `${f.identical.map((p) => p.map(name).join(" and ")).join("; ")} gave identical guesses.`));
  }
  parts.push(h("p", { class: "expectations", "data-testid": "expectations-note" }, EXPECTATIONS));
  if (points && points.actual.length) {
    parts.push(renderChart({ points, defs: f.method_defs, methods: f.methods, winner: f.winner, identical: f.identical, testYear }));
  }
  return parts;
}
