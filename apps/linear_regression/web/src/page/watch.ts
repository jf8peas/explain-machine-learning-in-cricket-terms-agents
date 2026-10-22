// Watch it think (app-specific): the centrepiece. A loop strip, a player that plays the recorded run by itself when it first
// scrolls into view (or at once, finished, for a visitor who prefers reduced motion), a round feed with the agent's own reasoning,
// and the full agent graph in a Commentary panel. A button replays what is saved, with no model called and no run limit used; a
// live-run panel can start the agent for real. Every word about a round comes from the run; nothing is fetched to replay it.
import "../graph-replay/graph-replay";
import type { GraphReplay, ReplayChangeDetail } from "../graph-replay/graph-replay";
import type { StepEvent } from "../graph-replay/buffer";
import { labelFor, loadCatalogue, loadedCatalogue, menuLabel, menuShort } from "./catalogue";
import { h } from "./dom";
import { examYears } from "./exam";
import { buildView } from "./found/view";
import { buildLivePanel } from "./live-panel";
import { watchButton, type ShownRun } from "./player-state";
import { feedRows, llmNotice, nextAnnouncement, type AnnounceState, type FeedRow } from "./round-feed";
import { currentRun, failed, received, refused, runLabel, startLive, type RunInfo, type SourceState } from "./run-source";
import { dayText } from "./recorded";

export const KICKER = "WATCH IT THINK";
export const HEADING = "Each round, the agent proposes an idea. Code tests it.";
export const LOOP_STEPS = ["1 · Agent proposes clues", "2 · Code checks", "3 · Code fits a regression", "4 · Code scores it"];
export const LOOP_REPEAT = "↺ repeat until no better";
export const SCALE_NOTE = "Lower score = closer predictions (average runs off)";
export const LIVE_TOGGLE = "Run it live with your choice of AI";
export const GRAPH_TOGGLE = "Show the full agent graph";
export const FAILED_LIVE = "The live run did not finish, so the page keeps showing the run it had.";
export const NO_RECORDING = "There is no recorded run to play. Run it live to watch the agent work.";

/** How the page holds the run it is showing, so Watch it think can switch it when a live run reaches its final test. */
export interface PageState {
  source(): SourceState;
  update(next: SourceState): void;
}

export interface Watch {
  /** The recorded run has loaded (or could not be). */
  setRecorded(run: RunInfo | null): void;
}

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function loopStrip(): HTMLElement {
  return h("ol", { class: "loop-strip", "data-testid": "loop-strip", "aria-label": "What happens in a round" },
    ...LOOP_STEPS.map((text, i) => h("li", { class: i === 0 ? "ai" : "", ...(i === 0 ? { "data-actor": "llm" } : {}) }, text)),
    h("li", { class: "repeat" }, LOOP_REPEAT));
}

/** "What the agent decides" and "How each idea is scored", from the catalogue and the run's seasons. */
function commentaryAbove(state: Record<string, unknown>): HTMLElement {
  const cat = loadedCatalogue();
  const years = examYears(state.split as Parameters<typeof examYears>[0]);
  const first = (state.split as { first_year?: number } | undefined)?.first_year;
  const parts = h("div", { "data-region": "commentary", class: "commentary", id: "watch-commentary", "data-testid": "watch-commentary" },
    h("span", { class: "commentary-label" }, "Commentary"),
    h("h3", {}, "What the agent decides"),
    h("p", {}, "An idea is four choices: the clues, the seasons to learn from, how much to favour recent seasons, and which innings to include.",
      cat?.limit ? ` Up to ${cat.limit} clues` : "", cat?.round_cap ? `, up to ${cat.round_cap} rounds.` : cat?.limit ? "." : ""),
    h("h3", {}, "How each idea is scored"));
  if (years && first !== undefined) {
    const strip = h("ol", { class: "season-strip", "data-testid": "season-strip" },
      h("li", { class: "learn" }, h("strong", {}, "Learn"), ` ${first}–${years.first - 1}`),
      ...years.checks.map((y) => h("li", { class: "check" }, h("strong", {}, "Check"), ` ${y}`)),
      h("li", { class: "locked" }, h("strong", {}, "Locked"), ` ${years.test}`));
    parts.append(strip, h("p", {}, `Each idea is fitted on the seasons before a check season and scored on it; the three scores are averaged. ${years.test} stays locked until the end.`));
  } else {
    parts.append(h("p", { class: "muted" }, "The seasons appear once the data is split."));
  }
  return parts;
}

function rowEl(r: FeedRow): HTMLElement {
  const chips = r.settings.map((text) => h("li", { class: "setup-chip", "data-testid": "setup-chip" }, text));
  return h("li", { class: `round-row status-${r.status}`, "data-testid": "round-item", "data-round": String(r.round), "data-status": r.status },
    h("span", { class: "round-n" }, `ROUND ${r.round}`),
    h("div", { class: "round-main" },
      h("p", { class: "round-idea", "data-testid": "round-idea" }, h("strong", {}, r.idea), r.seasons ? ` · ${r.seasons}` : ""),
      ...(r.reason ? [h("blockquote", { class: "reason", "data-reasoning": "", "data-region": "reasoning", "data-testid": "model-reason" }, r.reason)] : []),
      ...(chips.length ? [h("div", { "data-region": "commentary", class: "commentary round-settings", "data-testid": "round-settings" },
        h("ul", { class: "setup-chips" }, ...chips))] : [])),
    h("div", { class: "round-result" },
      ...(r.score ? [h("strong", { class: "score", "data-testid": "round-score" }, r.score)] : []),
      h("span", { class: `status-tag status-${r.status}`, "data-testid": "round-status" }, r.statusText)));
}

export function setupWatch(root: HTMLElement, page: PageState): Watch {
  const query = new URLSearchParams(location.search).get("interval");
  const replay = document.createElement("graph-replay") as GraphReplay;
  replay.setAttribute("structure-url", "/api/structure");
  if (query) replay.setAttribute("interval-ms", query);

  const watchBtn = h("button", { type: "button", class: "btn filled", "data-testid": "watch-button" }, "▶ Watch the recorded run");
  const liveToggle = h("button", { type: "button", class: "btn outlined", "data-testid": "live-toggle", "data-commentary-toggle": "", "aria-controls": "live-panel", "aria-expanded": "false" }, LIVE_TOGGLE);
  const runLabelEl = h("span", { class: "run-label", "data-testid": "run-label" });
  const region = h("div", { class: "visually-hidden", role: "status", "aria-live": "polite", "aria-atomic": "true", "data-testid": "round-live-region" });
  const feed = h("ol", { class: "round-feed", "data-testid": "round-feed", "aria-label": "The rounds so far" });
  const notice = h("p", { class: "llm-notice", role: "status", "data-testid": "llm-notice", hidden: "" });
  const bestIdea = h("p", { class: "best-idea", "data-testid": "best-idea" });
  const graphToggle = h("button", { type: "button", class: "toggle", "data-testid": "graph-toggle", "data-commentary-toggle": "", "aria-controls": "graph-panel", "aria-expanded": "false" }, `${GRAPH_TOGGLE} `);
  const graphPanel = h("div", { "data-region": "commentary", class: "commentary graph-panel", id: "graph-panel", "data-testid": "graph-panel" }, h("span", { class: "commentary-label" }, "Commentary"), replay);
  const live = buildLivePanel();
  const above = h("div", { "data-testid": "watch-above" });
  const empty = h("p", { class: "muted", "data-testid": "feed-empty" });

  const player = h("div", { class: "player", "data-testid": "player" },
    h("div", { class: "toolbar" }, watchBtn, liveToggle, runLabelEl),
    h("p", { class: "scale-note" }, SCALE_NOTE),
    live.el, region, empty, feed, notice, bestIdea, graphToggle, graphPanel);

  root.replaceChildren(
    h("p", { class: "kicker" }, KICKER),
    h("h2", { id: "watch-title" }, HEADING),
    loopStrip(), above, player);

  // ---- what the player is doing
  let shows: ShownRun = "recorded";
  let last: ReplayChangeDetail | null = null;
  let announce: AnnounceState = { cursor: -1, spoken: new Set() };
  let liveActive = false;       // a live run was asked for and has not ended
  let liveOpening = false;      // ... and the server has not accepted it yet
  let seenRun = 0;
  let recordedLoaded = false;
  let autoplayed = false;

  const label = () => runLabel(currentRun(page.source()), dayText);

  function paint(d: ReplayChangeDetail) {
    last = d;
    const btn = watchButton({ shows, playing: d.playing, atEnd: d.atEnd, started: d.cursor >= 0 });
    watchBtn.textContent = btn.label;
    watchBtn.dataset.action = btn.action;
    runLabelEl.textContent = label();
    const rows = feedRows(buildView(d.state).rounds, labelFor, menuLabel, menuShort);
    feed.replaceChildren(...rows.map(rowEl));
    const best = d.state.llm_best as { features: string[]; window?: string } | null | undefined;
    bestIdea.textContent = best
      ? `Best idea: ${best.features.map(labelFor).join(", ")}${best.window ? `, ${menuLabel("window", best.window).replace(/^./, (c) => c.toLowerCase())}` : ""}.`
      : "";
    const said0 = llmNotice(d.state.llm_status as string | undefined, d.state.llm_failure as string | null | undefined, rows.length);
    notice.hidden = !said0;
    notice.textContent = said0 ?? "";
    if (d.cursor < 0) announce = { cursor: -1, spoken: new Set() };
    const said = nextAnnouncement(announce, { cursor: d.cursor, rows });
    announce = said.state;
    if (said.line) region.textContent = said.line;
  }

  function trackLive(d: ReplayChangeDetail) {
    if (d.run !== seenRun) {
      seenRun = d.run;
      if (liveOpening) { liveOpening = false; shows = "live"; live.say("The live run is under way."); }
    }
    if (!liveActive || liveOpening) return;
    const events: StepEvent[] = replay.events;
    page.update(received(page.source(), events, d.receivedState));
    const ended = d.failed || (d.finished && !d.receivedState.final);
    if (ended) {
      const out = failed(page.source());
      page.update(out.state);
      liveActive = false;
      live.setBusy(false);
      live.say(FAILED_LIVE, true);
      if (out.show) { replay.loadRun(out.show); replay.showEnd(); }
      shows = currentRun(page.source())?.kind ?? "recorded";
    } else if (d.finished) {
      liveActive = false;
      live.setBusy(false);
      live.say("The live run is finished. The page now shows it.");
    }
  }

  replay.addEventListener("replaychange", (ev) => {
    const d = (ev as CustomEvent<ReplayChangeDetail>).detail;
    trackLive(d);
    paint(d);
  });

  replay.addEventListener("refused", (ev) => {
    const info = (ev as CustomEvent<{ reason: string; message: string }>).detail;
    page.update(refused(page.source()));
    liveActive = false;
    liveOpening = false;
    live.setBusy(false);
    live.say(info.message, true);            // the gate's own words, in the panel
    if (info.reason === "model_not_allowed") void live.reload();
  });

  // ---- buttons
  watchBtn.addEventListener("click", () => {
    const action = watchBtn.dataset.action;
    if (action === "pause") replay.pause();
    else if (action === "restart") replay.restart();
    else replay.play();
  });

  live.onStart(() => {
    if (!replay.isReady) { live.say("The graph is still loading. Try again in a moment.", true); return; }
    const choice = live.chosen();
    liveActive = true;
    liveOpening = true;
    live.setBusy(true);
    live.say("Starting the run…");
    page.update(startLive(page.source(), choice.name));
    replay.startLive(choice.url);
  });

  // ---- the recorded run, and playing it by itself
  /** At least a quarter of the player is on screen right now (not merely at some earlier moment, before the page above it filled in). */
  function inView(): boolean {
    const r = player.getBoundingClientRect();
    const shown = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    return r.height > 0 && shown >= Math.min(r.height * 0.25, window.innerHeight * 0.25);
  }

  function maybeAutoplay() {
    if (autoplayed || !recordedLoaded || !inView()) return;
    autoplayed = true;
    if (reduced()) replay.showEnd();       // no animation: the finished run
    else replay.play();
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) maybeAutoplay();
    }, { threshold: [0, 0.25] });
    observer.observe(player);
  }

  // the commentary above the player needs the catalogue and the run's seasons
  void loadCatalogue().catch(() => undefined).then(() => { if (last) paint(last); });
  const refreshAbove = (state: Record<string, unknown>) => above.replaceChildren(commentaryAbove(state));
  refreshAbove({});

  return {
    setRecorded(run) {
      recordedLoaded = !!run;
      if (!run) {
        empty.textContent = NO_RECORDING;
        watchBtn.disabled = true;
        return;
      }
      watchBtn.disabled = false;
      replay.loadRun(run.events);
      refreshAbove(run.state);
      requestAnimationFrame(() => requestAnimationFrame(maybeAutoplay));      // after the sections above have filled in and settled
    },
  };
}
