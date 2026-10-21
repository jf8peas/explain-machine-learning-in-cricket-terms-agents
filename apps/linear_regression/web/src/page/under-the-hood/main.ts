// The Under the hood page ("How this app was built"). All of its text is in under-the-hood.html; this script runs the
// stage panels and fills the figures that change when the data is refreshed from two routes the app already serves.
// Each route can fail on its own: a figure that cannot be filled keeps the "not available right now" placeholder.
import { fillFigures, mountPanels } from "./dom";
import { buildFigures, type DataResponse, type ReferenceResponse } from "./figures";

async function getJson<T>(url: string): Promise<T | undefined> {
  try {
    const response = await fetch(url);
    return response.ok ? ((await response.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

mountPanels(document);

void Promise.all([getJson<DataResponse>("/api/data"), getJson<ReferenceResponse>("/api/reference")]).then(
  ([data, reference]) => fillFigures(document, buildFigures(data, reference)),
);
