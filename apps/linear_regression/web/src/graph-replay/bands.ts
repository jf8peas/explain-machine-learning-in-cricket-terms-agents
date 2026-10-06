// Draws the stage bands: labelled boxes behind the graph, one for each run of neighbouring nodes in a stage.
// The box positions come from computeBands in layout.ts; this only draws them. Bands are the bottom layer of the SVG so
// they never hide an edge or a node.
import type { Band } from "./layout";
import { colourToken, stageNumberOf, type StageDef } from "./stages";
import { svg } from "./svg";

export function drawBands(layer: SVGGElement, bands: Band[], stages: StageDef[]): void {
  layer.replaceChildren();
  for (const band of bands) {
    const number = stageNumberOf(stages, band.stage);
    const stage = number === null ? null : stages[number - 1];
    if (!stage || number === null) continue;
    const g = svg("g", {
      class: "band", "data-testid": "stage-band", "data-stage": band.stage, "data-stage-number": number,
      "data-nodes": band.nodes.join(" "), style: `--stage-colour: var(${colourToken(number)})`,
    });
    g.appendChild(svg("rect", { x: band.x, y: band.y, width: band.w, height: band.h, rx: 10 }));
    const label = svg("g", { class: "band-label", transform: `translate(${band.x + 12},${band.y + 12})` });
    label.appendChild(svg("circle", { class: "band-badge", r: 8 }));
    const n = svg("text", { class: "band-number" });
    n.textContent = String(number);
    label.appendChild(n);
    const name = svg("text", { class: "band-name", x: 14 });
    name.textContent = stage.name;
    label.appendChild(name);
    g.appendChild(label);
    layer.appendChild(g);
  }
}
