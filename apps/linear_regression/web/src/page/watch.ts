// Watch it think (feature 022, app-specific): the centrepiece. The reader chooses the AI and presses Play, which starts a real live run;
// the graph is shown by default and follows the run as it arrives (the node working is ringed, finished nodes are done), a "Right now"
// card says what is happening, and the round feed shows the agent's own words round by round. "Watch it again" replays the finished run
// from the events already received (no model call, no run limit used). The page-level run state lives in main.ts; this module turns
// the graph's events into transitions of it and draws what depends on it.
import "../graph-replay/graph-replay";
import type { GraphReplay, ReplayChangeDetail } from "../graph-replay/graph-replay";
import type { StepEvent } from "../graph-replay/buffer";
import { labelFor, loadCatalogue, loadedCatalogue, menuLabel, menuShort } from "./catalogue";
import { h } from "./dom";
import { examYears } from "./exam";
import { buildView } from "./found/view";
import { buildPlayer } from "./player";
import { feedRows, llmNotice, nextAnnouncement, type AnnounceState, type FeedRow } from "./round-feed";
import { buildRightNow } from "./right-now";
import { describeStep, failed, finished, press, refused, replayable, rightNow, started, stepped, type RunState } from "./run-state";
import { term } from "./terms";

export const KICKER = "WATCH IT THINK";
export const HEADING = "Choose the AI, press play, and watch it work.";
export const LOOP_STEPS = ["1 · Agent proposes clues", "2 · Code checks", "3 · Code fits a regression", "4 · Code scores it"];
export const LOOP_REPEAT = "↺ repeat until no better";
export const AGENT_QUESTION = "What makes it an agent?";
export const AGENT_EXPLAINER = "A language model working in a loop: it looks at the results so far, decides what to try next, and stops when it can't do better. Here the AI makes those decisions in the purple steps; code does everything else.";
export const AGENT_LEGEND = ["Purple dashed: the AI decides", "Solid: code", "Green: done", "Ringed: happening now"];
export const AGENT_COMMENTARY = "Built with LangGraph. Each box is a node, a Python function, and each arrow is an edge. Some edges are conditional: after check_proposal and evaluate, the graph reads its state and chooses where to go next: back to propose_features, on to fit_model, or out to the yardstick. The state carries the data, every idea tried and every score from one step to the next.";
export const FEED_EMPTY = "The agent's ideas appear here, one round at a time, once you press play.";

/** How the page holds the run state: Watch it think reads it and moves it on. */
export interface WatchDeps {
  state(): RunState;
  set(next: RunState): void;
}

export interface Watch {
  /** Redraw what depends on the run state (the player, Right now, the feed, the closing line, the graph's controls). */
  render(state: RunState): void;
  /** Move the reader to the picker: scroll to it and focus the select. */
  focusPicker(): void;
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
    parts.append(strip, h("p", {}, `Each idea is fitted on the seasons before a check season and scored on it; the three scores are averaged.`));
  } else {
    parts.append(h("p", { class: "muted" }, "The seasons appear once the data is split."));
  }
  return parts;
}

function explainer(): HTMLElement[] {
  const legend = h("p", { class: "agent-legend", "data-testid": "agent-legend" });
  AGENT_LEGEND.forEach((text, i) => {
    if (i) legend.append(" · ");
    legend.append(h("span", { class: `lg lg-${["ai", "code", "done", "now"][i]}` }, text));
  });
  return [
    h("h3", { class: "agent-question" }, AGENT_QUESTION),
    h("p", { "data-testid": "agent-explainer" }, AGENT_EXPLAINER),
    legend,
    h("div", { "data-region": "commentary", class: "commentary", id: "agent-commentary", "data-testid": "agent-commentary" },
      h("span", { class: "commentary-label" }, "Commentary"), h("p", {}, AGENT_COMMENTARY)),
  ];
}

function rowEl(r: FeedRow): HTMLElement {
  const chips = r.settings.map((text) => h("li", { class: "setup-chip", "data-testid": "setup-chip" }, text));
  return h("li", { class: `round-row status-${r.status}`, "data-testid": "round-item", "data-round": String(r.round), "data-status": r.status },
    h("span", { class: "round-n" }, `ROUND ${r.round}`),
    h("div", { class: "round-main" },
      h("p", { class: "round-idea", "data-testid": "round-idea" }, h("strong", {}, r.idea)),         // the seasons are one of the settings, shown in Commentary
      ...(r.reason ? [h("blockquote", { class: "reason", "data-reasoning": "", "data-region": "reasoning", "data-testid": "model-reason" }, r.reason)] : []),
      ...(chips.length ? [h("div", { "data-region": "commentary", class: "commentary round-settings", "data-testid": "round-settings" },
        h("ul", { class: "setup-chips" }, ...chips))] : [])),
    h("div", { class: "round-result" },
      ...(r.score ? [h("strong", { class: "score", "data-testid": "round-score" }, r.score)] : []),
      h("span", { class: `status-tag status-${r.status}`, "data-testid": "round-status" }, r.statusText)));
}

export function setupWatch(root: HTMLElement, deps: WatchDeps): Watch {
  const query = new URLSearchParams(location.search).get("interval");
  const replay = document.createElement("graph-replay") as GraphReplay;
  replay.setAttribute("structure-url", "/api/structure");
  replay.setAttribute("compact", "");
  replay.setAttribute("hide-legend", "");
  if (query) replay.setAttribute("interval-ms", query);

  const player = buildPlayer();
  const right = buildRightNow();
  const region = h("div", { class: "visually-hidden", role: "status", "aria-live": "polite", "aria-atomic": "true", "data-testid": "round-live-region" });
  const feed = h("ol", { class: "round-feed", "data-testid": "round-feed", "aria-label": "The rounds so far" });
  const empty = h("p", { class: "muted", "data-testid": "feed-empty" }, FEED_EMPTY);
  const notice = h("p", { class: "llm-notice", role: "status", "data-testid": "llm-notice", hidden: "" });
  const closing = h("p", { class: "best-idea", "data-testid": "best-idea" });
  const seeResult = h("a", { href: "#verdict", class: "see-result", "data-testid": "see-result", hidden: "" });
  const above = h("div", { "data-testid": "watch-above" });

  const stage = h("div", { class: "run-stage" }, h("div", { class: "run-graph", "data-testid": "run-graph" }, replay), right.el);
  const player_ = h("div", { class: "player", "data-testid": "player" },
    player.el, ...explainer(), stage, region, empty, feed, notice, closing, seeResult);

  root.replaceChildren(
    h("p", { class: "kicker" }, KICKER),
    h("h2", { id: "watch-title" }, HEADING),
    loopStrip(), above, player_);

  // ---- what the player is showing
  let replaying = false;                  // "Watch it again" is playing the finished run through the graph
  let replayState: Record<string, unknown> = {};
  let replayDetail: ReplayChangeDetail | null = null;
  let announce: AnnounceState = { cursor: -1, spoken: new Set() };
  let lastDrawn: RunState | null = null;

  const doing = (): Record<string, string> => replay.loadedStructure?.doing ?? {};
  const actorOf = (node: string | null): "ai" | "code" | null => {
    const n = replay.loadedStructure?.nodes.find((x) => x.id === node);
    return n?.actor === "llm" ? "ai" : n?.actor === "code" ? "code" : null;
  };
  const roundCap = () => loadedCatalogue()?.round_cap ?? null;
  const viewIsEverything = () => document.body?.dataset.view === "everything";

  function shownState(s: RunState): Record<string, unknown> {
    if (replaying) return replayState;
    return s.current?.state ?? s.last?.state ?? {};
  }

  function paintFeed(s: RunState) {
    const shown = shownState(s);
    const view = buildView(shown);
    const rows = feedRows(view.rounds, labelFor, menuLabel, menuShort);
    feed.replaceChildren(...rows.map(rowEl));
    empty.hidden = rows.length > 0 || s.phase === "running";
    empty.textContent = s.phase === "running" && !rows.length ? "The first idea will appear when the agent has proposed it." : FEED_EMPTY;
    if (s.phase === "running" && !rows.length) empty.hidden = false;
    const said = llmNotice(shown.llm_status as string | undefined, shown.llm_failure as string | null | undefined, rows.length);
    notice.hidden = !said;
    notice.textContent = said ?? "";
    return rows;
  }

  function paintClosing(s: RunState) {
    const shown = shownState(s);
    const best = shown.llm_best as { features: string[]; window?: string } | null | undefined;
    const done = !!shown.final && (s.phase !== "running" || replaying);
    if (!done || !best) { closing.textContent = ""; seeResult.hidden = true; return; }
    const seasons = best.window ? menuLabel("window", best.window) : null;
    closing.textContent = `Best idea: ${best.features.map(labelFor).join(", ")}${seasons ? `, learning from ${seasons}` : ""}.`;
    const years = examYears(shown.split as Parameters<typeof examYears>[0]);
    seeResult.textContent = `See how it did on ${years ? years.test : `the ${term("test_season")}`} ↓`;
    seeResult.hidden = false;
  }

  function paintControls(s: RunState) {
    const everything = viewIsEverything();
    const hasRun = !!(s.current?.events.length || s.last);
    // the run controls, the event and state panels and the path come back with Show me everything, once there is a run to step through
    if (everything && hasRun && s.phase !== "running") replay.removeAttribute("compact"); else replay.setAttribute("compact", "");
    if (everything) replay.removeAttribute("hide-legend"); else replay.setAttribute("hide-legend", "");
  }

  function paintRightNow(s: RunState) {
    if (replaying && replayDetail && replayDetail.cursor >= 0) {
      const events = replay.events;
      const node = events[replayDetail.cursor]?.node ?? null;
      right.render(describeStep(node, replayState, doing(), roundCap()));
      return;
    }
    right.render(rightNow(s, doing(), roundCap()));
  }

  function render(s: RunState) {
    lastDrawn = s;
    const node = replaying ? null : s.current?.inProgress ?? null;
    player.render(s, node ? doing()[node] ?? null : null, actorOf(node));
    paintFeed(s);
    paintClosing(s);
    paintRightNow(s);
    paintControls(s);
    const seasonsState = shownState(s);
    if (seasonsState.split) above.replaceChildren(commentaryAbove(seasonsState));
  }

  // ---- the graph's events become transitions of the run state
  replay.addEventListener("nodestart", (ev) => deps.set(started(deps.state(), (ev as CustomEvent<{ node: string }>).detail)));
  replay.addEventListener("nodestep", (ev) => deps.set(stepped(deps.state(), (ev as CustomEvent<StepEvent>).detail)));
  replay.addEventListener("rundone", () => deps.set(finished(deps.state())));
  replay.addEventListener("runerror", (ev) => deps.set(failed(deps.state(), (ev as CustomEvent<{ message: string }>).detail.message)));
  replay.addEventListener("refused", (ev) => {
    const info = (ev as CustomEvent<{ reason: string; message: string }>).detail;
    deps.set(refused(deps.state(), info.message));            // the gate's own words, as an alert under the button
    if (info.reason === "model_not_allowed") void player.reload();
  });

  replay.addEventListener("replaychange", (ev) => {
    const d = (ev as CustomEvent<ReplayChangeDetail>).detail;
    replayDetail = d;
    if (replaying) {
      replayState = d.state;
      if (d.atEnd && !d.playing) replaying = false;
      if (d.cursor < 0) announce = { cursor: -1, spoken: new Set() };
      const rows = feedRows(buildView(d.state).rounds, labelFor, menuLabel, menuShort);
      const said = nextAnnouncement(announce, { cursor: d.cursor, rows });
      announce = said.state;
      if (said.line) region.textContent = said.line;
      if (lastDrawn) render(lastDrawn);
    } else if (lastDrawn?.phase === "running") {
      // a live run: the per-round line is spoken as the rounds arrive (never every node)
      const rows = feedRows(buildView(d.state).rounds, labelFor, menuLabel, menuShort);
      const said = nextAnnouncement(announce, { cursor: d.cursor, rows });
      announce = said.state;
      if (said.line) region.textContent = said.line;
    }
  });

  // ---- buttons
  player.onPlay(() => {
    if (!replay.isReady) { deps.set({ ...deps.state(), message: "The graph is still loading. Try again in a moment." }); return; }
    const choice = player.chosen();
    replaying = false;
    announce = { cursor: -1, spoken: new Set() };
    deps.set(press(deps.state(), choice.name));
    replay.startLive(choice.url);
  });

  player.onWatchAgain(() => {
    const run = replayable(deps.state());
    if (!run) return;
    replaying = true;
    replayState = {};
    announce = { cursor: -1, spoken: new Set() };
    replay.loadRun(run.events);
    if (reduced()) { replay.showEnd(); replaying = false; } else replay.restart();
    if (lastDrawn) render(lastDrawn);
  });

  document.addEventListener("viewchange", () => { if (lastDrawn) render(lastDrawn); });
  replay.addEventListener("structureready", () => { if (lastDrawn) render(lastDrawn); });
  void loadCatalogue().catch(() => undefined).then(() => { if (lastDrawn) render(lastDrawn); });
  above.replaceChildren(commentaryAbove({}));
  render(deps.state());

  return {
    render,
    /** Scroll to the player, then focus the AI picker once the page has stopped moving, so a phone's own picker opens where the select now is (issue 6). */
    focusPicker() {
      const before = window.scrollY;
      root.scrollIntoView({ block: "start" });
      if (window.scrollY === before || !("onscrollend" in window)) { requestAnimationFrame(() => player.focusSelect()); return; }
      let done = false;
      const focus = () => { if (done) return; done = true; clearTimeout(fallback); window.removeEventListener("scrollend", focus); player.focusSelect(); };
      const fallback = window.setTimeout(focus, 400);   // a browser that never reports the end of the scroll
      window.addEventListener("scrollend", focus, { once: true });
    },
  };
}
