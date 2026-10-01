import "../graph-replay/graph-replay";
import type { ReplayChangeDetail } from "../graph-replay/graph-replay";
import type { Model } from "./predict";
import { renderResults } from "./results";
import { setupTryIt } from "./tryit";

// Optional ?interval=<ms> sets the starting pace (used by embeds and tests).
const interval = new URLSearchParams(location.search).get("interval");
if (interval) document.querySelector("graph-replay")!.setAttribute("interval-ms", interval);
const replay = document.querySelector("graph-replay") as HTMLElement;
const results = document.querySelector("[data-testid=results]") as HTMLElement;
const setModel = setupTryIt(document.querySelector("[data-testid=tryit]") as HTMLElement);

function modelFrom(state: Record<string, unknown> | null): Model | null {
  if (!state || !state.coefficients || state.intercept === undefined || !state.explanation) return null;
  return {
    features: state.features as string[],
    coefficients: state.coefficients as Record<string, number>,
    intercept: state.intercept as number,
  };
}

replay.addEventListener("replaychange", (ev) => {
  const d = (ev as CustomEvent<ReplayChangeDetail>).detail;
  renderResults(results, d.state);
  setModel(modelFrom(d.finalState)); // the completed run's coefficients, whichever step is on display
});
renderResults(results, {});
