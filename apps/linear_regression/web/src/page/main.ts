// The main page (feature 022, app-specific): the reader states the goal, presses play, watches the graph and sees the result when their
// run finishes. This file holds the page's one run state and wires the sections to it; each section has its own module. Nothing about
// a run is kept only while the reader visits another page of the app and comes back (run-store.ts); a reload starts idle.
import "./legacy.css";
import "./commentary.css";
import "./simple.css";
import "./silhouette.css";
import "../graph-replay/graph-replay";
import { setupHeader } from "../detail-level/site-header";
import { resolveAnchor } from "./anchors";
import { renderHero, type Hero } from "./hero";
import { lockedCard, TRY_LOCKED } from "./locked";
import { renderProblem } from "./problem";
import { loadReference } from "./reference";
import type { Reference } from "./reference-types";
import { initialRunState, lock, resultStrip, type RunState } from "./run-state";
import { saveRun, takeSavedRun } from "./run-store";
import { setupScorebook } from "./scorebook";
import { agentModel, setupTryIt } from "./tryit";
import { renderVerdict } from "./verdict";
import { setupWatch } from "./watch";

const section = (id: string) => document.getElementById(id) as HTMLElement;

setupHeader();

// coming back from another page (Under the hood, say) finds the last finished run as it was left
const saved = takeSavedRun();
let run: RunState = saved ? { phase: "finished", current: saved, last: saved, message: null, before: null } : initialRunState();
let reference: Reference | null = null;
let hero: Hero | null = null;

const tryRoot = document.querySelector("[data-testid=tryit]") as HTMLElement;
const setTryModel = setupTryIt(tryRoot);
const tryLocked = lockedCard({ id: "try-locked", testid: "try-locked", title: TRY_LOCKED, link: { href: "#watch", label: "Go to the player" } });
tryRoot.before(tryLocked);

const scorebook = setupScorebook(section("scorebook"), () => run.last);
const watch = setupWatch(section("watch"), { state: () => run, set });
if (saved) watch.showFinished(saved.events);
window.addEventListener("pagehide", () => saveRun(run.last));

/** What the verdict section was last drawn from, so it is redrawn only when its content changes (a toggle the reader opened stays open). */
let drawnVerdict: { last: unknown; key: string } | null = null;

function set(next: RunState) {
  run = next;
  draw();
}

function draw() {
  const locked = lock(run);
  watch.render(run);
  hero?.setStrip(resultStrip(run));
  const key = locked.locked ? `${locked.variant}|${run.message ?? ""}` : "open";
  if (!drawnVerdict || drawnVerdict.last !== run.last || drawnVerdict.key !== key) {
    drawnVerdict = { last: run.last, key };
    renderVerdict(section("verdict"), run, reference?.test?.year ?? null);
  }
  tryLocked.hidden = !locked.locked;
  tryRoot.hidden = locked.locked;
  setTryModel(agentModel(run.last?.state ?? null));
  scorebook.setLocked(locked.locked);
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

draw();

void loadReference().then((ref) => {
  reference = ref;
  hero = renderHero(section("hero"), ref, () => watch.focusPicker());
  renderProblem(section("problem"), ref);
  drawnVerdict = null;
  draw();
  followAnchor();
});
