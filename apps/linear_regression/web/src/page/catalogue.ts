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
