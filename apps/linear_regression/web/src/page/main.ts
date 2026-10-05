import "../graph-replay/graph-replay";
import "../tab-set/tab-set";
import type { TabSet } from "../tab-set/tab-set";
import type { ReplayChangeDetail } from "../graph-replay/graph-replay";
import type { Model } from "./predict";
import { loadCatalogue, setupCatalogue } from "./catalogue";
import { setupModels } from "./models";
import { renderResults } from "./results";
import { setupTryIt } from "./tryit";

// Optional ?interval=<ms> sets the starting pace (used by embeds and tests).
const interval = new URLSearchParams(location.search).get("interval");
if (interval) document.querySelector("graph-replay")!.setAttribute("interval-ms", interval);
const replay = document.querySelector("graph-replay") as HTMLElement;
const results = document.querySelector("[data-testid=results]") as HTMLElement;
const setModel = setupTryIt(document.querySelector("[data-testid=tryit]") as HTMLElement);

function modelFrom(state: Record<string, unknown> | null): Model | null {
  // The winner's model, once the run has finished (its features are the winner's after the final test).
  if (!state || !state.coefficients || state.intercept === undefined || !state.final || !state.explanation) return null;
  return {
    features: state.features as string[],
    coefficients: state.coefficients as Record<string, number>,
    intercept: state.intercept as number,
  };
}

let shown: Record<string, unknown> = {};
replay.addEventListener("replaychange", (ev) => {
  const d = (ev as CustomEvent<ReplayChangeDetail>).detail;
  shown = d.state;
  renderResults(results, d.state);
  setModel(modelFrom(d.finalState)); // the completed run's coefficients, whichever step is on display
});
renderResults(results, {});
setupModels(document.querySelector("[data-testid=model-picker]") as HTMLElement, replay);
setupCatalogue(document.querySelector("[data-testid=catalogue]") as HTMLElement);
void loadCatalogue().then(() => renderResults(results, shown)); // feature wording arrives with the catalogue

// The Data tab loads the first time it is shown (or straight away at #data); the Working tab never waits on it.
const tabs = document.querySelector("tab-set") as TabSet;
let dataStarted = false;
function startData() {
  if (dataStarted) return;
  dataStarted = true;
  const grid = document.querySelector("data-grid") as import("../data-grid/data-grid").DataGrid;
  void import("./data-tab").then((m) => m.init(grid));
}
if (tabs.active === "data") startData();
tabs.addEventListener("tab-show", (ev) => {
  if ((ev as CustomEvent<{ id: string }>).detail.id === "data") startData();
});
