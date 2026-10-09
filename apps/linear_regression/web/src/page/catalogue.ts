// The catalogue of candidate features, shown to the visitor (app-specific). Text only, never HTML.
import { menuLabeller, type Labeller, type Menus } from "./setup";

export interface CatalogueFeature {
  id: string;
  label: string;
  description: string;
  unit: string;
  bounds: { min: number; max?: number };
  source: Record<string, unknown>;
  inputs: string[];
}

export interface Catalogue {
  limit: number;
  features: CatalogueFeature[];
  setup_menus?: Menus;      // the choices a setup is made from, with the server's wording for each
}

let cached: Promise<Catalogue> | null = null;
/** Cricket wording for each feature id, filled when the catalogue loads (the id itself until then). */
export const featureLabels = new Map<string, string>();
export const labelFor = (id: string): string => featureLabels.get(id) ?? id;
/** The server's wording for a window, weighting or training-innings choice, filled when the catalogue loads. */
let menus: Menus | undefined;
export const menuLabel: Labeller = (menu, id) => menuLabeller(menus)(menu, id);

/** The catalogue from /api/catalogue, fetched once. */
export function loadCatalogue(url = "/api/catalogue"): Promise<Catalogue> {
  cached ??= fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<Catalogue>;
  }).then((c) => {
    for (const f of c.features) featureLabels.set(f.id, f.label);
    menus = c.setup_menus;
    return c;
  });
  cached.catch(() => { cached = null; }); // a failed fetch can be tried again
  return cached;
}

export function renderCatalogue(root: HTMLElement, catalogue: Catalogue): void {
  const intro = root.querySelector("[data-testid=catalogue-intro]") as HTMLElement;
  const list = root.querySelector("[data-testid=catalogue-list]") as HTMLElement;
  intro.textContent = `These are the measurements the agent may try, all taken at the end of the 10th over. ` +
    `A language model proposes which to use; code checks and scores each proposal. A model can use at most ` +
    `${catalogue.limit} features.`;
  list.replaceChildren(...catalogue.features.map((f) => {
    const li = document.createElement("li");
    li.dataset.testid = "catalogue-item";
    const name = document.createElement("strong");
    name.textContent = f.label;
    li.append(name, ` (${f.unit}): ${f.description}`);
    return li;
  }));
}

export function setupCatalogue(root: HTMLElement): void {
  loadCatalogue().then((c) => renderCatalogue(root, c)).catch(() => {
    (root.querySelector("[data-testid=catalogue-intro]") as HTMLElement).textContent =
      "The list of features could not be loaded just now.";
  });
}
