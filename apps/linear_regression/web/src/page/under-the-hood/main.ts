// The "How this app was built" page. All of its text is in under-the-hood.html; this script wires the header's switch and the
// Commentary toggles, and fills the figures that change when the data or the agent changes from routes the app already
// serves. Each route can fail on its own: a figure that cannot be filled keeps the "not available right now" placeholder.
import "../commentary.css";
import "../simple.css";
import "../../graph-replay/graph-replay";
import { setupHeader } from "../../detail-level/site-header";
import { fillFigures } from "./dom";
import { buildFigures, type CatalogueResponse, type DataResponse, type ModelsResponse, type ReferenceResponse, type StructureResponse } from "./figures";

async function getJson<T>(url: string): Promise<T | undefined> {
  try {
    const response = await fetch(url);
    return response.ok ? ((await response.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

setupHeader();

void Promise.all([
  getJson<DataResponse>("/api/data"), getJson<ReferenceResponse>("/api/reference"), getJson<StructureResponse>("/api/structure"),
  getJson<CatalogueResponse>("/api/catalogue"), getJson<ModelsResponse>("/api/models"),
]).then(([data, reference, structure, catalogue, models]) => fillFigures(document, buildFigures(data, reference, { structure, catalogue, models })));
