// The decorative cricket silhouettes (feature 024, app-specific): an empty, hidden span that silhouette.css paints from a shape file.
// No text, no children, not focusable; the page's word counts and screen readers never meet it.
import { h } from "./dom";

export type SilhouetteKind = "bowler" | "batter";

export function silhouette(kind: SilhouetteKind): HTMLElement {
  return h("span", { class: `silhouette silhouette-${kind}`, "aria-hidden": "true", "data-testid": `silhouette-${kind}` });
}
