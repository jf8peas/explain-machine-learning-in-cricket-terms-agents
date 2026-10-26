// <graph-replay structure-url="..." run-url="...">
// Generic: knows only a graph structure and a stream of step events. Nothing about the app.
// The steps are drawn in the rows the structure names (see rows.ts and rows-view.ts); the buffer plays a run back at a paced
// speed, whether it is streaming in or was saved earlier (loadRun).
import { foldState, ReplayBuffer, realClock, type StepEvent } from "./buffer";
import { ItemPanel, Legend } from "./legend";
import { groupRows } from "./rows";
import { drawRows, type DrawnRows } from "./rows-view";
import { streamRun, type Refusal } from "./sse";
import { roundAt, visitTick } from "./stages";
import { summarise } from "./state-view";
import type { Structure } from "./structure";
import { styles } from "./styles";

export interface ReplayChangeDetail {
  cursor: number;
  steps: number;
  finished: boolean;
  atEnd: boolean;
  /** True while the replay is advancing by itself. */
  playing: boolean;
  /** Accumulated state at the step on display. */
  state: Record<string, unknown>;
  /** Accumulated state after the last step, once the stream has finished; otherwise null. */
  finalState: Record<string, unknown> | null;
  /** Accumulated state of every step received so far, whether or not it has been shown yet. */
  receivedState: Record<string, unknown>;
  /** Counts the runs started: it goes up by one each time a new run starts, so a page can tell a new run from stepping. */
  run: number;
  /** True when the stream ended with an error event, or the connection was lost before the run finished. */
  failed: boolean;
  /** The node that has started and not yet completed (a live run only). */
  inProgress: string | null;
  /** The node that was working when a run stopped part-way. */
  failedNode: string | null;
}

const SHOW_VALUES = "Show every value", HIDE_VALUES = "Hide every value";

const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export class GraphReplay extends HTMLElement {
  static observedAttributes = ["structure-url", "run-url", "interval-ms"];

  private buf = new ReplayBuffer(realClock, () => this.update());
  private structure: Structure | null = null;
  private drawn: DrawnRows | null = null;
  private legend: Legend | null = null;
  private itemPanel: ItemPanel | null = null;
  /** The stage picked in the legend: a viewing preference, kept apart from the playback buffer. */
  private selectedStage: string | null = null;
  private restoringStage = false;
  private abort: AbortController | null = null;
  private runNumber = 0;
  private runFailed = false;
  /** True from starting a run until the stream ends (or is refused): a second start waits. */
  private running = false;
  private starting = false;
  /** True once the rows have been drawn: a run cannot start before then. */
  private ready = false;
  private message = "";
  private messageIsError = false;
  private timelineCount = -1;
  private $ = (sel: string) => this.shadowRoot!.querySelector(sel) as HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <div class="wrap" part="wrap" role="group" aria-label="Agent run replay" data-testid="replay">
        <div class="toolbar" role="toolbar" aria-label="Playback controls">
          <button class="primary" data-act="play" data-testid="play" disabled>Play</button>
          <button data-act="pause" data-testid="pause">Pause</button>
          <button data-act="back" data-testid="back" aria-keyshortcuts="ArrowLeft">Back</button>
          <button data-act="step" data-testid="step" aria-keyshortcuts="ArrowRight">Step</button>
          <button data-act="reset" data-testid="reset">Reset</button>
          <label>Speed
            <select data-act="speed" data-testid="speed" aria-label="Playback speed">
              <option value="3000">0.5×</option><option value="1500" selected>1×</option><option value="750">2×</option>
            </select>
          </label>
        </div>
        <div class="status" role="status" aria-live="polite" data-testid="status"></div>
        <p class="here" data-testid="here" hidden></p>
        <div class="main">
          <div class="graph"><div class="rows" role="group" aria-label="The agent's steps, in rows" data-testid="graph" data-diagram></div></div>
          <section class="panel legend" data-testid="legend" aria-labelledby="h-legend" hidden></section>
          <div class="side">
            <section class="panel item-panel" data-testid="item-panel" aria-labelledby="h-item" aria-live="polite" hidden></section>
            <section class="panel event-panel" aria-labelledby="h-event"><h3 id="h-event">Event</h3><div id="event" data-testid="event" aria-live="polite"></div></section>
            <section class="panel state-panel" aria-labelledby="h-state"><h3 id="h-state">Graph state</h3><details class="raw" data-testid="raw-state" data-region="state"><summary>${SHOW_VALUES}</summary><div class="state" id="state" data-testid="state"></div></details></section>
          </div>
        </div>
        <details class="path" data-testid="path"><summary>Path taken</summary><ol class="timeline" aria-label="Path taken" data-testid="timeline"></ol></details>
      </div>`;
    this.applyInterval();
    this.shadowRoot!.addEventListener("click", this.onClick);
    this.shadowRoot!.addEventListener("change", this.onChange);
    // the state panel's disclosure says what it will do: "Show every value" when closed, "Hide every value" when open
    const raw = this.$(".raw") as HTMLDetailsElement;
    raw.addEventListener("toggle", () => { (raw.querySelector("summary") as HTMLElement).textContent = raw.open ? HIDE_VALUES : SHOW_VALUES; });
    window.addEventListener("keydown", this.onKey);
    void this.loadStructure();
    this.update();
  }

  attributeChangedCallback(name: string) {
    if (name === "interval-ms") this.applyInterval();
  }

  /** Optional starting pace (ms per step); shown as an extra choice in the speed control. */
  private applyInterval() {
    const iv = Number(this.getAttribute("interval-ms"));
    const sel = this.shadowRoot?.querySelector('[data-act="speed"]') as HTMLSelectElement | null;
    if (!(iv > 0) || !sel) return;
    this.buf.setSpeed(iv);
    if (!Array.from(sel.options).some((o) => Number(o.value) === iv)) {
      sel.insertAdjacentHTML("beforeend", `<option value="${iv}">${iv} ms</option>`);
    }
    sel.value = String(iv);
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.onKey);
    this.abort?.abort();
    this.buf.reset();
  }

  // ---------------- public control (a host page can drive the replay with its own buttons) ----------------
  /** Replace whatever is on screen with a saved run: nothing is fetched and no run is started. It is not played yet. */
  loadRun(events: StepEvent[]): void {
    this.endStream();
    this.runFailed = false;
    this.message = "";
    this.messageIsError = false;
    this.runNumber += 1;
    this.buf.reset();
    for (const e of events) this.buf.push(e);
    this.buf.finish();
  }

  /** Start playing from where the replay is; from the start if it has finished. */
  play(): void {
    if (this.buf.atEnd) this.buf.rewind();
    this.buf.play();
  }

  pause(): void { this.buf.pause(); }

  /** Back to the first step, playing. */
  restart(): void {
    this.buf.rewind();
    this.buf.play();
  }

  /** Show the finished run at once, without playing it. */
  showEnd(): void { this.buf.showEnd(); }

  /** Stream a new run from `url` (the host page chooses it) and replace what is on screen once the server accepts it. */
  startLive(url: string): void { this.startRun(url); }

  get isPlaying(): boolean { return this.buf.playing; }

  /** True once the rows are drawn; a live run cannot start before then. */
  get isReady(): boolean { return this.ready; }

  /** Every step received so far (a copy), so a host page can keep a finished run. */
  get events(): StepEvent[] { return [...this.buf.events]; }

  /** The structure the graph was drawn from (nodes, edges and whatever the app sent with them, such as `doing`), once loaded. */
  get loadedStructure(): Structure | null { return this.structure; }

  // ---------------- structure ----------------
  private async loadStructure() {
    const url = this.getAttribute("structure-url");
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      this.structure = (await res.json()) as Structure;
      this.drawGraph();
      this.setupLegend();
      this.ready = true;
      this.update();
      this.dispatchEvent(new CustomEvent("structureready", { bubbles: true, composed: true }));
    } catch {
      this.setMessage("Could not load the graph structure.", true);
    }
  }

  /** Open an item's summary, or close it if it is already open. Never touches playback. */
  private toggleItem(id: string) {
    if (!this.itemPanel) return;
    const item = this.structure?.items?.find((it) => it.id === id);
    if (!item || this.itemPanel.open === id) { this.itemPanel.hide(); return; }
    this.itemPanel.show(item);
  }

  private setupLegend() {
    const stages = this.structure?.stages ?? [];
    const panel = this.$(".legend");
    if (!stages.length || !this.structure) { panel.hidden = true; return; }
    const steps = this.structure.nodes.filter((n) => n.kind === "node");
    const withNodes = new Set(steps.filter((n) => n.stage).map((n) => n.stage as string));
    const unassigned = steps.filter((n) => !n.stage || !stages.some((s) => s.id === n.stage)).map((n) => n.id);
    this.legend = new Legend(panel, {
      stages, notes: this.structure.notes, withNodes, unassigned,
      onSelect: (id) => { this.selectedStage = id; this.applyFilter(); if (!this.restoringStage) this.showStage(id); },
    });
    if (this.selectedStage) {
      this.restoringStage = true;   // putting a kept selection back after a redraw must not move the replay
      this.legend.select(this.selectedStage);
      this.restoringStage = false;
    }
  }

  /** Picking a stage also moves the replay to it: the first step the run has reached in that stage, so the Event and Graph state panels show it.
   *  If the step on display is already in the stage, or no step in it has been reached yet, the replay stays where it is. */
  private showStage(id: string | null) {
    if (!id || !this.drawn) return;
    const stageOf = (node: string) => { const r = this.drawn?.stageOf.get(node); return r?.state === "assigned" ? r.stage.id : null; };
    const b = this.buf;
    if (b.cursor >= 0 && stageOf(b.events[b.cursor].node) === id) return;
    const index = b.reached.findIndex((e) => stageOf(e.node) === id);
    if (index >= 0) b.jump(index);
  }

  /** Dim every step outside the selected stage, except the active one. A class only: no animation. */
  private applyFilter() {
    if (!this.drawn) return;
    const picked = this.selectedStage;
    const graph = this.$(".graph");
    if (picked) graph.setAttribute("data-filter", picked); else graph.removeAttribute("data-filter");
    const mark = (el: Element, active: boolean) => {
      const stage = el.getAttribute("data-stage");
      el.classList.toggle("stage-selected", !!picked && stage === picked);
      el.classList.toggle("dim", !!picked && stage !== picked && !active);
    };
    for (const el of this.drawn.nodeEls.values()) mark(el, el.classList.contains("active"));
    for (const el of this.drawn.itemEls.values()) mark(el, false);
  }

  private drawGraph() {
    if (!this.structure) return;
    this.itemPanel ??= new ItemPanel(this.$(".item-panel"), () => this.itemPanel?.hide());   // kept across a redraw
    this.drawn = drawRows(this.$(".rows"), groupRows(this.structure), this.structure.stages, this.structure.loop?.fit,
      (id) => this.toggleItem(id));
  }

  // ---------------- run control ----------------
  private endStream() {
    this.abort?.abort();
    this.abort = null;
    this.running = false;
    this.starting = false;
  }

  private startRun(url: string | null = this.getAttribute("run-url")) {
    if (!url) return;
    if (this.running || !this.ready) return; // one run at a time: a second start waits for the first to end
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.running = true;
    this.starting = true;
    // Whatever is on screen stays until the server accepts the start; a refused start must not disturb it.
    void streamRun(url, signal, {
      onOpen: () => {
        if (signal.aborted) return;
        this.starting = false;
        this.message = "";
        this.messageIsError = false;
        this.runNumber += 1;
        this.runFailed = false;
        this.buf.beginLive();
        this.emit("runopen", {});
      },
      onRefused: (info: Refusal) => {
        if (signal.aborted) return;
        this.running = false;
        this.starting = false;
        this.setMessage(info.message, true);
        this.dispatchEvent(new CustomEvent<Refusal>("refused", { detail: info, bubbles: true, composed: true }));
      },
      onStart: (e) => { if (!signal.aborted) { this.buf.start(e.node); this.emit("nodestart", e); } },
      onStep: (e: StepEvent) => { if (!signal.aborted) { this.buf.push(e); this.emit("nodestep", e); } },
      onDone: () => { if (signal.aborted) return; this.running = false; this.buf.finish(); this.emit("rundone", {}); },
      onError: (m) => {
        if (signal.aborted) return;
        this.running = false;
        this.runFailed = true;
        this.message = m;
        this.messageIsError = true;
        this.buf.fail();
        this.emit("runerror", { message: m });
      },
      onDisconnect: () => {
        if (signal.aborted) return;
        this.running = false;
        this.starting = false;
        this.runFailed = true;
        const lost = "The connection was lost before the run finished. The steps already received are still here to explore.";
        this.message = lost;
        this.messageIsError = true;
        this.buf.fail();
        this.emit("runerror", { message: lost });
      },
    });
    this.update();
  }

  /** Reset: with a run of its own to start, clear everything; otherwise (the host page supplies the run) go back to the first step. */
  private resetAll() {
    if (!this.getAttribute("run-url")) { this.buf.rewind(); return; }
    this.runFailed = false;
    this.endStream();
    this.message = "";
    this.messageIsError = false;
    this.buf.reset();
  }

  private emit<T>(name: string, detail: T) {
    this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
  }

  private setMessage(m: string, isError = false) {
    this.message = m;
    this.messageIsError = isError;
    this.update();
  }

  // ---------------- events ----------------
  private onClick = (ev: Event) => {
    const target = (ev.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!target || target.disabled) return;
    const idx = target.dataset.index;
    if (idx !== undefined) return this.buf.jump(Number(idx));
    switch (target.dataset.act) {
      case "play": return this.startRun();
      case "pause": return this.buf.playing ? this.buf.pause() : this.buf.play();
      case "back": return this.buf.prev();
      case "step": return this.buf.next();
      case "reset": return this.resetAll();
    }
  };

  private onChange = (ev: Event) => {
    const el = ev.target as HTMLSelectElement;
    if (el.dataset.act === "speed") this.buf.setSpeed(Number(el.value));
  };

  private onKey = (ev: KeyboardEvent) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    const t = ev.target as HTMLElement | null;
    if (t && (t.closest("input, textarea, select") || t.isContentEditable)) return;
    ev.preventDefault();
    if (ev.key === "ArrowRight") this.buf.next(); else this.buf.prev();
  };

  // ---------------- rendering ----------------
  private reducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  private update() {
    if (!this.shadowRoot?.querySelector(".wrap")) return;
    const b = this.buf;
    const wrap = this.$(".wrap");
    wrap.dataset.reducedMotion = String(this.reducedMotion());

    // buttons
    const hasEvents = b.events.length > 0;
    const play = this.$('[data-act="play"]') as HTMLButtonElement;
    play.hidden = !this.getAttribute("run-url");       // a host page that supplies the run has no Play of its own
    play.disabled = this.running || !this.ready;        // no second run while one is going; none before the rows are drawn
    this.setAttribute("data-running", String(this.running));
    (this.$('[data-act="pause"]') as HTMLButtonElement).textContent = b.playing ? "Pause" : "Resume";
    (this.$('[data-act="pause"]') as HTMLButtonElement).disabled = !hasEvents && !b.playing || b.atEnd;
    (this.$('[data-act="back"]') as HTMLButtonElement).disabled = b.cursor < 0;
    (this.$('[data-act="step"]') as HTMLButtonElement).disabled = !hasEvents || b.cursor >= b.events.length - 1;
    // Reset would abandon a run the server is still working on, so it waits for the run to end like Play does
    (this.$('[data-act="reset"]') as HTMLButtonElement).disabled = this.running || (!hasEvents && !b.playing && !this.message);
    const speed = this.$('[data-act="speed"]') as HTMLSelectElement;
    if (Number(speed.value) !== b.intervalMs) speed.value = String(b.intervalMs);

    // status
    const status = this.$(".status");
    status.textContent = this.message ||
      ((b.playing || this.starting) && !hasEvents ? "Starting the run…" :
        !hasEvents ? (this.getAttribute("run-url") ? "Press Play to watch the agent work through the problem." : "") : "");
    status.classList.toggle("error", this.messageIsError);

    this.updateGraph();
    this.updatePanels();
    this.updateTimeline();

    this.dispatchEvent(new CustomEvent<ReplayChangeDetail>("replaychange", {
      detail: {
        cursor: b.cursor, steps: b.events.length, finished: b.finished, atEnd: b.atEnd, playing: b.playing, state: b.stateAt(),
        finalState: b.finished && b.events.length ? b.stateAt(b.events.length - 1) : null,
        receivedState: foldState(b.events),
        run: this.runNumber, failed: this.runFailed, inProgress: b.inProgress, failedNode: b.failedNode,
      },
      bubbles: true, composed: true,
    }));
  }

  private updateGraph() {
    const drawn = this.drawn;
    if (!drawn) return;
    const b = this.buf;
    const counts = b.visitCounts();
    // The ringed node is the one working: while a run streams, the node that has started and not completed; when a finished run is
    // stepped or replayed, the node of the step shown until the last step (then none). A node that was working when the run
    // stopped takes the error mark. A completed node is "done".
    const active = b.failedNode ? null
      : b.follow ? b.inProgress
      : b.cursor >= 0 && !b.atEnd ? b.events[b.cursor].node : null;
    for (const [id, el] of drawn.nodeEls) {
      const n = counts.get(id) ?? 0;
      const failedHere = id === b.failedNode;
      el.classList.toggle("active", id === active);
      el.classList.toggle("visited", n > 0);
      el.classList.toggle("failed", failedHere);
      el.setAttribute("data-state", failedHere ? "error" : id === active ? "running" : n > 0 ? "done" : "idle");
      const tick = el.querySelector(".tick") as HTMLElement | null;
      if (tick) {
        tick.textContent = visitTick(n);
        tick.toggleAttribute("hidden", n === 0);
      }
      if (n >= 2) el.setAttribute("data-visits", String(n)); else el.removeAttribute("data-visits");
      if (id === active) el.setAttribute("aria-current", "step"); else el.removeAttribute("aria-current");
    }
    this.toggleAttribute("data-live", b.follow);
    this.applyFilter();
    this.updateLoop();
  }

  /** Show the round number, from the second visit to the loop's fit stage. Recomputed from the replay position on every
   *  update, so Back lowers it and Reset clears it. Static styling: no animation. */
  private updateLoop() {
    const loop = this.structure?.loop;
    const drawn = this.drawn;
    if (!drawn) return;
    const b = this.buf;
    const round = loop ? roundAt(b.events, b.cursor, (node) => {
      const r = drawn.stageOf.get(node);
      return r?.state === "assigned" ? r.stage.id : null;
    }, loop.fit) : 0;
    for (const pill of drawn.loopPills) {
      pill.toggleAttribute("hidden", round < 2);                     // shown once the run has come round again
      pill.textContent = round >= 2 ? `↻ round ${round}` : "";
    }
  }

  private updatePanels() {
    const b = this.buf;
    const ev = this.$("#event");
    // the highlighted step in the rows and the path is the replay's position, not a stage filter: say so
    const here = this.$(".here");
    here.hidden = b.cursor < 0;
    here.textContent = b.cursor < 0 ? "" : `Showing step ${b.events[b.cursor].step} of ${b.finished ? b.events.length : "…"}`;
    if (b.cursor < 0) {
      ev.innerHTML = `<p>Nothing has run yet.</p>`;
      this.$("#state").innerHTML = `<p>The graph's state fills in as each step finishes.</p>`;
      return;
    }
    const e = b.events[b.cursor];
    const actors = this.drawn?.actors;
    ev.innerHTML = `<p><span class="node-name" data-testid="event-node">${esc(e.node)}</span> ${actors?.get(e.node) === "llm" ? '<span class="actor-pill" data-testid="event-actor">language model step</span>' : actors?.get(e.node) === "code" ? '<span class="actor-pill code" data-testid="event-actor">code step</span>' : ""}</p>${this.stageLine(e.node)}<p data-testid="event-summary">${esc(e.summary)}</p>`;
    const state = b.stateAt();
    const changed = new Set(b.changedKeysAt());
    this.$("#state").innerHTML = Object.entries(state).map(([k, v]) => {
      const c = changed.has(k);
      return `<div class="row${c ? " changed" : ""}" data-key="${esc(k)}" data-changed="${c}"><span class="key">${esc(k)}</span>${c ? '<span class="badge">changed in this step</span>' : ""}<pre>${esc(JSON.stringify(summarise(v), null, 2))}</pre></div>`;
    }).join("");
  }

  /** The stage line of the Event panel: badge, name and question, and the app's note for the stage if it gave one. */
  private stageLine(node: string): string {
    const r = this.drawn?.stageOf.get(node);
    if (!r || r.state === "none") return "";
    if (r.state === "unassigned") return `<p class="stage-line unassigned" data-testid="event-stage">No stage assigned to this step.</p>`;
    const note = this.structure?.notes?.stages?.[r.stage.id];
    return `<p class="stage-line" data-testid="event-stage" data-stage="${esc(r.stage.id)}" style="--stage-colour: var(${r.token})">` +
      `<span class="badge">${r.number}</span> <strong>${esc(r.stage.name)}</strong> <span class="stage-question">${esc(r.stage.question)}</span>` +
      `${note ? ` <details class="stage-line-note-box"><summary>About this stage</summary><span class="stage-line-note" data-testid="event-stage-note">${esc(note)}</span></details>` : ""}</p>`;
  }

  private updateTimeline() {
    const b = this.buf;
    const ol = this.$(".timeline");
    const reached = b.reached;
    this.$(".path > summary").textContent = reached.length ? `Path taken (${reached.length} steps)` : "Path taken";
    if (this.timelineCount !== reached.length) {
      this.timelineCount = reached.length;
      ol.innerHTML = reached.map((e, i) => {
        const r = this.drawn?.stageOf.get(e.node);
        // the stage cue is a number drawn by CSS from data-stage-number (so the button's text stays "3. explore")
        const cue = r?.state === "assigned"
          ? ` data-stage="${esc(r.stage.id)}" data-stage-number="${r.number}" style="--stage-colour: var(${r.token})"`
          : r?.state === "unassigned" ? ` data-stage-number="–" style="--stage-colour: var(--gr-stage-none)"` : "";
        const spoken = r?.state === "assigned" ? `, stage ${r.number} ${esc(r.stage.name)}` : r?.state === "unassigned" ? ", no stage assigned" : "";
        return `<li><button data-index="${i}" data-testid="timeline-item"${cue} aria-label="Step ${e.step}: ${esc(e.node)}${spoken}">${e.step}. ${esc(e.node)}</button></li>`;
      }).join("");
    }
    ol.querySelectorAll("button").forEach((btn, i) => {
      if (i === b.cursor) btn.setAttribute("aria-current", "step"); else btn.removeAttribute("aria-current");
      btn.classList.toggle("future", i > b.cursor);
    });
  }
}

if (!customElements.get("graph-replay")) customElements.define("graph-replay", GraphReplay);
