// The main page (app-specific): one scrolling page led by the agent. This file wires the sections together; each section has
// its own module. The recorded run is loaded once and is what the page shows until a live run reaches its final test.
import "./legacy.css";
import "./commentary.css";
import "./simple.css";
import "../graph-replay/graph-replay";
import { setupHeader } from "../detail-level/site-header";
import { loadRecorded } from "./recorded";
import { resolveAnchor } from "./anchors";
import { renderHero } from "./hero";
import { setupScorebook } from "./scorebook";
import { renderProblem } from "./problem";
import { agentModel, setupTryIt } from "./tryit";
import { renderVerdict } from "./verdict";
import { setupWatch } from "./watch";
import { loadReference } from "./reference";
import type { Reference } from "./reference-types";
import { currentRun, initialSource, type SourceState } from "./run-source";

const section = (id: string) => document.getElementById(id) as HTMLElement;

setupHeader();

let source: SourceState = initialSource(null);
let reference: Reference | null = null;

/** Draw everything that shows the results of the run now on the page. */
const scorebook = setupScorebook(section("scorebook"), () => currentRun(source));
const setTryModel = setupTryIt(document.querySelector("[data-testid=tryit]") as HTMLElement);

function showResults() {
  const run = currentRun(source);
  renderHero(section("hero"), run, reference);
  renderProblem(section("problem"), reference);
  renderVerdict(section("verdict"), run);
  setTryModel(agentModel(run?.state ?? null));
  scorebook.refresh();
}

/** Old links (#working, #found, #final-test, #try-your-own, #data) land on their new places; #data opens the data panel. */
function followAnchor() {
  const target = resolveAnchor(location.hash);
  if (!target) return;
  history.replaceState(null, "", target.hash);
  if (target.panel) scorebook.open(target.panel);
  document.querySelector(target.hash)?.scrollIntoView({ block: "start" });
}
window.addEventListener("hashchange", followAnchor);

const watch = setupWatch(section("watch"), {
  source: () => source,
  update(next) {
    const before = currentRun(source);
    source = next;
    if (currentRun(source) !== before) showResults();
  },
});

void Promise.all([loadRecorded(), loadReference()]).then(([recorded, ref]) => {
  reference = ref;
  source = initialSource(recorded && { kind: "recorded", modelName: recorded.modelName, recordedOn: recorded.recordedOn, events: recorded.events, state: recorded.state });
  showResults();
  watch.setRecorded(currentRun(source));
  followAnchor();
});
