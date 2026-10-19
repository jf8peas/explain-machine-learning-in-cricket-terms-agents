// The first card of The final test (app-specific): our pick, the candidate model chosen on validation, with its test score, and
// beside it the goal verdict from the explanation (the existing three variants, once the explanation exists). Every number is the
// run's; everything is set as text, and the verdict wording is the server's (a code-only block).
import { fmt, h } from "../dom";
import type { Block, Verdict } from "./types";
import { TOKEN, type Row } from "./view";

const SVG_NS = "http://www.w3.org/2000/svg";

function verdictShape(shape: string): SVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 20 20"); svg.setAttribute("width", "22"); svg.setAttribute("height", "22");
  svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "verdict-shape-svg");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", shape === "tick" ? "M4.5 10.5 L8.5 14.5 L15.5 5.5" : shape === "dash" ? "M4 10 L16 10" : "M5 5 L15 15 M15 5 L5 15");
  path.setAttribute("class", "verdict-mark");
  svg.append(path);
  return svg;
}

/** The goal verdict card: a shape and words, tinted win or lose. */
export function verdictCard(block: Block): HTMLElement {
  const v = block.visual as { variant?: Verdict; shape?: string };
  const reached = v.variant === "reached";
  const line = h("p", { class: `verdict-line ${reached ? "win" : "lose"}`, "data-testid": "verdict", "data-variant": v.variant ?? "" });
  const shape = h("span", { class: "verdict-shape", "data-testid": "verdict-shape", "data-shape": v.shape ?? "" });
  shape.append(verdictShape(v.shape ?? "cross"));
  line.append(shape, h("span", {}, h("strong", {}, `${block.title}. `), block.sentences[0] ?? ""));
  return line;
}

/** "Our pick: the AI agent's model" from the method's row name ("The AI agent's model"). */
export const pickTitle = (row: Row): string => `Our pick: ${row.name.replace(/^The /, "the ")}`;

/** The our-pick card and, beside it, the verdict card (absent until the explanation exists). */
export function renderPick(row: Row, testYear: number | undefined, verdict: Block | undefined): HTMLElement {
  const card = h("div", { class: "pick-card", "data-testid": "pick-card", "data-method": row.id, style: `border-left-color:${TOKEN[row.id] ?? "var(--text)"}` },
    h("p", { class: "pick-title", style: `color:${TOKEN[row.id] ?? "inherit"}` }, pickTitle(row)),
    h("p", { class: "pick-figure" }, h("span", { class: "pick-miss", "data-testid": "pick-miss" }, fmt(row.miss)), h("span", { class: "pick-unit" }, " runs off, on average")),
    h("p", { class: "pick-note" }, `Chosen on the check seasons, before ${testYear ?? "the test year"} was touched.`));
  return h("div", { class: "pick-row", "data-testid": "pick-row" }, card, ...(verdict ? [verdictCard(verdict)] : []));
}
