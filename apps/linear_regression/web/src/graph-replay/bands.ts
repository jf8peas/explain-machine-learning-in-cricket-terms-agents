// Draws the stage rows: one full-width, borderless, tinted strip per row (Start, each stage, Finish), with its badge and
// name in a label column on the left. The row positions come from computeRows in layout.ts; this only draws them. Rows
// are the bottom layer of the SVG so they never hide an edge or a node.
import type { Row } from "./layout";
import { colourToken, NEUTRAL_TOKEN } from "./stages";
import { svg } from "./svg";

export function drawRows(layer: SVGGElement, rows: Row[]): void {
  layer.replaceChildren();
  for (const row of rows) {
    const staged = row.kind === "stage" && row.number !== null;
    const token = staged ? colourToken(row.number as number) : NEUTRAL_TOKEN;
    const g = svg("g", {
      class: `stage-row${staged ? "" : " edge-row"}`, "data-testid": "stage-band", "style": `--stage-colour: var(${token})`,
    });
    if (staged) { g.setAttribute("data-stage", row.stage as string); g.setAttribute("data-stage-number", String(row.number)); }
    else g.setAttribute("data-row", row.kind);
    g.appendChild(svg("rect", { x: row.x, y: row.y, width: row.w, height: row.h }));
    const label = svg("g", { class: "band-label", transform: `translate(${row.label.x},${row.label.y})` });
    if (staged) {
      label.appendChild(svg("circle", { class: "band-badge", r: 8 }));
      const n = svg("text", { class: "band-number" });
      n.textContent = String(row.number);
      label.appendChild(n);
    }
    const name = svg("text", { class: "band-name", x: staged ? 14 : -8 });
    name.textContent = row.name;
    label.appendChild(name);
    g.appendChild(label);
    layer.appendChild(g);
  }
}
