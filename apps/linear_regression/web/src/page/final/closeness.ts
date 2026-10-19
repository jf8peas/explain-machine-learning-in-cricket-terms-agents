// Section 2 of the final test tab (app-specific): how close did each method get. One stacked bar per method, in section 1's
// order, split into within 10 runs, 10 to 20 runs off and more than 20 runs off. The shares are worked out from the
// displayed within-10 and within-20 figures so the three always add to 100. The bias wording is the server's, shown as sent.
import { h } from "../dom";
import { TOKEN, factFlag, factText, type Row } from "./view";
import type { CricketExplanation } from "./types";

export type Band = "within10" | "within20" | "over20";

// ---------------- pure helpers (exported for tests) ----------------

/** The three shares, in whole percent, from the displayed within-10 and within-20 figures. They always add to 100. */
export function shares(within10: number, within20: number): [number, number, number] {
  const a = Math.max(0, Math.min(100, Math.round(within10)));
  const b = Math.max(a, Math.min(100, Math.round(within20)));
  return [a, b - a, 100 - b];
}

const BANDS: { band: Band; label: string }[] = [
  { band: "within10", label: "within 10 runs" },
  { band: "within20", label: "10 to 20 runs off" },
  { band: "over20", label: "more than 20 runs off" },
];

/** The closing line: our pick's within-10 share in words (the server's) and the "no method can be perfect" note. */
export function closingText(words: string | undefined, runs: string | undefined): string {
  const note = "No method can be perfect from the halfway mark: collapses, a batter getting going and the weather all happen after it.";
  if (!words || !runs) return note;
  const who = words.startsWith("only") ? "Even our pick" : "Our pick";
  return `${who} was within ${runs} runs of the real total ${words}. ${note}`;
}

// ---------------- rendering ----------------

function key(): HTMLElement {
  return h("div", { class: "close-key", "data-testid": "close-key" },
    ...BANDS.map((b) => h("span", { class: "close-key-item" }, h("span", { class: `close-swatch band-${b.band}`, "aria-hidden": "true" }), b.label)));
}

function closeRow(r: Row, expl: CricketExplanation | undefined): HTMLElement {
  const parts = shares(r.within10, r.within20);
  const bar = h("div", { class: "close-bar", "data-testid": "close-bar" });
  BANDS.forEach((b, i) => {
    const seg = h("span", { class: `close-seg band-${b.band}`, "data-testid": "close-seg", "data-band": b.band, title: `${parts[i]}% ${b.label}` },
      h("span", { class: "close-pct" }, `${parts[i]}%`));
    seg.style.flexGrow = String(parts[i]);
    seg.style.flexBasis = "0";
    if (parts[i] === 0) seg.hidden = true;
    bar.append(seg);
  });
  const large = r.id === "broadcaster" && factFlag(expl, "tv_bias_large");
  const bias = h("span", { class: `close-bias${large ? " close-bias-large" : ""}`, "data-testid": "close-bias", "data-large": String(large) }, r.phrase);
  const name = h("span", { class: "close-name" }, h("strong", { style: `color:${TOKEN[r.id] ?? "inherit"}` }, r.name), bias);
  return h("div", { class: "close-row", "data-testid": "close-row", "data-method": r.id }, name, bar);
}

/** Section 2's content: the lead, the key, a bar per method and, once the explanation exists, the closing line. */
export function renderCloseness(rows: Row[], expl: CricketExplanation | undefined, testYear: number | undefined): HTMLElement[] {
  const lead = h("p", { class: "final-lead" },
    `Every ${testYear === undefined ? "" : `${testYear} `}innings sorted by how far off the prediction was. More of the bar in the darkest shade means more innings called closely.`);
  const closing = expl && factText(expl, "share_within_10_words")
    ? [h("p", { class: "close-note", "data-testid": "close-note" },
        closingText(factText(expl, "share_within_10_words"), factText(expl, "within_runs_threshold")))]
    : [];
  return [lead, key(), h("div", { class: "close", "data-testid": "close" }, ...rows.map((r) => closeRow(r, expl))), ...closing];
}
